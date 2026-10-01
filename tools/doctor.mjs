// Check that this machine has everything the studio needs.   npm run doctor
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ENV, run } from './lib/env.mjs';

const ok = m => console.log('  ✔ ' + m), bad = m => { console.log('  ✖ ' + m); fails++; };
let fails = 0;
console.log('VoxPoly Studio — environment check');
fs.existsSync(path.join(ROOT, '.env')) ? ok('.env found') : bad('.env missing → copy .env.example to .env and fill in the paths');
+process.versions.node.split('.')[0] >= 18 ? ok('Node ' + process.versions.node) : bad('Node 18+ required (found ' + process.versions.node + ')');
for(const k of ['BLENDER', 'CHROME']) ENV[k] && fs.existsSync(ENV[k]) ? ok(`${k} = ${ENV[k]}`) : bad(`${k} not set or not found (${ENV[k] || 'empty'})`);
try{ const v = await run(ENV.PYTHON, ['-c', 'import numpy, PIL, sys; print(sys.version.split()[0])'], { quiet:true }); ok('Python ' + v.trim() + ' + numpy + Pillow'); }
catch(e){ bad(`Python with numpy + Pillow not found (${ENV.PYTHON}) → pip install -r requirements.txt`); }
if(ENV.BLENDER && fs.existsSync(ENV.BLENDER)){
  try{ const v = await run(ENV.BLENDER, ['-b', '--factory-startup', '--version'], { quiet:true }); ok((v.match(/Blender [\d.]+/) || ['Blender ?'])[0]); }
  catch(e){ bad('Blender did not start'); }
}
fs.existsSync(path.join(ROOT, 'workspace')) ? ok('workspace/ exists (your own models)') : console.log('  · workspace/ not created yet (optional) → copy workspace.example to workspace');
console.log(fails ? `\n${fails} problem(s) — see docs/en/getting-started.md` : '\nAll good. Run: npm run serve');
process.exit(fails ? 1 : 0);
