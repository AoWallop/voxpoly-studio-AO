# Changelog

Update with `git pull`. Versions follow `MAJOR.MINOR.PATCH`: MINOR = new features, PATCH = fixes, MAJOR = something you must change on your side.
อัปเดตด้วย `git pull` · เลขเวอร์ชัน `MAJOR.MINOR.PATCH`: MINOR = ของใหม่ · PATCH = แก้บั๊ก · MAJOR = มีสิ่งที่ผู้ใช้ต้องแก้ตาม

## 2.5.0 — FBX Clone, proportions & presets

The version number jumps to 2.5 to match the studio generation it comes from. Nothing you have in `workspace/` needs to change.
เลขเวอร์ชันข้ามไป 2.5 ให้ตรงกับรุ่นของสตูดิโอต้นทาง ของใน `workspace/` ไม่ต้องแก้อะไร

**EN**
- **FBX Clone** page (`clone.html`, new tab) + `npm run clone -- <Name>`: copies `workspace/fbx/<Name>.fbx` + every `<Name>@<clip>.fbx` into three.js — vertices in original order, quads kept, UV per corner, top-4 weights, rest skeleton without scale, every clip frame — and proves it: sample vertices are compared with Blender in every clip (typically 0.002–0.05 mm). Several meshes on one armature become show / hide parts.
- **Bone roles** (`models/rigroles.js`): guesses hips / spine / chest / neck / head / shoulder / upper & lower arm / hand / upper & lower leg / foot / toe for Mixamo, Unreal, Blender and plain naming; printed by `npm run clone`, fixable in `workspace/clones/index.json`.
- **Proportion system** (`models/clone.js`): 17 sliders built on roles — size · length · sizeOnly · girth · belly — always computed from the original, baked into a new skeleton without scale, feet kept on the floor, clips keep playing. `PROPORTIONS` / `modsFromSliders()` for game code.
- **Presets**: save / load slider sets per model → `workspace/presets/<model>/<name>.json` (sliders + bone mods + size in cm + shading). Server endpoint `/__preset`.
- Clone page extras: real edge-flow view, cel shade with outline in mm, UV layout / checker / transparent UV lines / OBJ for painting, GLB export of the reshaped body with rig + clips. `--qc` takes screenshots and checks floor + GLB round trip.
- **`models/toon.js`**: cel shade for any three.js scene (light steps, screen-space outline capped in meters, skinned outlines, skips glow / UI / particles, picks up objects added later).
- **`models/perf.js`**: draw calls · triangles · fps in the corner of every page (P to hide), `window.__perf` for scripts.
- Docs (EN/TH): `fbx-clone.md` (how the exact copy works, roles, the proportion maths, presets, limits) · `look-and-performance.md`.
- Fixed: duplicated rows in the README feature tables.

**TH**
- หน้า **ลอก FBX** (`clone.html` แท็บใหม่) + `npm run clone -- <Name>`: คัดลอก `workspace/fbx/<Name>.fbx` + ทุก `<Name>@<ท่า>.fbx` เข้า three.js — จุดยอดตามลำดับเดิม · คงหน้าสี่เหลี่ยม · UV ต่อมุม · น้ำหนัก 4 อันดับแรก · โครง rest ไม่มี scale · ทุกเฟรมของท่า — แล้วพิสูจน์: เทียบจุดตัวอย่างกับ Blender ทุกท่า (ปกติคลาด 0.002–0.05 มม.) · หลาย mesh บน armature เดียวกลายเป็นชิ้นที่เปิดปิดได้
- **บทบาทกระดูก** (`models/rigroles.js`): เดาสะโพก/ลำตัว/อก/คอ/หัว/ไหปลาร้า/ต้นแขน/แขนท่อนล่าง/มือ/ต้นขา/หน้าแข้ง/เท้า/นิ้วเท้า ได้ทั้งชื่อแบบ Mixamo, Unreal, Blender และแบบธรรมดา · `npm run clone` พิมพ์ให้ตรวจ · แก้ได้ใน `workspace/clones/index.json`
- **ระบบปรับสัดส่วน** (`models/clone.js`): 17 แถบ ทำงานบนบทบาท — size · length · sizeOnly · girth · belly — คำนวณจากต้นฉบับทุกครั้ง · อบลงโครงใหม่ที่ไม่มี scale · เท้าแตะพื้นเท่าเดิม · ท่ายังเล่นได้ · ใช้ในโค้ดเกมผ่าน `PROPORTIONS` / `modsFromSliders()`
- **Preset**: บันทึก/โหลดชุดค่าแถบเลื่อนต่อโมเดล → `workspace/presets/<โมเดล>/<ชื่อ>.json` (ค่าแถบ + การเปลี่ยนกระดูก + ขนาด ซม. + แสงเงา) · server เพิ่ม `/__preset`
- หน้าลอก FBX มีเพิ่ม: ดูเส้น topo จริง · cel shade เส้นขอบเป็น มม. · ผัง UV / ลายตรวจ / เส้น UV โปร่งใส / OBJ สำหรับวาด · ส่งออก GLB ตัวที่ปรับแล้วพร้อม rig และท่า · `--qc` ถ่ายภาพตรวจ + เช็กเท้าแตะพื้น + เปิด GLB กลับมาเช็ก
- **`models/toon.js`**: แสงเงาการ์ตูนสำหรับฉาก three.js ไหนก็ได้ (ขั้นแสง · เส้นขอบบนจอที่จำกัดความหนาเป็นเมตร · เส้นขอบตัวที่มี skin · ข้ามของเรืองแสง/UI/particle · แปลงของที่เพิ่มทีหลัง)
- **`models/perf.js`**: draw call · สามเหลี่ยม · fps มุมจอทุกหน้า (กด P ซ่อน) · `window.__perf` ให้สคริปต์อ่าน
- คู่มือ 2 ภาษา: `fbx-clone.md` (ลอกเป๊ะทำยังไง · บทบาทกระดูก · คณิตของการปรับสัดส่วน · preset · ข้อจำกัด) · `look-and-performance.md`
- แก้: แถวซ้ำในตารางความสามารถของ README

