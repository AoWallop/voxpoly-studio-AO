// Local server for the studio pages + a tiny "receive" API used by headless export / QC.
//   npm run serve                 → http://localhost:8129/
//   node tools/server.mjs --out <dir> --port 8130 --quiet   (used by tools/headless.mjs)
// API (POST from the page itself):
//   /__file?n=<relative path>   body = bytes or dataURL → written under <out>/
//   /__frame?n=<name>           body = PNG dataURL      → <out>/<name>.png
//   /__log?m=<message>          printed to stdout as "LOG: <message>"
//   /__preset?m=<model>&name=<preset>   body = JSON → workspace/presets/<model>/<preset>.json (+ index.json) · clone.html
//                                        names are cleaned to letters / digits / _ - so nothing is written outside that folder
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ENV } from './lib/env.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('--out', path.join(ROOT, 'export')));
const PORT = +arg('--port', ENV.PORT || 8129);
const QUIET = process.argv.includes('--quiet');
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.svg':'image/svg+xml',
  '.css':'text/css', '.md':'text/markdown; charset=utf-8', '.glb':'model/gltf-binary', '.fbx':'application/octet-stream', '.mp3':'audio/mpeg', '.wav':'audio/wav' };

const inside = (base, p) => { const r = path.relative(base, p); return r && !r.startsWith('..') && !path.isAbsolute(r); };
const readBody = req => new Promise(ok => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); });
const decode = buf => buf.subarray(0, 5).toString() === 'data:' ? Buffer.from(buf.toString().replace(/^data:[^,]*,/, ''), 'base64') : buf;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if(req.method === 'POST' && (url.pathname === '/__file' || url.pathname === '/__frame')){
    const n = url.searchParams.get('n') || 'file.bin';
    const f = path.resolve(OUT, url.pathname === '/__frame' ? n + '.png' : n);
    if(!inside(OUT, f)){ res.writeHead(400); res.end('bad path'); return; }
    const buf = decode(await readBody(req));
    fs.mkdirSync(path.dirname(f), { recursive:true }); fs.writeFileSync(f, buf);
    console.log(`${url.pathname === '/__frame' ? 'FRAME' : 'FILE'} ${n} (${buf.length} bytes)`);
    res.writeHead(200); res.end('ok'); return;
  }
  if(req.method === 'POST' && url.pathname === '/__preset'){          // clone.html "Save preset" → workspace/presets/<model>/<name>.json
    const safe = s => String(s || '').replace(/[^\p{L}\p{M}\p{N}_-]+/gu, '_').slice(0, 60) || 'preset';
    const m = safe(url.searchParams.get('m')), name = safe(url.searchParams.get('name')), dir = path.join(ROOT, 'workspace', 'presets', m);
    try{
      const data = JSON.parse((await readBody(req)).toString('utf8'));
      fs.mkdirSync(dir, { recursive:true });
      fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ ...data, name, model:m, saved:new Date().toISOString() }, null, 1));
      const list = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => f.slice(0, -5)).sort();
      fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(list));
      if(!QUIET) console.log(`PRESET ${m}/${name}`);
      res.writeHead(200, { 'content-type':'application/json' }); res.end(JSON.stringify({ ok:true, list }));
    } catch(e){ res.writeHead(400); res.end(String(e.message)); }
    return;
  }
  if(url.pathname === '/__log'){ console.log('LOG: ' + (url.searchParams.get('m') || '')); res.writeHead(200); res.end('ok'); return; }

  // static files (directory listing for folders — used by the reference-image panel)
  let p = path.resolve(path.join(ROOT, decodeURIComponent(url.pathname)));
  if(p !== path.resolve(ROOT) && !inside(ROOT, p)){ res.writeHead(403); res.end('forbidden'); return; }
  if(path.relative(ROOT, p).split(path.sep).some(s => s.startsWith('.') || s === 'scan-words.txt')){ res.writeHead(403); res.end('forbidden'); return; }   // .env · .git · private lists
  if(fs.existsSync(p) && fs.statSync(p).isDirectory()){
    if(fs.existsSync(path.join(p, 'index.html'))) p = path.join(p, 'index.html');
    else { const items = fs.readdirSync(p).map(n => `<a href="${encodeURIComponent(n)}${fs.statSync(path.join(p, n)).isDirectory() ? '/' : ''}">${n}</a>`);
      res.writeHead(200, { 'content-type':'text/html; charset=utf-8' }); res.end(items.join('\n')); return; }
  }
  fs.readFile(p, (e, d) => {
    if(e){ res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type':MIME[path.extname(p).toLowerCase()] || 'application/octet-stream', 'cache-control':'no-store' }); res.end(d);
  });
}).listen(PORT, () => { if(!QUIET) console.log(`VoxPoly Studio → http://localhost:${PORT}/`); else console.log(`SERVER ${PORT}`); });
