# FBX Clone — copy a rigged model into three.js exactly, then reshape it

[ภาษาไทย](../th/fbx-clone.md)

You have a character an artist built (FBX with a skeleton and clips). FBX Clone copies **every vertex, face, UV, weight, bone and
animation frame** into three.js, proves the copy is exact, and then lets you **change its proportions with sliders** — bigger head,
longer legs, chubbier arms — while the clips keep playing. A set of slider values is saved as a **preset** you can re-use in a game.

Section 1 is the tool. Sections 2–5 are the knowledge behind it: what has to be done right so the copy is exact,
and how the proportion system works. Read them before changing the code.

## 1. The tool (v2.5)

```bash
# 1. put the files in workspace/fbx/ (Unity style is best):
#    Hero.fbx            rig + mesh (T-pose or A-pose)
#    Hero@Idle.fbx       one clip per file (the mesh inside is optional, but needed for the exactness check)
#    Hero_Texture.png    the texture the FBX points to (same file name)
npm run clone                    # lists the characters it found
npm run clone -- Hero            # → workspace/clones/Hero.json + an entry in workspace/clones/index.json
npm run clone -- Hero --qc       # + screenshots in .qc/clone-Hero/ (standard · cel shade · clip · edge flow · reshaped · UV)
npm run serve                    # → open the "FBX Clone" tab
```

`npm run clone` prints the **bone roles** it guessed (which bone is the hips, the knee, the wrist…). Check them — the sliders
depend on them. A wrong or missing one is fixed by hand in `workspace/clones/index.json` (`"roles"`); a later run keeps your fix.

**The page** (`clone.html?m=Hero`)

| Panel | What it does |
|---|---|
| Exactness | vertex / face / quad / bone counts · height · **worst error of the clips against Blender, in mm** (expect < 0.01 mm) |
| Bone roles | the roles in use — the first thing to look at when a slider moves the wrong part |
| Clips | rest pose + every clip · speed · scrub |
| Parts | one button per source mesh when the FBX had several (body, eyes, hair…) |
| View | texture on/off · **Edge flow** = the source's real edges (quads without their diagonal) · bones · spin |
| Shading | cel shade (light steps, shadow, outline in mm) or standard |
| Proportions | 17 sliders (section 4) · original |
| Presets | name + 💾 save → `workspace/presets/<model>/<name>.json` · click a preset to load it |
| UV / texture | UV layout over the texture · checker on the model · ⬇ transparent UV lines · ⬇ UV + texture · ⬇ OBJ in rest pose (to paint in Substance / Blender) |
| Export | ⬇ GLB with the rig and every clip, **at the proportions on screen** |

Deep links: `clone.html?m=Hero&preset=chibi` · `&shade=lit`.
Saving a preset needs the page to be opened through `npm run serve` (the server writes the file).

## 2. Making the copy exact (what the Blender script does)

`tools/blender/fbx_clone.py` reads the FBX in Blender and writes plain JSON. Every rule below exists because skipping it
gave a visibly wrong result.

**2.1 Axes.** Blender is Z-up, three.js is Y-up with the front at +Z. One fixed rotation (−90° around X) is applied to
every vertex and every bone matrix: `(x, y, z) → (x, z, −y)`. Nothing else is flipped.

**2.2 Units and the hidden 0.01 scale.** An FBX saved in centimeters arrives with a 0.01 scale on the armature.
Vertices are taken through the mesh's full world matrix, so they come out in meters. Bones are decomposed and **their scale is
thrown away** (position + rotation only). If the scale stays on the bones, every bone length is off by 100× the moment the
model is exported or retargeted again.

**2.3 Bones are stored local to their parent.** For each bone: rest world matrix → `local position = parentRot⁻¹ · (pos − parentPos)`,
`local rotation = parentRot⁻¹ · rot`. That is exactly what `THREE.Bone` wants, so building the skeleton is a plain loop.

**2.4 Faces are kept as authored.** Quads stay quads in the JSON (counted separately), triangles stay triangles. three.js can only
draw triangles, so each quad is split `(0,1,2)(0,2,3)` — the same diagonal Blender uses — but the **edge-flow view draws the quad
outlines from the JSON**, so you study the topology the artist made, not the triangulation.