## 1.1.0 — animation & sound tools

**EN**
- **FBX Viewer** page (`viewer.html`, new tab): reads `workspace/fbx/`, groups `Name.fbx` + `Name@clip.fbx`, plays / scrubs clips (×0.25), skeleton / mesh / ground toggles, bone list with a height + speed graph, sound-cue markers and a timing tick. Deep links: `viewer.html?open=Name&clip=Walk&bone=LeftFoot`.
- `npm run motion -- dump | rig | channels`: FBX → bone positions per frame (resampled to real seconds for 24/25/60 fps files) · guessed rig file you check by hand · overall-body channels as a JS module.
- `models/motion.js`: `sampleClip()` to play channels on your own model · `timePlan()` to cut / speed up ranges and move cues with them.
- `npm run cues`: footstep / swing / head / tail / roar / snap / drop moments per clip → JSON + timeline page. `models/cue_player.js` plays them with random variations and sustained (start / loop / end) sounds.
- Docs: animation and sound-sync pages now start with a "tools" section (EN/TH).
- No sample FBX or sounds are included — bring your own (put them in `workspace/fbx/`).

**TH**
- **หน้าดู FBX** (`viewer.html` แท็บใหม่): อ่านจาก `workspace/fbx/` · รวม `Name.fbx` + `Name@ท่า.fbx` เป็นตัวเดียว · เล่น/เลื่อนดูท่า (ช้า ×0.25) · เปิดปิดโครงกระดูก/ผิว/พื้น · รายชื่อกระดูก + กราฟความสูงและความเร็ว · จุดใส่เสียง + เสียงติ๊กเช็คจังหวะ · ลิงก์ตรง `viewer.html?open=Name&clip=Walk&bone=LeftFoot`
- `npm run motion -- dump | rig | channels`: FBX เป็นตำแหน่งกระดูกทุกเฟรม (ไฟล์ 24/25/60 fps แปลงเป็นวินาทีจริง) · ไฟล์ rig ที่เดาให้แล้วตรวจเอง · channel ท่าทางรวมทั้งตัวเป็นไฟล์ JS
- `models/motion.js`: `sampleClip()` เล่น channel บนโมเดลของเรา · `timePlan()` ตัด/เร่งช่วงของท่า และเลื่อนจุดเสียงตาม
- `npm run cues`: หาจังหวะเท้าลง/ฟัน/หัว/หาง/คำราม/งับ/ล้ม ทุกท่า เป็น JSON + หน้าไทม์ไลน์ · `models/cue_player.js` เล่นเสียงตามจังหวะ สุ่มเสียงได้ และเสียงต่อเนื่อง (เริ่ม/วน/จบ)
- เอกสาร: หน้า animation และ sound-sync เพิ่มส่วน "เครื่องมือ" ไว้ต้นหน้า (EN/TH)
- ไม่มีไฟล์ FBX หรือเสียงตัวอย่างแนบมา — ใช้ไฟล์ของคุณเอง (ใส่ใน `workspace/fbx/`)

## 1.0.0 — first public release

**EN**
- Model Studio page: orbit / ortho views, wireframe, scale hand + ruler, color themes, texture & UV panel, animation clips, view exported FBX, EN/TH UI.
- Model Kit: `createKit` (add · loft · plate · face · soft edges · rigid-skin bones · palette textures), `slab.js` thick shells, `fromTris` for retopo output.
- Export: `npm run export` (GLB → FBX, Smart UV + bake + AO + UV layout, rigged avatar + one FBX per clip, automatic checks) and `npm run send`.
- Topology tools: audit (wasted edges, skinny triangles, UV), distance to a reference, render / wireframe sheets, `npm run retopo` (reference → clean low-poly with color slots + weighted normals).
- Docs (EN/TH): getting started, model kit, export to Unity, topology, animation from FBX, sound sync.
- Samples: Basic Sword, Round Shield, Lever Switch (bones + clips).

**TH**
- หน้าสตูดิโอโมเดล: หมุน/มุมตรง · เส้นโครง · มือและไม้บรรทัดเทียบขนาด · ธีมสี · แผง texture/UV · เล่นท่า · เปิดดู FBX ที่ export · สลับภาษา EN/TH
- ชุดสร้างโมเดล: `createKit` · `slab.js` แผ่นหนา · `fromTris` สำหรับผล retopo
- Export: `npm run export` (GLB → FBX · Smart UV + bake + AO + UV layout · avatar + ไฟล์ท่าละไฟล์ · ตรวจอัตโนมัติ) และ `npm run send`
- เครื่องมือ Topology: วัดเส้นล้น/สามเหลี่ยมผอม/UV · วัดระยะคลาดจากต้นแบบ · ภาพหลายมุม/wireframe · `npm run retopo`
- เอกสาร 2 ภาษา: เริ่มใช้งาน · ชุดสร้างโมเดล · export ไป Unity · topology · animation จาก FBX · เสียงตามท่า
- ตัวอย่าง: ดาบ · โล่กลม · คันโยก (กระดูก + ท่า)

