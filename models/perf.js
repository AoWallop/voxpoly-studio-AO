// ===== Render cost meter: draw calls / triangles / fps in the corner of every page =====
// Counts the real WebGL draw commands (works with any renderer, includes shadows, toon outlines, several canvases).
//   draws = draw commands per frame — what makes a headset stutter (VR budget ≈ 80)
//   tris  = triangles actually drawn per frame (budget ≈ 150k) · fps = frames drawn per second
// nav.js loads it on every page · press P to hide / show · scripts can read window.__perf
// Pages that only redraw on change keep the numbers of the last drawn frame.
const BUDGET = { draws: 80, tris: 150000 };
const P = window.__perf = { draws: 0, tris: 0, fps: 0, peakDraws: 0, peakTris: 0, frames: 0, budget: BUDGET };
let cd = 0, ct = 0;
const TRI = 4, STRIP = 5, FAN = 6;
const tris = (mode, n) => mode === TRI ? n / 3 : (mode === STRIP || mode === FAN) ? Math.max(0, n - 2) : 0;
for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
  if (!C || C.prototype.__vpPerf) continue;
  C.prototype.__vpPerf = true;
  const wrap = (name, cnt, inst) => {
    const f = C.prototype[name]; if (!f) return;
    C.prototype[name] = function (...a) {
      cd++; ct += tris(a[0], a[cnt]) * (inst ? a[inst] : 1);
      return f.apply(this, a);
    };
  };
  wrap('drawArrays', 2); wrap('drawElements', 1);
  wrap('drawArraysInstanced', 2, 3); wrap('drawElementsInstanced', 1, 4);
  wrap('drawRangeElements', 3);
}
let last = performance.now(), cnt = 0;
function tick(now) {
  if (cd) {
    P.draws = cd; P.tris = Math.round(ct); P.frames++; cnt++;
    if (cd > P.peakDraws) P.peakDraws = cd;
    if (P.tris > P.peakTris) P.peakTris = P.tris;
    cd = 0; ct = 0;
  }
  if (now - last >= 500) {
    P.fps = Math.round(cnt * 1000 / (now - last));
    cnt = 0; last = now; show();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ----- corner HUD (hidden in QC / export runs so screenshots stay clean · ?perf=1 forces it) -----
const q = new URLSearchParams(location.search);
const quiet = ['qc', 'export'].some(k => q.has(k)) && !q.has('perf');
let el = null, on = true;
try { on = localStorage.getItem('vpPerf') !== '0'; } catch (e) {}
if (!quiet) {
  el = document.createElement('div'); el.id = 'vpPerf';
  el.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:60;padding:6px 10px;border-radius:6px;' +
    'background:#0d0b12d9;border:1px solid #ffffff22;font:600 12px/1.45 Consolas,monospace;color:#c8cfdb;pointer-events:none;white-space:pre';
  el.title = 'P = hide / show';
  document.body.appendChild(el);
  addEventListener('keydown', e => {
    if ((e.key === 'p' || e.key === 'P') && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
      on = !on; try { localStorage.setItem('vpPerf', on ? '1' : '0'); } catch (err) {} show();
    }
  });
}
const fmt = n => n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k' : String(n);
const tag = (v, b) => `<span style="color:${v <= b ? '#7fe0a0' : v <= b * 1.5 ? '#f0c874' : '#ff8a7a'}">${fmt(v)}</span>`;
function show() {
  if (!el) return;
  el.style.display = on ? '' : 'none'; if (!on) return;
  el.innerHTML = `draw ${tag(P.draws, BUDGET.draws)} <span style="color:#b0b8c8">/ ${BUDGET.draws}</span>\n` +
    `tri  ${tag(P.tris, BUDGET.tris)} <span style="color:#b0b8c8">/ ${fmt(BUDGET.tris)}</span>\n` +
    `${P.fps} fps`;
}
