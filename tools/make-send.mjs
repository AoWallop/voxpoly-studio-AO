// Assemble a clean hand-off folder export/<Set>_SEND/ from the Smart-UV set export/<Set>_UV/.
//   npm run send -- <Set>
// - wipes old files first (stale files are the #1 hand-off mistake) but keeps a hand-written README_Unity.md
// - avatar FBX at the root · <Name>@<clip>.fbx → Animations/ · textures + AO → Textures/ · UV layout → UVLayout/ · previews → Preview/
// - leaves out work files (.glb, .json) · if there are clips, re-checks them with tools/fbx_check.py
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, python } from './lib/env.mjs';

const SET = process.argv[2];
if(!SET){ console.log('usage: npm run send -- <Set>'); process.exit(1); }
const SRC = path.join(ROOT, 'export', SET + '_UV'), D = path.join(ROOT, 'export', SET + '_SEND');
if(!fs.existsSync(SRC)){ console.error(`✖ ${SRC} not found — run: npm run export -- <modelId> first`); process.exit(1); }

fs.mkdirSync(D, { recursive:true });
for(const f of fs.readdirSync(D, { recursive:true })){ const p = path.join(D, f); if(fs.statSync(p).isFile() && path.basename(p) !== 'README_Unity.md') fs.rmSync(p); }
const put = (from, sub) => { const d = path.join(D, sub); fs.mkdirSync(d, { recursive:true }); fs.copyFileSync(from, path.join(d, path.basename(from))); };

for(const f of fs.readdirSync(SRC)){
  const p = path.join(SRC, f);
  if(f.endsWith('.fbx')) put(p, f.includes('@') ? 'Animations' : '.');
  else if(f.endsWith('_preview.png')) put(p, 'Preview');
}
const tex = path.join(SRC, 'Textures');
if(fs.existsSync(tex)) for(const f of fs.readdirSync(tex)) put(path.join(tex, f), f.endsWith('_UVLayout.png') ? 'UVLayout' : 'Textures');
if(!fs.existsSync(path.join(D, 'README_Unity.md'))) console.log(`⚠ no README_Unity.md in ${path.relative(ROOT, D)} — write one before sending (template: docs/en/export-unity.md)`);

const anims = path.join(D, 'Animations');
if(fs.existsSync(anims)) for(const av of fs.readdirSync(D).filter(f => f.endsWith('.fbx'))){
  const n = av.replace(/\.fbx$/, ''), clips = fs.readdirSync(anims).filter(f => f.startsWith(n + '@')).map(f => path.join(anims, f));
  if(clips.length) await python('tools/fbx_check.py', [path.join(D, av), ...clips]);
}
const files = fs.readdirSync(D, { recursive:true }).filter(f => fs.statSync(path.join(D, f)).isFile()).sort();
console.log(`[SEND] ${path.relative(ROOT, D)} · ${files.length} files`); files.forEach(f => console.log('  ' + f));
