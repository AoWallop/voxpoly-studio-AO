// Motion + sound tools. Put your FBX files (with animation) in workspace/fbx/ — everything reads from there.
//   npm run motion -- dump [file.fbx]          FBX → bone positions per frame       → workspace/motion/<file>.json   (no file = every FBX in workspace/fbx/)
//   npm run motion -- rig <dump.json>           guess which bone is hips/head/hands…  → workspace/motion/<name>.rig.json  (open it and fix it!)
//   npm run motion -- channels <rig.json> [dumps…]   overall body pose per clip      → workspace/motion/<name>_channels.js (use with models/motion.js)
//   npm run cues -- <rig.json> [dumps…]              sound moments per clip          → workspace/cues/<name>.json + .html
// [dumps…] omitted = every .json dump in workspace/motion/ (rig files excluded).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, blender, python } from './lib/env.mjs';

const W = path.join(ROOT, 'workspace'), FBX = path.join(W, 'fbx'), MOT = path.join(W, 'motion'), CUE = path.join(W, 'cues');
for(const d of [FBX, MOT, CUE]) fs.mkdirSync(d, { recursive:true });
const [cmd, ...args] = process.argv.slice(2);
const rel = p => path.relative(ROOT, p);
const resolveIn = (p, dir) => fs.existsSync(p) ? path.resolve(p) : path.join(dir, p);
const allDumps = () => fs.readdirSync(MOT).filter(f => f.endsWith('.json') && !f.endsWith('.rig.json')).map(f => path.join(MOT, f));
const nameOf = rig => JSON.parse(fs.readFileSync(rig, 'utf8')).name || path.basename(rig).replace(/\.rig\.json$/, '');

if(cmd === 'dump'){
  const files = args[0] ? [resolveIn(args[0], FBX)] : fs.readdirSync(FBX).filter(f => /\.fbx$/i.test(f)).map(f => path.join(FBX, f));
  if(!files.length){ console.log(`put FBX files in ${rel(FBX)}/ first`); process.exit(1); }
  for(const f of files) await blender('tools/motion/dump.py', [f, path.join(MOT, path.basename(f).replace(/\.fbx$/i, '.json')), args[1] || '30']);
  console.log(`✔ dumps in ${rel(MOT)}/ · next: npm run motion -- rig ${rel(MOT)}/<file>.json`);
} else if(cmd === 'rig'){
  if(!args[0]){ console.log('usage: npm run motion -- rig <dump.json>'); process.exit(1); }
  const dump = resolveIn(args[0], MOT), out = path.join(MOT, path.basename(dump).replace(/\.json$/, '').split('@')[0] + '.rig.json');   // Name@clip → Name.rig.json (one rig for all clips)
  if(fs.existsSync(out) && !args.includes('--force')){ console.log(`${rel(out)} exists (use --force to overwrite)`); process.exit(1); }
  await python('tools/motion/rig.py', [dump, out]);
  console.log(`✔ ${rel(out)} — check every role, then: npm run motion -- channels ${rel(out)}`);
} else if(cmd === 'channels' || cmd === 'cues'){
  if(!args[0]){ console.log(`usage: npm run ${cmd === 'cues' ? 'cues' : 'motion'} -- ${cmd === 'cues' ? '' : 'channels '}<rig.json> [dumps…]`); process.exit(1); }
  const rig = resolveIn(args[0], MOT), dumps = args.length > 1 ? args.slice(1).map(p => resolveIn(p, MOT)) : allDumps(), name = nameOf(rig);
  if(cmd === 'channels'){
    const out = path.join(MOT, name + '_channels.js');
    await python('tools/motion/channels.py', [rig, out, ...dumps]);
    console.log(`✔ ${rel(out)} · use: import { CLIPS } from '../workspace/motion/${name}_channels.js' + sampleClip() from models/motion.js`);
  } else {
    const prefix = path.join(CUE, name);
    await python('tools/sound/cues.py', [rig, prefix, ...dumps]);
    console.log(`✔ ${rel(prefix)}.json + .html · open http://localhost:<PORT>/workspace/cues/${name}.html (npm run serve)`);
  }
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).join('\n'));
}
