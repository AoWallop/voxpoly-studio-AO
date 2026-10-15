# VoxPoly Studio

[English](README.md) · **ภาษาไทย**

ปั้น **โมเดล low-poly ด้วยโค้ด** (three.js) ดูผลในเบราว์เซอร์ แล้ว export เป็น **FBX สำหรับ Unity**
พร้อมธีมสี · texture แบบ Smart UV · soft/hard edge · กระดูก + animation แบบง่าย · และเครื่องมือ **เรียน topology จากโมเดลต้นแบบ**

![pipeline](docs/pipeline.svg)

## มีอะไรบ้าง

| | |
|---|---|
| **สตูดิโอโมเดล** (`index.html`) | หมุน/มุมตรง (ortho) · เส้นโครง · มือและไม้บรรทัดเทียบขนาด · ธีมสี · แผง texture/UV · เล่นท่า · เปิดไฟล์ FBX ที่ export มาเทียบ |
| **ชุดสร้างโมเดล** (`models/kit.js`) | เขียนโมเดลเป็นโค้ด: loft · กล่อง/ทรงกระบอก · แผ่นหนา (`slab.js`) · soft edge · กระดูกแบบ rigid · สีจาก palette (1 mesh · 1 วัสดุ) |
| **Export ไป Unity** (`npm run export`) | GLB → FBX (หน่วยเมตร · Y ขึ้น · ไม่มี rotation ค้าง) · texture ทุกธีม · Smart UV + bake + AO + UV layout · โมเดลมีกระดูก → avatar + ไฟล์ท่าละไฟล์ ตรวจให้อัตโนมัติ |
| **โฟลเดอร์ส่งงาน** (`npm run send`) | `<Set>_SEND/` สะอาด: FBX · Animations/ · Textures/ · UVLayout/ · Preview/ |
| **หน้าดู FBX** (`viewer.html`) | เปิด FBX ที่มี animation จาก `workspace/fbx/` · เล่น/เลื่อนดูท่า · กราฟความสูงและความเร็วของกระดูกที่เลือก · ดูจุดใส่เสียง |
| **เครื่องมือท่าและเสียง** (`npm run motion`, `npm run cues`) | อ่านท่าจาก FBX เป็นตัวเลข เอาไปใช้กับโมเดล three.js ของเรา (`models/motion.js`) · หาจังหวะเท้าลง/ฟัน/คำราม แล้วเล่นเสียงตามจังหวะ (`models/cue_player.js`) |
| **ลอก FBX** (`clone.html`, `npm run clone`) | คัดลอก FBX ที่มี rig + ท่า เข้า three.js ครบทุกจุด หน้า UV น้ำหนัก และทุกเฟรม ตรวจเทียบ Blender คลาดราว 0.01 มม. · ดูเส้น topo จริง · **แถบปรับสัดส่วน 17 แถบ** (หัว แขนขา ความอวบ…) ใช้ได้กับ rig ทุกแบบการตั้งชื่อ · **preset** · เครื่องมือ UV สำหรับทีม Art · ส่งออก GLB พร้อม rig และท่า |
| **แสงเงาการ์ตูน** (`models/toon.js`) | เรียกครั้งเดียวได้ขั้นแสงเงาการ์ตูน + เส้นขอบทั้งฉาก (รวมตัวละครที่มี skin) · ปรับขั้นแสง เงา เส้นขอบได้ |
| **ตัววัดภาระการวาด** (`models/perf.js`) | draw call · สามเหลี่ยม · fps ทุกหน้า เทียบกับงบ VR |
| **เครื่องมือ Topology** (`npm run retopo`, `tools/topo/`) | วัดเส้นล้น / สามเหลี่ยมผอม / ระยะคลาดจากต้นแบบ · สร้าง low-poly สะอาดจากโมเดลต้นแบบที่มี texture พร้อมช่องสีและ weighted normal |
| **เอกสาร** (`docs/`) | การปั้น · export · topology · animation · การทำเสียงให้เข้ากับท่า — ภาษาไทยและอังกฤษ |

## เริ่มใช้งาน

1. ติดตั้ง **Node 18+** · **Python 3.10+** · **Blender 4.2+** · **Chrome** (หรือ Chromium / Edge)
2. โคลนและตั้งค่า:
   ```bash
   git clone https://github.com/AoWallop/voxpoly-studio-AO.git
   cd voxpoly-studio-AO
   pip install -r requirements.txt
   cp .env.example .env          # แล้วใส่ path ของ BLENDER และ CHROME
   npm run doctor                # ตรวจว่าเครื่องพร้อม
   ```
3. เปิดสตูดิโอ:
   ```bash
   npm run serve                 # → http://localhost:8129/
   ```
4. ลอง export ตัวอย่าง:
   ```bash
   npm run export -- sample_sword
   npm run send -- Samples
   ```

คู่มือเต็ม: [docs/th/getting-started.md](docs/th/getting-started.md)

## ทำโมเดลของตัวเอง

คัดลอก `workspace.example/` เป็น `workspace/` แล้วใส่โมเดลของคุณในนั้น โฟลเดอร์ `workspace/` · `ref/` · `export/` **git ไม่ติดตาม**
ไฟล์ของคุณจะไม่ถูกอัปโหลด และ `git pull` จะไม่ทับ ดู [docs/th/modeling-kit.md](docs/th/modeling-kit.md)

## อัปเดตเวอร์ชันใหม่

```bash
git pull
```
แล้วดูว่ามีอะไรใหม่ใน [CHANGELOG.md](CHANGELOG.md) ถ้าเวอร์ชันใหม่เพิ่มโฟลเดอร์ใน `workspace.example/` ให้สร้างโฟลเดอร์นั้นใน `workspace/` ของคุณด้วย

## ใช้กับ Claude Code

มีไฟล์ [CLAUDE.md](CLAUDE.md) เป็นคู่มือการทำงานสำหรับ Claude Code (วิธีสร้าง ตรวจ และ export โมเดลใน repo นี้)
เปิดโฟลเดอร์นี้ใน Claude Code แล้วสั่งทำโมเดลได้เลย จะทำตามขั้นตอนเดียวกัน

## เอกสาร

- [เริ่มใช้งาน](docs/th/getting-started.md)
- [ชุดสร้างโมเดล](docs/th/modeling-kit.md)
- [Export ไป Unity](docs/th/export-unity.md)
- [Topology](docs/th/topology.md)
- [ทำ Animation จาก FBX](docs/th/animation.md)
- [ลอก FBX — ลอกเป๊ะ · ปรับสัดส่วน · preset](docs/th/fbx-clone.md)
- [แสงเงาการ์ตูนและภาระการวาด](docs/th/look-and-performance.md)
- [ทำเสียงให้เข้ากับท่า](docs/th/sound-sync.md)

## License

MIT — ดู [LICENSE](LICENSE) ใช้ แก้ และเอาไปใช้ในงานของคุณได้ฟรี แค่คงข้อความลิขสิทธิ์ไว้
