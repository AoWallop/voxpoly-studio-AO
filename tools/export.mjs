// Export a studio model → GLB → FBX (Unity-ready) + textures for every color theme + a Smart-UV set.
//   npm run export -- <modelId> [--set <Folder>] [--uv-size 1024] [--uv-themes ThemeA,ThemeB] [--no-uv]
// Output (export/ is git-ignored):
//   export/<Set>/<Name>.glb, <Name>.fbx, Textures/<Name>_<Theme>_Albedo|MetallicSmoothness|Emission.png   (palette UV)
//   export/<Set>_UV/<Name>.fbx + baked textures + AO + UV layout PNG + preview                          (Smart UV)
//   rigged models (bones + clips): export/<Set>_UV/<Name>.fbx (avatar) + <Name>@<clip>.fbx (one clip per file)
// Next step: npm run send -- <Set>
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, blender, python } from './lib/env.mjs';
import { headless } from './headless.mjs';

const a = process.argv.slice(2);
const opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
const id = a.find(x => !x.startsWith('--') && !a[a.indexOf(x) - 1]?.startsWith('--'));
if(!id){ console.log('usage: npm run export -- <modelId> [--set <Folder>] [--uv-size 1024] [--uv-themes A,B] [--no-uv]'); process.exit(1); }
const OUT = path.join(ROOT, 'export');

console.log(`▶ 1/3 build "${id}" in headless browser`);
const log = await headless(`index.html?export=${encodeURIComponent(id)}`, { out:OUT });
const ex = log.find(l => l.startsWith('LOG: EXPORT'))?.match(/EXPORT (\S+) dir=(\S+)/);
if(!ex) throw new Error('export did not report a file name');
const [, NAME, autoDir] = ex, DIR = opt('--set') || autoDir;
if(DIR !== autoDir){ fs.mkdirSync(path.join(OUT, DIR), { recursive:true }); fs.cpSync(path.join(OUT, autoDir), path.join(OUT, DIR), { recursive:true }); }
const src = path.join(OUT, DIR), uvOut = path.join(OUT, DIR + '_UV'), size = opt('--uv-size') || '1024';
const skinned = log.some(l => l.startsWith('LOG: SKIN'));

if(skinned){
  console.log('▶ 2/3 rigged model → avatar FBX + one FBX per clip (Smart UV + bake)');
  const pal = path.join(src, 'Textures', fs.readdirSync(path.join(src, 'Textures')).find(f => f.endsWith('_Albedo.png')).replace(/_Albedo\.png$/, ''));
  await blender('tools/blender/anim_export.py', [path.join(src, NAME + '.glb'), uvOut, NAME, pal, size]);
  await python('tools/uv_layout.py', [path.join(uvOut, NAME + '_uv.json'), path.join(uvOut, 'Textures', NAME + '_UVLayout.png')]);
  const clips = fs.readdirSync(uvOut).filter(f => f.startsWith(NAME + '@') && f.endsWith('.fbx')).map(f => path.join(uvOut, f));
  console.log('▶ 3/3 check clips (keys + bone paths as Unity sees them)');
  await python('tools/fbx_check.py', [path.join(uvOut, NAME + '.fbx'), ...clips]);
} else {
  console.log('▶ 2/3 GLB → FBX (meters · Y-up · no leftover rotation)');
  await blender('tools/blender/glb_to_fbx.py', [path.join(src, NAME + '.glb'), path.join(src, NAME + '.fbx')]);
  if(a.includes('--no-uv')) console.log('▶ 3/3 skipped (--no-uv)');
  else {
    console.log('▶ 3/3 Smart UV + bake every theme onto one UV set');
    const tex = path.join(src, 'Textures'), want = opt('--uv-themes')?.split(',');
    const pals = fs.readdirSync(tex).filter(f => f.startsWith(NAME) && f.endsWith('_Albedo.png')).map(f => f.replace(/_Albedo\.png$/, ''))
      .filter(p => !want || want.some(t => p.endsWith('_' + t))).map(p => path.join(tex, p));
    await blender('tools/blender/smart_uv_bake.py', [path.join(src, NAME + '.glb'), pals.join(','), uvOut, NAME, size]);
    await python('tools/uv_layout.py', [path.join(uvOut, NAME + '_uv.json'), path.join(uvOut, 'Textures', NAME + '_UVLayout.png')]);
  }
}
console.log(`✔ done → export/${DIR}/  ·  next: npm run send -- ${DIR}`);
