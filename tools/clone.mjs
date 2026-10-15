// Copy a rigged FBX (+ its clips) exactly into three.js data — then reshape it and save presets in clone.html.
//   npm run clone                    list the characters found in workspace/fbx/
//   npm run clone -- <Name>          workspace/fbx/<Name>.fbx + every <Name>@<clip>.fbx  → workspace/clones/<Name>.json
//   npm run clone -- <Name> --qc     also take screenshots (rest / clip / edges / reshaped) → .qc/clone-<Name>/
// The character is added to workspace/clones/index.json with GUESSED bone roles — read the printed table and fix
// any wrong role in that file ("roles"), the proportion sliders depend on it. See docs/en/fbx-clone.md.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, blender } from './lib/env.mjs';
import { headless } from './headless.mjs';
import { guessRoles, CENTER_ROLES, LIMB_ROLES } from '../models/rigroles.js';

const W = path.join(ROOT, 'workspace'), FBX = path.join(W, 'fbx'), OUT = path.join(W, 'clones');
for (const d of [FBX, OUT]) fs.mkdirSync(d, { recursive: true });
const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');
const args = process.argv.slice(2), name = args.find(a => !a.startsWith('--'));

const files = fs.readdirSync(FBX).filter(f => /\.fbx$/i.test(f));
const sets = {};
for (const f of files) { const [n, clip] = f.replace(/\.fbx$/i, '').split('@'); (sets[n] ||= { rig: null, clips: [] }); clip ? sets[n].clips.push([clip, f]) : sets[n].rig = f; }
if (!name) {
  if (!files.length) { console.log(`put FBX files in ${rel(FBX)}/ first (Name.fbx = rig + mesh · Name@clip.fbx = one clip each)`); process.exit(1); }
  for (const [n, s] of Object.entries(sets)) console.log(`  ${n}${s.rig ? '' : '  (no rig file — will use the first clip file)'}  · clips: ${s.clips.map(c => c[0]).join(', ') || 'none'}`);
  console.log('\nnext: npm run clone -- <Name>'); process.exit(0);
}
const S = sets[name];
if (!S) { console.log(`no ${name}.fbx or ${name}@*.fbx in ${rel(FBX)}/`); process.exit(1); }
const rig = S.rig || S.clips[0][1];
const json = path.join(OUT, name + '.json');
fs.rmSync(json, { force: true });                                     // so a failed run can never leave the old file looking fresh
await blender('tools/blender/fbx_clone.py', [path.join(FBX, rig), json, ...S.clips.map(([c, f]) => `${c}=${path.join(FBX, f)}`)]);

if (!fs.existsSync(json)) { console.log('✖ Blender did not write ' + rel(json) + ' — see the error above'); process.exit(1); }

// ---------- texture: look next to the FBX (and one folder down) for the file name the FBX points to ----------
const D = JSON.parse(fs.readFileSync(json, 'utf8'));
const findTex = n => { if (!n) return null; const c = [path.join(FBX, n), ...fs.readdirSync(FBX, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => path.join(FBX, d.name, n))];
  return c.find(p => fs.existsSync(p)) || null; };
const tex = findTex(D.texture);
if (D.texture && !tex) console.log(`  · texture "${D.texture}" not found in ${rel(FBX)}/ — copy it there and run again (the model shows grey until then)`);

// ---------- registry + guessed roles (kept if you already fixed them by hand) ----------
const regFile = path.join(OUT, 'index.json');
const reg = fs.existsSync(regFile) ? JSON.parse(fs.readFileSync(regFile, 'utf8')) : [];
const old = reg.find(r => r.id === name);
const roles = old?.roles || guessRoles(D.bones);
const entry = { id: name, name, json: rel(json), texture: tex ? rel(tex) : null, clips: Object.keys(D.clips), roles, ...(old?.preset ? { preset: old.preset } : {}) };
if (old) Object.assign(old, entry); else reg.push(entry);
fs.writeFileSync(regFile, JSON.stringify(reg, null, 1));

const k = D.counts;
console.log(`\n✔ ${rel(json)} · ${k.verts} verts · ${k.faces} faces (${k.quads} quads${k.ngons ? ' · ' + k.ngons + ' n-gons' : ''}) · ${k.bones} bones · clips: ${entry.clips.join(', ') || 'none'}`);
console.log(`\nbone roles ${old?.roles ? '(kept from index.json)' : '(GUESSED — check them)'}:`);
const row = r => console.log(`  ${r.padEnd(12)} ${roles[r] || '—  (missing: sliders using it are hidden)'}`);
CENTER_ROLES.forEach(row); for (const r of LIMB_ROLES) for (const s of ['L', 'R']) row(r + '.' + s);
console.log(`\nwrong? edit "roles" for "${name}" in ${rel(regFile)} (bone names: ${D.bones.slice(0, 60).map(b => b.name).join(', ')}${D.bones.length > 60 ? ' …' : ''})`);
console.log(`open: npm run serve → http://localhost:<PORT>/clone.html?m=${encodeURIComponent(name)}`);

if (args.includes('--qc')) {
  const out = path.join(ROOT, '.qc', 'clone-' + name); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  await headless('clone.html?qc=1&m=' + encodeURIComponent(name), { out, timeout: 240 });
  console.log(`✔ ${fs.readdirSync(out).length} images → ${rel(out)}`);
}