**2.5 UV seams split vertices.** three.js has one UV per vertex; an FBX has one UV per face corner. A vertex on a seam
(same position, different UV on each side) becomes several vertices, keyed by `vertex:u:v`. Vertex order and count of the
original are still kept in the JSON, so the check in 2.8 and the edge flow use the original numbering.

**2.6 Normals are averaged on the original vertices.** If normals were computed after the seam split, every UV seam would show
as a hard crease. Averaging over the original vertex first, then copying to its split copies, keeps the surface as smooth as the source.

**2.7 Skin weights: top 4, normalised.** three.js skins with 4 influences per vertex. The 4 strongest are kept and rescaled to sum 1.
A mesh that is parented to a bone with no weights at all (a sword in the hand) gets weight 1 on that bone.

**2.8 Clips are sampled, not re-interpolated.** Every frame of every clip is evaluated in Blender and stored as local position +
quaternion per bone. No curve guessing on our side, so constraints, IK baked in the file and odd interpolation all come across.

**2.9 Proof.** For 32 vertices spread over the body, Blender writes where they end up at the start, middle and end of every clip.
The page poses the same frames in three.js and measures the distance. The JSON rounds to 6 decimals (1 µm), so a correct copy
reports about **0.002–0.05 mm**. Anything above 0.1 mm means something in 2.1–2.8 broke — do not reshape before it is fixed.

**2.10 Several meshes on one armature** are merged into one mesh; each face remembers its mesh name (a face group), so parts can be
shown / hidden and exported or left out.

## 3. Bone roles

The proportion sliders do not know bone names. They act on **roles**, and `models/rigroles.js` maps roles to bones:

| Role | Means | Mixamo | Unreal | Blender | plain |
|---|---|---|---|---|---|
| hips | pelvis | Hips | pelvis | pelvis | hip |
| spine / chest | first / last torso bone | Spine / Spine2 | spine_01 / spine_03 | spine / chest | spine / chest |
| neck · head | | Neck · Head | neck_01 · head | neck · head | neck · head |
| shoulder | collarbone | LeftShoulder | clavicle_l | shoulder.L | left_shoulder |
| upperArm | **shoulder joint** | LeftArm | upperarm_l | upper_arm.L | left_arm |
| lowerArm | **elbow** | LeftForeArm | lowerarm_l | forearm.L | left_elbow |
| hand | **wrist** | LeftHand | hand_l | hand.L | left_wrist |
| upperLeg | **hip joint** | LeftUpLeg | thigh_l | thigh.L | left_leg |
| lowerLeg | **knee** | LeftLeg | calf_l | shin.L | left_knee |
| foot | **ankle** = the joint after the knee | LeftFoot | foot_l | foot.L | left_ankle |
| toe | ball of the foot | LeftToeBase | ball_l | toe.L | left_foot |

Roles are **joints**, counted from the body outwards. That is why "Leg" is the knee in Mixamo (it has `UpLeg` above it) but the
hip joint in a plain rig — the guesser checks for that. When a name gives nothing, it follows the chain (the child of the elbow is
the wrist). A role that cannot be found simply hides the sliders that use it.

## 4. The proportion system

### 4.1 Five kinds of change

