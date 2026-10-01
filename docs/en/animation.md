# Animation from FBX

How to study an animation in an FBX and re-create it on your own model in three.js — even when the skeletons are different.
Section 0 is the ready tools; sections 1–3 are the method behind them.

## 0. The tools (v1.1)

Put your animated FBX files in **`workspace/fbx/`** (Unity style works best: `Hero.fbx` + `Hero@Walk.fbx` + `Hero@Attack.fbx`).
Everything below reads from that folder and writes into `workspace/` — nothing is uploaded.

```bash
npm run motion -- dump                          # every FBX → workspace/motion/<file>.json (bone positions per frame, real seconds)
npm run motion -- rig workspace/motion/Hero@Walk.json   # guess hips / chest / head / jaw / hands / feet / tail → workspace/motion/Hero.rig.json
#   ↑ OPEN Hero.rig.json AND CHECK EVERY ROLE — every rig names its bones differently. Delete roles you don't need.
npm run motion -- channels Hero.rig.json        # overall body pose per clip → workspace/motion/Hero_channels.js
npm run serve                                   # then open the FBX Viewer tab
```

- **FBX Viewer** (`viewer.html`): lists `workspace/fbx/`, plays and scrubs clips (×0.25 slow), shows the skeleton,
  and graphs the **height and speed of any bone** — the fastest way to see where a foot lands or a swing peaks.
  Link straight to a view: `viewer.html?open=Hero&clip=Walk&bone=LeftFoot`.
- **Channels on your model** (`models/motion.js`):
  ```js
  import { CLIPS } from '../workspace/motion/Hero_channels.js';
  import { sampleClip, timePlan } from '../models/motion.js';
  const ch = sampleClip(CLIPS.Walk, t, { loop:true });     // { turn, travel_x, travel_z, height, pitch, head_lift, head_yaw, jaw,
                                                            //   hand_L_x/y/z, hand_R_x/y/z, foot_L_lift, foot_R_lift, tail0_lift ... }
  hips.position.y = idle.hipY + ch.height;  chest.rotation.x = idle.pitch + ch.pitch;  // ADD to your own idle pose
  ```
  Channels are measured relative to the first frame and in the body's own facing, so they work on a different skeleton.
- **Edit timing without re-animating:** `timePlan(len, { cut:[[0.9, 2.0]], fast:[[3.0, 4.6, 2]] })` (times in original seconds)
  gives `plan.toSource(tPlayed)` for the pose and `plan.toPlayed(tSource)` to move sound cues the same way.
- A file with one take is named after the file (`Hero@Walk.fbx` = `Walk`), because takes are often called "Take 001" or "mixamo.com".
- Files at 24 / 25 / 60 fps are resampled, so every time you see is in real seconds.

## 1. Read the motion as numbers

Import the FBX in Blender (headless), step through every frame and write the **world position of each bone's head/tail** to JSON.
Positions, not rotations: rotations depend on each rig's bone roll and rest pose, positions do not.

What to look at first:
- **duration and fps** — the real clip length after trimming,
- **root motion** — does the character travel? (usually you remove it and let the game move the character),
- **contact moments** — the frames where a foot / hand / tail tip is lowest and slowest = it touches the ground,
- **peaks** — highest speed of a hand or weapon tip = the hit; widest jaw opening = the roar.

## 2. Measure "overall pose", don't copy bone angles

Different skeleton = copying angles breaks. Instead measure a few **channels** of the whole body, relative to the clip's first frame
of the idle pose and in the body's own facing direction:

| Channel | From |
|---|---|
| body turn, forward/side travel | root / hips |
| body height, pitch | hips, chest |
| neck / head lift and yaw, jaw open | chest → head, jaw bones |
| hand / wing-wrist offset | wrist position relative to the body, **height measured from the ground** (not from the hips) |
| tail lift / sweep | split the tail in two segments: the base barely moves, the tip whips |
| feet | which foot lifts, when, how high |

Your model then *adds* these channels on top of its own idle pose. The timing stays the original animator's — which is usually the best part.

## 3. Lessons that held up

- **Think in world axes for IK.** Legs, feet and claws must be solved against the world up axis; if the body pitches up 30–40° and the leg IK
  is solved in the body's frame, feet sink into the floor.
- **Subtract the body pitch from the tail angle**, or the tail goes through the ground when the body rears up.
- **A held pose needs a "still" segment**, not a frozen frame: keep tiny breathing motion.
- **Cut and speed up segments** (`[from, to]` ranges) instead of re-animating; shift sound cues by the same amount (see sound-sync).
- **Don't add springs to necks** "for weight" — it reads as wobbling. The original timing already carries the weight.
- **QC with numbers and a top view:** log the height of ankles / head / weapon tip every 0.05 s and look from above — side views hide sideways errors.
- When the original timing is good, **adapt it to your body first**; design over it only where your model is genuinely different.

## 4. Exporting your own clips

Clips defined in a model (`ANIMS`) are exported as `<Name>@<clip>.fbx`, one per file, checked by `tools/fbx_check.py`.
See [Export to Unity](export-unity.md).
