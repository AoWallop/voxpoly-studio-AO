// Leak scan — run before every push:   node tools/scan-public.mjs
// Checks every file git would publish (tracked + untracked, minus .gitignore) for:
//   API keys / tokens · private keys · e-mail addresses · absolute machine paths · large binaries
//   + your own private word list in scan-words.txt (git-ignored: project names, people, clients… — the list itself never goes public)
// Prints CLEAN or every hit with file:line. Exit code 1 when something is found.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT } from './lib/env.mjs';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd:ROOT, encoding:'utf8' }).split('\n').filter(Boolean);
const RULES = [
  ['api key / token', /\b(sk[-_][A-Za-z0-9_-]{16,}|xi-api-key|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[A-Za-z0-9-]{10,})/],
  ['secret assignment', /\b(api[_-]?key|secret|token|password|passwd)\b\s*[:=]\s*['"][^'"\s]{8,}['"]/i],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['e-mail', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(com|net|org|io|co|th|ai|dev)\b/],
  ['absolute path', /\b[A-Za-z]:[\\/](Users|Tools|AI-Work|Program Files[^/\\]*[\\/](?!Google|Blender))|\/Users\/[a-z]|\/home\/[a-z]/],
];
const ALLOW = [/noreply@/, /example\.(com|org)/, /Program Files\/Google\/Chrome/, /Program Files\/Blender Foundation/];
const wordsFile = path.join(ROOT, 'scan-words.txt');
const WORDS = fs.existsSync(wordsFile) ? fs.readFileSync(wordsFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#')) : [];
const SELF = path.relative(ROOT, fileURLToPath(import.meta.url)).replace(/\\/g, '/');

let hits = 0;
const report = (f, n, kind, line) => { hits++; console.log(`  ✖ ${f}:${n}  [${kind}]  ${line.trim().slice(0, 140)}`); };
for(const f of files){
  const p = path.join(ROOT, f), size = fs.statSync(p).size;
  if(size > 2_000_000){ report(f, 0, 'large file', `${(size / 1e6).toFixed(1)} MB`); continue; }
  if(/\.(png|jpe?g|webp|gif|fbx|glb|blend|mp3|wav|zip)$/i.test(f)){ console.log(`  · binary ${f} (${(size / 1e3).toFixed(0)} KB) — check it by eye`); continue; }
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if(f !== SELF) for(const [kind, re] of RULES) if(re.test(line) && !ALLOW.some(a => a.test(line))) report(f, i + 1, kind, line);
    for(const w of WORDS) if(line.toLowerCase().includes(w.toLowerCase())) report(f, i + 1, 'private word: ' + w, line);
  });
}
console.log(`\n${files.length} files checked · private words: ${WORDS.length}${WORDS.length ? '' : ' (create scan-words.txt to add your own)'}`);
console.log(hits ? `✖ ${hits} hit(s) — fix before pushing` : '✔ CLEAN');
process.exit(hits ? 1 : 0);
