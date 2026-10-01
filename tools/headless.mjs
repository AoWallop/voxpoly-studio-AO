// Open a studio page in headless Chrome and wait until it logs DONE (or ERR).
// The page talks back through tools/server.mjs (/__file, /__frame, /__log).
//   import { headless } from './headless.mjs';  await headless('index.html?export=sample_sword', { out:'export' });
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, need } from './lib/env.mjs';

export async function headless(page, { out = path.join(ROOT, 'export'), port = 8130, timeout = 120, size = '1400,900' } = {}){
  const chrome = need('CHROME');
  const prof = path.join(ROOT, '.qc', 'chrome-profile'); fs.mkdirSync(prof, { recursive:true });
  const log = [];
  const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'server.mjs'), '--out', out, '--port', String(port), '--quiet'], { cwd:ROOT, windowsHide:true });
  await new Promise((ok, bad) => { server.stdout.once('data', ok); server.once('error', bad); });
  server.stdout.on('data', d => { for(const l of d.toString().split(/\r?\n/)) if(l){ log.push(l); if(l.startsWith('LOG:')) console.log(l.slice(5)); } });
  const browser = spawn(chrome, ['--headless=new', '--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    `--window-size=${size}`, `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', `http://localhost:${port}/${page}`], { windowsHide:true, stdio:'ignore' });
  const t0 = Date.now();
  try{
    while(!log.some(l => /^LOG: (DONE|ERR)/.test(l))){
      if(Date.now() - t0 > timeout * 1000) throw new Error(`timeout after ${timeout}s waiting for ${page}`);
      await new Promise(r => setTimeout(r, 250));
    }
  } finally {
    browser.kill(); server.kill();
  }
  const err = log.find(l => l.startsWith('LOG: ERR'));
  if(err) throw new Error(err.slice(5));
  return log;
}
