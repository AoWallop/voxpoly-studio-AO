# CLAUDE.md — working guide for Claude Code in this repo

VoxPoly Studio builds game-ready low-poly models in code (three.js), exports them to FBX for Unity, and studies topology from references.
Answer the user in the language they write in (Thai or English).

## Where things go
- **User models → `workspace/`** (git-ignored). Never put user work in `models/samples/` — that folder is updated by `git pull`.
  If `workspace/` does not exist: `cp -r workspace.example workspace`.
- Reference images / FBX → `ref/` (git-ignored). Export output → `export/` (git-ignored).
- Secrets (API keys) → `.env` only. Never write a key into any other file.

## Making a model
1. Read `docs/en/modeling-kit.md` and the closest sample in `models/samples/`.
2. Ask for (or measure from references) real-world size; meters, pivot at the grip / hinge, +Y up, +Z front.
3. Write `workspace/<name>.js` (copy a sample, fix imports to `'../models/...'`), list it in `workspace/models.js`.
4. Check: `node --input-type=module --check < workspace/<name>.js` (plain `node --check` misses ES-module errors).
5. Look at it: `npm run qc -- <id>` → images in `.qc/shots/` (front / side / top / back / wireframe). Look from the top too.
6. Budget: count triangles (`K.triCount()` while building, HUD in the studio). Spend them where the silhouette bends.

## Exporting (do not skip steps)
1. `npm run export -- <id>` · read every `[CHECK]` line · rigged models must print `[FBXCHECK] OK`.
2. `npm run send -- <Set>` · the printed list is exactly what is delivered.
3. Write `README_Unity.md` in the SEND folder (template in `docs/en/export-unity.md`).

## Topology work
- Measure before arguing: `tools/topo/audit.py` (wasted edges %, skinny %), `tools/topo/dist.py` (cm to reference).
- Rebuild from a textured reference: `npm run retopo -- ...` (see `docs/en/topology.md`). Never move vertices off their plane to tidy a color line.

## Animation & sound from FBX
- FBX files go in `workspace/fbx/`. Flow: `npm run motion -- dump` → `npm run motion -- rig <dump>` → **read the rig file and fix every role**
  (print the bone list, compare names) → `npm run motion -- channels <rig>` and/or `npm run cues -- <rig>`.
- Check results in the FBX Viewer (`viewer.html?open=<Name>&clip=<clip>&bone=<bone>`) before trusting them; foot / hand bones are often misguessed.
- Re-use motion on our own models as channels ADDED to the model's idle pose (`models/motion.js`); never copy bone angles across rigs.
- Sound files are the user's. Keep cue times in original clip seconds; use `timePlan()` when clips are cut or sped up.

## Reporting to the user
- Describe results in what they will SEE ("the star is now crisp", "the blue rim is even"), numbers second.
- When comparing with a reference, label clearly which image is the reference and which is ours.
- Say what did not work and why, briefly.
