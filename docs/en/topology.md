# Topology

"The topology is messy" is easy to say and hard to fix. This page turns it into numbers, then into a pipeline.

## 1. Measure

```bash
blender -b --factory-startup -P tools/topo/audit.py -- out.json mine.glb reference.fbx
```

| Number | Meaning | Good |
|---|---|---|
| **wasted edges (5°)** | % of triangles Limited Dissolve can remove without changing the shape | < 5 % |
| **skinny triangles** | longest edge² / (2·area) > 10 — the "crumpled / shards" look | outer surface < 10 % |
| **open / non-manifold edges** | holes and broken joins | 0 (unless the model is intentionally open) |
| **UV islands · texel spread** | how fragmented the UV is, how even the texel density is | spread close to 1 |

Distance to a reference (both ways, cm):

```bash
blender -b --factory-startup -P tools/topo/dump.py -- reference.fbx ref.json
blender -b --factory-startup -P tools/topo/dump.py -- mine.glb mine.json
python tools/topo/dist.py ref.json <refObjectName> mine.json
```
`ours->ref` = how far your surface sticks out · `ref->ours` = parts of the reference you do not cover.
Look at pictures too: `tools/topo/render.py` (several angles) and `tools/topo/sheet.py` (3-view wireframe, UV over texture).

## 2. What good low-poly does (lessons that held up)

1. **Triangles follow curvature.** Big flat triangles where the surface is flat, small ones only where it bends. A uniform grid wastes edges everywhere.
2. **The outside gets the budget.** A good hard-surface model spends ~3–4× more triangles on the visible outer surface than on the inside of a plate.
3. **Edges sit on creases and color borders.** A face that straddles a crease looks crumpled; a color border in the middle of a face needs extra cuts.
4. **Never move a vertex off its plane to make a line prettier.** Smooth color borders *inside* their plane, or *along* their crease — anything else bends flat faces.
5. **Hue, not brightness, for baked textures.** Textures with baked shading turn dark gold into "grey" if you compare RGB; hue survives shadows.
6. **Normals are where you beat the reference.** Flat shading everywhere looks cheap on curved metal. Hard edges on ridges and trims + soft (weighted) normals on curves = clean metal with crisp details.

## 3. Rebuild a reference as studio data

```bash
npm run retopo -- ref/helmet.fbx Helmet ref/helmet_basecolor.png Helmet \
   --classes gold:25-65,blue:185-260 --snap gold
```

Steps (`tools/topo/retopo.py`): flat-subdivide the reference → read color per point (hue masks blurred inside UV islands, averaged across UV seams)
→ **cut the faces exactly where a color crosses 0.5** (vertices never move) → raised details listed in `--snap` take the color of the whole
reference face (crisp emblems) → merge tiny color islands → smooth color borders in-plane, lock sharp corners → dissolve coplanar same-color faces
→ weighted normals (`tools/topo/normals.py`).

Output `workspace/retopo/Helmet_tris.js`. Use it in a model:

```js
import { fromTris } from '../models/kit.js';
import { themed } from '../models/themes.js';
import { TRIS } from './retopo/Helmet_tris.js';
export const info = { id:'helmet', name:'Helmet', exportName:'Helmet', set:'Armor' };
const ROLE = { base:'steel', gold:'trim', blue:'panel' };
export function build(theme){ return fromTris(TRIS, themed({ base:{ c:'#ccc' }, gold:{ c:'#da5' }, blue:{ c:'#35a' } }, ROLE, theme)); }
```

| Option | Effect |
|---|---|
| `--classes name:hueLo-hueHi,...` | which colors become slots (hue in degrees: gold ≈ 25–65, blue ≈ 185–260, red ≈ 340–20 needs two classes) |
| `--sat 0.22` | minimum saturation to count as colored |
| `--subdiv 1` · `--refine 1` | resolution of the color cut (refine only subdivides faces a color edge crosses) |
| `--blur 3` | smoother color lines (pixels) |
| `--snap gold --snap-share 0.8` | crisp raised details |
| `--smooth 6` · `--corner 110` | border smoothing passes · corners sharper than this stay locked |
| `--target N` | optional triangle budget (collapses only inside color areas) |
| `--normals weighted --angle 35` | normals mode and sharp angle |

## 4. Things that did NOT work (save yourself the time)

- **Voxel remesh** of a thin plate: huge (tens of thousands of faces), slow, and decimation got stuck. Flat subdivision is enough.
- **Moving / welding border vertices** to simplify color lines: bends the planes → "melted" look.
- **Relaxing interior vertices** (retopo-style relax): triangles get prettier but creases flatten and accuracy drops.
- **Painting per small face then smoothing**: stair-step borders that cannot smooth across creases. Contour cutting fixes it.
- **Snapping every color per whole face**: great for raised emblems, destroys thin painted stripes — limit it with `--snap`.
