# Model Kit

A model is a small ES module:

```js
import * as THREE from 'three';
import { createKit, SECTION } from '../models/kit.js';
import { themed } from '../models/themes.js';

export const info = { id:'my_axe', name:'My Axe', note:'first try', exportName:'My_Axe', set:'Weapons' };
export const ROLE = { head:'steel', haft:'grip', band:'trim' };          // color slot → theme role

export function build(theme){
  const K = createKit(themed({
    head:{ c:'#c9d1dc', metal:.85, smooth:.7 },
    haft:{ c:'#3b2a20', metal:0,   smooth:.3 },
    band:{ c:'#d9b25a', metal:1,   smooth:.7 },
  }, ROLE, theme));
  K.add(new THREE.CylinderGeometry(.015, .017, .6, 8), 'haft', K.at(0, .1));
  K.add(new THREE.BoxGeometry(.16, .09, .02), 'head', K.at(.05, .36));
  return K.build();
}
```

## Conventions

- **Meters.** Origin = the pivot you want in the engine (grip of a weapon, hinge of a door). Up = +Y, front = +Z.
- **One mesh, one material.** Colors come from a palette texture: each triangle points its UV at the center of its color cell.
  Recoloring = a new image, no UV work. Up to 64 colors.
- **Themes** (`models/themes.js`) map *roles* to colors, so one model has many color sets with the same shape and UVs.

## Building blocks

| Call | What it does |
|---|---|
| `K.add(geometry, slot, matrix)` | any three.js geometry (Box, Cylinder, Lathe, Extrude, Octahedron …) |
| `K.loft(rings, slot)` | rings of points along Y — blades, handles, horns. A ring of identical points = a sharp tip (`SECTION.point`) |
| `K.plate(outline, depth, slot, matrix, bevel)` | a thick plate from a 2D outline |
| `makeSlab(K, grid, thickness, opts)` (`slab.js`) | a curved thick shell from a grid of points, with inner surface and closed rims |
| `K.face(a, b, c, slot, hint)` | one triangle turned toward `hint` |
| `K.at(x, y, z, rx, ry, rz, s)` · `K.mirrorX(m)` | matrix helpers |
| `K.soft(angle)` … `K.soft(0)` | soft edges for what you build in between (smooth across edges bent less than `angle`) |
| `K.newPart()` | normals never smooth across parts |
| `K.bone(i)` | rigid skin: triangles after this belong 100% to bone `i` (see `models/samples/lever.js`) |
| `K.triCount()` | count while building to see which part eats the budget |
| `fromTris(TRIS, palette)` | build a model from `npm run retopo` output |

## Topology habits that pay off

- **Let rows follow color edges.** If a trim line is a row of the grid, the color edge *is* a mesh edge — no extra loops (see `models/samples/shield.js`).
- **Spend triangles where the silhouette bends,** not on flat areas. Check with `tools/topo/audit.py` (wasted-edge %).
- **Thickness is cheap where nobody looks.** The inside of a shell can be much coarser than the outside.
- **Flat-shaded facets are a style,** soft edges are a tool: use `K.soft()` on curved metal, keep ridges and trims hard.
- **Check the scale with the hand and ruler** before polishing details.

## Bones and clips

See `models/samples/lever.js`: `BONES` (name, parent, joint, axis), `JOINTS` (pivot positions), `ANIMS`
(`{ len, loop, note, tracks:{ bone:[[time, angle], ...] } }`). Clip names are lower-case; export makes
`<Name>.fbx` (avatar) + `<Name>@<clip>.fbx` — the Unity naming convention.
