// Shared helpers for the Node tools: read `.env`, run Blender / Python, start the headless browser.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// --- .env (tiny parser: KEY=value per line, # comments) ---
export function loadEnv(){
  const env = { PYTHON:'python', PORT:'8129' };
  const f = path.join(ROOT, '.env');
  if(fs.existsSync(f)) for(const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)){
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if(m && m[2] !== '') env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  for(const k of ['BLENDER', 'CHROME', 'PYTHON', 'PORT']) if(process.env[k]) env[k] = process.env[k];
  return env;
}
export const ENV = loadEnv();

export function need(key, hint){
  if(!ENV[key]){ console.error(`✖ ${key} is not set. Add it to .env (see .env.example). ${hint || ''}`); process.exit(1); }
  if(['BLENDER', 'CHROME'].includes(key) && !fs.existsSync(ENV[key])){ console.error(`✖ ${key} not found at: ${ENV[key]}`); process.exit(1); }
  return ENV[key];
}

// Run a process, stream selected lines, resolve with the full output.
export function run(cmd, args, { filter = null, cwd = ROOT, quiet = false } = {}){
  return new Promise((ok, bad) => {
    const p = spawn(cmd, args, { cwd, windowsHide:true });
    let all = '';
    const onData = d => { const s = d.toString(); all += s;
      if(!quiet) for(const line of s.split(/\r?\n/)) if(line && (!filter || filter.test(line))) console.log(line); };
    p.stdout.on('data', onData); p.stderr.on('data', onData);
    p.on('error', bad);
    p.on('close', code => code === 0 ? ok(all) : bad(new Error(`${path.basename(cmd)} exited with ${code}\n${all.split(/\r?\n/).slice(-15).join('\n')}`)));
  });
}

// Blender headless: blender -b --factory-startup -P script.py -- args...
export const blender = (script, args, opts = {}) =>
  run(need('BLENDER'), ['-b', '--factory-startup', '-P', path.join(ROOT, script), '--', ...args], { filter:/^\[|Error|Traceback/, ...opts });

export const python = (script, args, opts = {}) => run(ENV.PYTHON, [path.join(ROOT, script), ...args], opts);
