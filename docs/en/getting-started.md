# Getting started

## 1. Install

| Tool | Version | Why |
|---|---|---|
| Node.js | 18+ | the local server and the export / QC scripts (no npm packages needed) |
| Python | 3.10+ with `numpy`, `Pillow` | UV layout drawing, FBX checks, topology measurements |
| Blender | 4.2+ | FBX export, Smart UV + bake, topology tools — always run headless, you never open it |
| Chrome / Chromium / Edge | recent | builds and exports models from the studio page without a window |

```bash
pip install -r requirements.txt
```

## 2. Configure `.env`

```bash
cp .env.example .env
```
Fill in the full paths of `BLENDER` and `CHROME`. `.env` is git-ignored (paths and anything private stay on your machine).

```bash
npm run doctor
```
Every line should show ✔.

## 3. Open the studio

```bash
npm run serve
```
Open <http://localhost:8129/>. Pick a sample on the left, switch color themes, turn on the wireframe (`W`),
compare soft edges (`S`), and look at the **Texture · UV** tab on the right to see how palette coloring works.

## 4. Export

```bash
npm run export -- sample_sword      # static model
npm run export -- sample_lever      # model with bones + clips
npm run send -- Samples             # clean hand-off folder: export/Samples_SEND/
```
Back in the studio, **Exported files** now lists the FBX: click it to see the real file with the real textures.

## 5. Your own models

```bash
cp -r workspace.example workspace
```
Copy a sample from `models/samples/` into `workspace/`, fix the import paths (`'../models/kit.js'`),
and list it in `workspace/models.js`. Reload the studio — it appears at the top.
Reference images go in `ref/` (shown in the right panel). Both folders are git-ignored.

## Folder map

```
index.html, studio.js     the studio page
models/kit.js, slab.js    the modeling kit
models/themes.js          color themes
models/samples/           built-in samples (updated by git pull)
workspace/                YOUR models (ignored by git)
ref/                      YOUR reference images / FBX (ignored)
export/                   export output (ignored)
tools/                    export, QC, hand-off, topology (Node + Blender + Python)
docs/                     this documentation
```
