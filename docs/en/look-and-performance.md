# Cel shade and render cost

[ภาษาไทย](../th/look-and-performance.md)

Two small modules for any three.js page or game: a cartoon look you can switch on for a whole scene, and a meter that shows what the
scene costs to draw. Both only need `three`.

## 1. Cel shade — `models/toon.js`

GLB and FBX can only carry standard materials, so a toon look has to be applied when the scene is shown. One call converts the whole
scene, including objects you add later and skinned characters.

```js
import { applyToon } from './models/toon.js';
const T = applyToon(scene, renderer, { steps: 2, dark: .55, outline: 2 });
function loop(){ T.update(); renderer.render(scene, camera); }
T.set(false);   // compare with the original materials
```

| Option | Meaning |
|---|---|
| `steps` | light steps, 2–4 (2 = classic two-tone) |
| `dark` | brightness of the darkest step, 0–1 |
| `outline` | outline width in **screen pixels** (0 = none) · `outlineColor` |
| `outlineMax` | thickest outline in **meters** (default 0.006) — far or small objects get thin lines instead of black blobs |
| `unlitDark` | darkest step for Unlit models that already have shading painted in (default 0.8, avoids a double shadow) |
| `filter(mesh)` / `outlineFilter(mesh)` | return false to skip a mesh / to skip only its outline |

**What it leaves alone:** glowing materials (emissive), anything not tone-mapped (UI, signs, light beams), BackSide (sky), lines and
points, mostly transparent materials, particles (`depthWrite: false`), and anything under an object with `userData.noToon = true`.

**How the outline works:** the mesh is drawn a second time, back faces only, pushed outwards along its normal in screen space.
Skinned meshes get a skinned outline, so it follows the animation.

**Costs and limits**
- Every outlined mesh is one more draw call and its triangles drawn twice. Use `outlineFilter` to skip small props.
- Hard-edged models (flat normals, split vertices on every corner) show small gaps at the corners of the outline. Smooth or
  weighted normals avoid that.
- Toon materials ignore metalness / roughness — metal looks like paint. Give metal its own brighter color instead.

## 2. Render cost meter — `models/perf.js`

`nav.js` loads it on every studio page: a box in the bottom-right corner shows **draw calls**, **triangles** and **fps**.
Press **P** to hide it. Scripts and QC runs can read `window.__perf` (`draws`, `tris`, `fps`, `peakDraws`, `peakTris`).

It counts the real WebGL draw commands, so shadows, toon outlines and several canvases are all included.
Colors: green = within budget, yellow = up to 1.5× budget, red = over.

| Budget (standalone VR headset) | |
|---|---|
| draw calls per frame | about 80 |
| triangles per frame | about 150 000 |

Draw calls usually hurt before triangles do: 300 small meshes of 20 triangles each cost far more than one mesh of 6 000.
Merge static parts that share a material, and be careful with outlines and shadow-casting lights (each multiplies the draws).

In your own page: `import './models/perf.js';` once, before or after creating the renderer.
Headless browsers report a meaningless fps; draw and triangle counts are reliable.