| Kind | What moves | Used for |
|---|---|---|
| `size` | scales the part around a bone; children grow with it | whole body, head, hands, feet |
| `length` | moves a bone further from its parent (the **parent's** segment gets longer) | neck, torso, shoulders, arms, legs, hip width |
| `sizeOnly` | scales the part around one bone, children are scaled back to their own size (their joint still moves) | a thicker wrist without a bigger hand |
| `girth` | pushes skin away from the bone's axis (bone → first child), length unchanged | chest, waist, hips, arm / leg thickness |
| `belly` | like girth, but only skin that faces forward (+Z) | belly |

### 4.2 The 17 sliders

| Slider | Kind | Roles |
|---|---|---|
| Whole body | size | every root bone |
| Head size · Neck length | size · length | head |
| Torso length | length | every bone from spine up to neck |
| Shoulder width | length | upperArm |
| Arm length | length | lowerArm + hand (upper arm and forearm get longer) |
| Hand size · Wrist | size · sizeOnly | hand |
| Chest · Waist · Hips | girth | chest · spine · hips |
| Belly | belly | spine + hips |
| Arm girth · Leg girth | girth | upperArm + lowerArm · upperLeg + lowerLeg |
| Hip width | length | upperLeg |
| Leg length | length | lowerLeg + foot (thigh and shin get longer) |
| Foot size | size | foot |

Range 0.6–1.6. Two sliders that touch the same bone multiply. The list lives in `PROPORTIONS` in `models/clone.js` — add a row there
to add a slider (and a `pr.<id>` label in `i18n.js`).

### 4.3 How a reshape is computed (`C.reshape(mods)`)

1. **Always from the original.** A temporary skeleton is built from the original rest pose with the stretches and scales applied.
   Sliders never stack on their own previous result, so you can move them as much as you like and go back to exactly 1.00.
2. **Girth first.** Each vertex is pushed away from the segment of each bone it is weighted to, by `weight × (girth − 1)`.
3. **Vertices follow the bones by their weights** (linear blend skinning from the original rest to the temporary skeleton).
   Joints bend smoothly because a vertex near the elbow is pulled by both bones.
4. **Feet stay on the floor.** The lowest point is moved back to where the original's lowest point was.
5. **Bake into a new skeleton without scale.** Joints get their new positions, keep their original rest rotations, and every scale
   goes back to 1 — the change now lives in the vertices. A skeleton without scale exports cleanly to GLB / Unity and retargets
   normally.
6. **Clips are rebuilt.** Clip positions are stored as *offsets from the original rest*, then added to the new rest. Rotations are
   untouched. So a walk still walks on longer legs. (For clips made in code, `scaleWithLegs` scales the hip bounce with the
   new leg length, and `ground: 'lock' | 'clamp'` re-plants the feet every frame.)

### 4.4 Limits worth knowing

- **Models made of separate rigid parts** (each piece weighted 100% to one bone) open gaps at the joints when a `length` slider
  stretches them — the pieces move, they do not stretch. Smooth-skinned characters do not have this. Use `size` on such models,
  or re-skin the joints.
- Girth uses the segment from a bone to its **first** child. A bone whose first child points sideways (a hand bone whose first child is
  the thumb) bulges oddly — that is why the hand has `size`, not `girth`.
- Extreme values (below 0.7 or above 1.4 on lengths) stretch the weight blend zone at the joints. Check the edge flow view.
- Exactness is only measured at the original proportions — the page says so while sliders are moved.

## 5. Presets

A preset is a JSON file in `workspace/presets/<model>/<name>.json`:

```json
{
  "base": "Hero", "source": "Hero.fbx",
  "sliders": { "headSize": 1.25, "legLength": 0.9, "armGirth": 1.1 },
  "mods": { "size": { "Head": 1.25 }, "length": { "LeftLeg": 0.9, "LeftFoot": 0.9 }, "girth": { "LeftArm": 1.1 } },
  "sizeCm": { "w": 52.1, "h": 46.3, "d": 12.0 },
  "shade": { "mode": "toon", "steps": 2, "dark": 0.55, "outlineMm": 2 },
  "name": "chibi", "model": "Hero", "saved": "2026-01-01T00:00:00.000Z"
}
```

- `sliders` = what you set (by slider id). `mods` = the bone changes those sliders make on **this** rig — a game can use `mods`
  without knowing about sliders or roles.
- `sizeCm` = the bounding box after reshaping, for checking against a design sheet.
- Presets of one model are a family: "base", "chibi", "tall", "heavy"… Keep one per body type and build new characters from the
  closest one instead of starting from 1.00.

**Use a preset in your own three.js code**

```js
import { loadClone, modsFromSliders } from './models/clone.js';
const C = await loadClone('workspace/clones/Hero.json', { texture: 'workspace/fbx/Hero_Texture.png' });
const P = await (await fetch('workspace/presets/Hero/chibi.json')).json();
C.reshape(P.mods);                                        // or: C.reshape(modsFromSliders(C.data.bones, C.roles, P.sliders))
scene.add(C.root);
const mixer = new THREE.AnimationMixer(C.root);
mixer.clipAction(C.clips.Idle).play();
```

Or skip the runtime cost: open the page, load the preset and press **⬇ GLB** — the GLB already has the new body, rig and clips.

## 6. Checklist before you trust a clone

1. `npm run clone -- <Name>` printed no `[WARN]` (missing bones in a clip file, mesh without UV).
2. Every role is right (or knowingly missing).
3. Exactness < 0.1 mm for every clip.
4. Edge flow view looks like the artist's mesh (no stray triangles fanning across faces).
5. After reshaping, play every clip from the side view: feet on the floor, no joint collapsing.
