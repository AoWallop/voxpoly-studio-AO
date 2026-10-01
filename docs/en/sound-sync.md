# Sound that follows animation

Sound feels right when it lands on the frame the body *does* something. Find those frames from the animation data, not by ear.
(Version 1.1 adds a cue finder and a cue player; this page is the method and the file format.)

## 1. Find the moments

From the per-frame bone positions (see [Animation from FBX](animation.md)):

| Sound | Moment | How to detect |
|---|---|---|
| footstep | foot touches down | foot height reaches its minimum **and** its speed drops near zero |
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
