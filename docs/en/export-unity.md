# Export to Unity

```bash
npm run export -- <modelId> [--set Folder] [--uv-size 1024] [--uv-themes Steel,Ember] [--no-uv]
npm run send -- <Set>
```

## What happens

1. **Headless browser** builds the model and writes `export/<Set>/<Name>.glb` + palette textures for every theme
   (`<Name>_<Theme>_Albedo.png`, `_MetallicSmoothness.png` (URP: metal in R, smoothness in A), `_Emission.png`).
2. **Blender**
   - static model: GLB → `<Name>.fbx` (meters, Y-up, transform applied, normals kept), then Smart UV + bake every theme → `export/<Set>_UV/`
   - rigged model: avatar `<Name>.fbx` + `<Name>@<clip>.fbx` per clip, Smart UV + bake → `export/<Set>_UV/`
3. **Checks**: triangle count after re-import; for clips, `tools/fbx_check.py` reads the FBX binary and confirms
   every clip has keys **and** the bone paths match the avatar the way Unity sees them.
4. **`npm run send`** copies only what the engine needs into `export/<Set>_SEND/` (old files are wiped first).

## Two texture sets — which one?

| Set | UV | Use when |
|---|---|---|
| `export/<Set>/` | palette UV (points into color cells) | you only swap colors · smallest textures · crisp |
| `export/<Set>_UV/` | Smart UV + baked textures + AO + UV layout | artists will paint on top · you need AO |

## Hand-off checklist (do not skip)

1. Look at the model in the studio from front / side / top and with wireframe.
2. `npm run export` — read the `[CHECK]` lines (tris OK, no leftover rotation, scale 1).
3. Rigged: `[FBXCHECK] OK` must appear.
4. Click the exported FBX in the studio — the real file with the real textures must look the same.
5. `npm run send` — the list printed is exactly what you send. No `.glb`, no `.json`.
6. Write `README_Unity.md` in the SEND folder (template below).
7. Import into Unity once yourself before sending.

## README_Unity.md template

```md
# <Name> — Unity import
- Scale 1, meters, Y-up. Pivot = <where>.
- Material: URP/Lit · Base Map = Textures/<Name>_<Theme>_Albedo.png
  · Metallic Map = _MetallicSmoothness.png (Smoothness source: Metallic Alpha) · Emission = _Emission.png (enable Emission)
  · Occlusion = <Name>_AO.png (Smart-UV set only)
- Rigged: Rig = Generic, avatar from <Name>.fbx · clips in Animations/ (<Name>@<clip>.fbx), Loop Time on for idle.
- Triangles: <n> · Themes: <list>
```

## Common problems

| Symptom | Cause / fix |
|---|---|
| Model is grey in Unity | wrong UV set or texture not assigned — palette textures need the palette FBX, Smart-UV textures need the `_UV` FBX |
| Clip plays but nothing moves | avatar and clip files have different top nodes → bone paths differ. `fbx_check.py` catches this; re-export, do not edit by hand |
| Model lies on its back | rotation left on the object — the exporter applies transforms; if you edited the FBX elsewhere, re-export |
| Faceted shading everywhere | soft edges were not set: use `K.soft(angle)` or weighted normals (`npm run retopo`) |
