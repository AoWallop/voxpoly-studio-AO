# Changelog

Update with `git pull`. Versions follow `MAJOR.MINOR.PATCH`: MINOR = new features, PATCH = fixes, MAJOR = something you must change on your side.
อัปเดตด้วย `git pull` · เลขเวอร์ชัน `MAJOR.MINOR.PATCH`: MINOR = ของใหม่ · PATCH = แก้บั๊ก · MAJOR = มีสิ่งที่ผู้ใช้ต้องแก้ตาม

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

## Planned — 1.1
- FBX Viewer page (drop an FBX, play clips, inspect bones) · หน้าเปิดดู FBX
- Motion tools: dump → channels (config file for bone roles) → three.js curves · เครื่องมือถอดท่าจาก FBX แบบตั้งค่าได้
- Sound tools: cue finder (footsteps, swing peaks, jaw open…) + cue player for three.js · เครื่องมือหาจังหวะเสียง + ตัวเล่นเสียงตาม cue
- Sample FBX made for the repo · ไฟล์ FBX ตัวอย่างที่ทำขึ้นเอง
