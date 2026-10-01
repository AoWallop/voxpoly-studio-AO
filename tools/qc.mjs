// Screenshot every model (or one) from several angles — a quick visual check before export.
//   npm run qc               → all models
//   npm run qc -- <modelId>  → one model
// Images: .qc/shots/<modelId>-<view>.png
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/env.mjs';
import { headless } from './headless.mjs';

const only = process.argv[2];
const out = path.join(ROOT, '.qc', 'shots'); fs.rmSync(out, { recursive:true, force:true }); fs.mkdirSync(out, { recursive:true });
await headless('index.html?qc=1' + (only ? '&only=' + encodeURIComponent(only) : ''), { out });
console.log(`✔ ${fs.readdirSync(out).length} images → ${path.relative(ROOT, out)}`);
