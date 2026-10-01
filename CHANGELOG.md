# Changelog

Update with `git pull`. Versions follow `MAJOR.MINOR.PATCH`: MINOR = new features, PATCH = fixes, MAJOR = something you must change on your side.
อัปเดตด้วย `git pull` · เลขเวอร์ชัน `MAJOR.MINOR.PATCH`: MINOR = ของใหม่ · PATCH = แก้บั๊ก · MAJOR = มีสิ่งที่ผู้ใช้ต้องแก้ตาม

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

