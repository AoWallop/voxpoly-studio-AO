// ===== Cel shade (cartoon light steps + outline) for any three.js scene — one file, only needs three =====
// GLB / FBX can only carry standard materials, so a toon look has to be applied at display time. This does it for a whole scene.
//
//   import { applyToon } from './toon.js';
//   const T = applyToon(scene, renderer, { steps: 2, dark: .55, outline: 2 });   // once; objects added later are picked up too
//   in your loop:  T.update();          compare on / off:  T.set(false) / T.set(true)
//
// options: steps      light steps (2–4)
//          dark       brightness of the darkest step (0–1)
//          outline    outline width in screen pixels (0 = none) · outlineColor
//          outlineMax thickest outline in meters (default 6 mm) → far / small objects get thinner lines instead of black blobs
//          unlitDark  darkest step for Unlit (MeshBasic) models that already have shading painted in (default .8, avoids double shadow)
//          filter(mesh) → false = leave this mesh alone · outlineFilter(mesh) → false = no outline (an outline draws the mesh a second time)
// Skipped automatically: glowing materials (emissive) · not tone-mapped (UI, signs, lights) · BackSide (sky) · lines / points ·
//                        mostly transparent · particles (depthWrite: false) · anything under an object with userData.noToon = true
import * as THREE from 'three';

function gradient(steps, dark) {
  const n = Math.max(2, Math.round(steps)), a = new Uint8Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.round(255 * (dark + (1 - dark) * i / (n - 1)));
  const t = new THREE.DataTexture(a, n, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
const glows = m => (m.emissive && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0) || m.toneMapped === false || m.side === THREE.BackSide || (m.transparent && m.opacity < .6) || m.blending === THREE.AdditiveBlending || m.fog === false
  || m.depthWrite === false;   // particles / effects almost always turn depthWrite off
const marked = n => { for (let p = n; p; p = p.parent) if (p.userData?.noToon) return true; return false; };

export function applyToon(root, renderer, o = {}) {
  const opt = { steps: 2, dark: .55, unlitDark: .8, outline: 2, outlineColor: '#15131c', filter: null, outlineFilter: null, ...o };
  const back = new Map(), seen = new WeakSet();   // toon material → original (a clone made after conversion arrives with the toon one)
  const gLit = gradient(opt.steps, opt.dark), gUnlit = gradient(opt.steps, opt.unlitDark), cache = new Map();
  const size = new THREE.Vector2(), px = { value: 0 }, wmax = { value: opt.outlineMax ?? .006 };
  // outline: draw the mesh again, back faces only, pushed out along the normal in SCREEN space → near = constant pixels, far = capped in meters
  const olMat = new THREE.MeshBasicMaterial({ color: opt.outlineColor, side: THREE.BackSide });
  olMat.onBeforeCompile = sh => { sh.uniforms.olPx = px; sh.uniforms.olMax = wmax;
    sh.vertexShader = 'uniform float olPx, olMax;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  vec4 nClip = projectionMatrix * vec4( normalize( normalMatrix * normal ), 0.0 );
  if ( dot( nClip.xy, nClip.xy ) > 1e-8 ) gl_Position.xy += normalize( nClip.xy ) * min( olPx * gl_Position.w, olMax * projectionMatrix[ 1 ][ 1 ] );`); };
  const olSkin = olMat.clone(); olSkin.onBeforeCompile = olMat.onBeforeCompile;
  const toonOf = m => { if (cache.has(m)) return cache.get(m);
    const unlit = m.isMeshBasicMaterial, t = new THREE.MeshToonMaterial({ color: m.color, map: m.map, vertexColors: m.vertexColors, gradientMap: unlit ? gUnlit : gLit,
      transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side, fog: m.fog, name: (m.name || '') + ' (toon)' });
    cache.set(m, t); back.set(t, m); return t; };
  const done = [];
  function scan() {
    root.traverse(n => { if (!n.isMesh || seen.has(n) || n.userData.isOutline) return; seen.add(n);
      const un = m => back.get(m) || m; if (Array.isArray(n.material)) n.material = n.material.map(un); else n.material = un(n.material);
      const ms = Array.isArray(n.material) ? n.material : [n.material];
      if (ms.some(glows) || marked(n) || (opt.filter && !opt.filter(n))) return;
      const orig = n.material, toon = Array.isArray(orig) ? orig.map(toonOf) : toonOf(orig);
      if (!n.geometry.attributes.normal) n.geometry.computeVertexNormals();
      let ol = n.children.find(c => c.userData.isOutline) || null;   // a clone may already carry its outline
      if (!ol && opt.outline > 0 && (!opt.outlineFilter || opt.outlineFilter(n))) {
        ol = n.isSkinnedMesh ? new THREE.SkinnedMesh(n.geometry, olSkin) : new THREE.Mesh(n.geometry, olMat);
        if (n.isSkinnedMesh) ol.bind(n.skeleton, n.bindMatrix);
        ol.userData.isOutline = true; ol.raycast = () => {}; ol.renderOrder = n.renderOrder; n.add(ol); }
      done.push({ n, orig, toon, ol }); n.material = on ? toon : orig; if (ol) ol.visible = on; });
  }
  let on = true, last = -1;
  const api = {
    /** every frame: outline width follows the canvas size · new objects in the scene are converted (every 0.5 s) */
    update(now = performance.now()) { renderer.getDrawingBufferSize(size); px.value = opt.outline * 2 / Math.max(1, size.y) * renderer.getPixelRatio();
      if (now - last > 500) { last = now; scan(); } },
    set(v) { on = v; for (const d of done) { d.n.material = on ? d.toon : d.orig; if (d.ol) d.ol.visible = on; } },
    get on() { return on; },
    stats() { return { meshes: done.length, outlines: done.filter(d => d.ol).length }; },
  };
  api.update(); return api;
}
