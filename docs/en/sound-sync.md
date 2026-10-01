# Sound that follows animation

Sound feels right when it lands on the frame the body *does* something. Find those frames from the animation data, not by ear.
Section 0 is the ready tools; the rest is the method and the file format.

## 0. The tools (v1.1)

You bring the sounds; the tools find **when** to play them.

```bash
# after: npm run motion -- dump  +  npm run motion -- rig ...   (see Animation from FBX)
npm run cues -- Hero.rig.json        # → workspace/cues/Hero.json + Hero.html (timeline with curves and markers per clip)
```

- Detected moments: **step** (foot comes down into the floor band after being lifted — works for in-place loops),
  **swing** (hand speed peak, placed 0.04 s early), **head** (head thrust), **tail** (tail tip peak),
  **roar** (jaw open ≥ 0.5 s, with an end time) / **snap** (short jaw open), **drop** (body falls and really loses height).
  Thresholds are relative to body size, so tiny and huge rigs use the same settings.
- Only roles that exist in the rig file are checked. Sound names come from `"sounds"` in the rig file — rename them to your own files' names.
- The cue file is a starting point: **open the FBX Viewer**, turn on *Tick on cues*, play at ×0.25, and fix times by hand where needed.
- **Play them in three.js** with `models/cue_player.js`:
  ```js
  import { CuePlayer } from '../models/cue_player.js';
  const player = new CuePlayer();
  await player.load({ step:['sfx/step1.wav', 'sfx/step2.wav'], whoosh:['sfx/whoosh.wav'],
                      roar:{ start:'sfx/roar_in.wav', loop:'sfx/roar_loop.wav', end:'sfx/roar_out.wav' } });
  player.setCues(await (await fetch('workspace/cues/Hero.json')).json());
  button.onclick = () => player.unlock();                  // browsers need one click before audio
  // every frame:
  player.update('Walk', prevTime, time, { plan });         // plan = timePlan(...) if you cut / sped up the clip
  ```
  An array = random variation · `{start, loop, end}` + a cue with an end time = sustained sound.

## 1. Find the moments

From the per-frame bone positions (see [Animation from FBX](animation.md)):

| Sound | Moment | How to detect |
|---|---|---|
| footstep | foot touches down | foot height comes back into the lowest 20 % of its range after being lifted (in an in-place loop a planted foot still slides, so speed alone misses it) |
| swing / whoosh | fastest part of a swing | peak speed of the hand / weapon tip (start the sound slightly before the peak) |
| impact | the swing stops | sharp drop of tip speed right after the peak |
| roar / voice | jaw opens | jaw angle passes a threshold; length = how long it stays open |
| body fall | body hits the ground | hips height minimum after a fast drop |
| wing flap | down-stroke | wrist vertical speed most negative |

## 2. Cue file

One JSON per model, cues per clip, in seconds:

```json
{
  "clips": {
    "attack": { "len": 1.8, "cues": [ { "t": 0.42, "sfx": "whoosh" }, { "t": 0.61, "sfx": "impact" } ] },
    "walk":   { "len": 1.0, "loop": true, "cues": [ { "t": 0.12, "sfx": "step" }, { "t": 0.62, "sfx": "step" } ] }
  }
}
```

- **Variations:** name a group (`step`) and pick one of several files at random each time — repeated identical samples sound mechanical.
- **Trimmed / sped-up clips:** when you cut `[a, b]` out of a clip or speed a range up, shift every cue after it by the same amount.
  Keep the cue file in *original* clip time and convert at play time, so the source stays valid.

## 3. Sustained sounds

A long roar or a charge-up should not be one stretched sample. Use **attack + loop + release**:
start sound at the cue, loop a seamless middle while the pose holds (jaw open, energy charging), release when the pose ends.
The hold length comes from the animation (how long the jaw stays above the threshold).

## 4. A sound map for the team

For engine programmers, a table is easier than code:

| Clip | Time (s) | Sound | Notes |
|---|---|---|---|
| attack | 0.42 | whoosh | 1 of 3 random |
| attack | 0.61 | impact | |
| roar | 0.30 → 2.10 | roar (sustain) | loop while jaw open |

Engines can place these as Animation Events at the listed times.

## 5. Making the sounds

Any source works (recordings, libraries, AI sound generators). If a generator needs an API key, keep the key in `.env`
(git-ignored) — **never** in a script that is committed.
