# เริ่มใช้งาน

## 1. ติดตั้ง

| เครื่องมือ | เวอร์ชัน | ใช้ทำอะไร |
|---|---|---|
| Node.js | 18+ | เซิร์ฟเวอร์ในเครื่อง + สคริปต์ export / QC (ไม่ต้องลง npm package เพิ่ม) |
| Python | 3.10+ พร้อม `numpy`, `Pillow` | วาด UV layout · ตรวจ FBX · วัด topology |
| Blender | 4.2+ | export FBX · Smart UV + bake · เครื่องมือ topology — รันแบบไม่เปิดหน้าจอ ไม่ต้องเปิดโปรแกรมเอง |
| Chrome / Chromium / Edge | รุ่นใหม่ | สร้างและ export โมเดลจากหน้าสตูดิโอแบบไม่มีหน้าต่าง |

```bash
pip install -r requirements.txt
```

## 2. ตั้งค่า `.env`

```bash
cp .env.example .env
```
ใส่ path เต็มของ `BLENDER` และ `CHROME` · ไฟล์ `.env` git ไม่ติดตาม (path และของส่วนตัวอยู่ในเครื่องคุณเท่านั้น)

```bash
npm run doctor
```
ทุกบรรทัดควรขึ้น ✔

## 3. เปิดสตูดิโอ

```bash
npm run serve
```
เปิด <http://localhost:8129/> เลือกโมเดลตัวอย่างทางซ้าย ลองเปลี่ยนธีมสี เปิดเส้นโครง (`W`) สลับ soft edge (`S`)
และดูแท็บ **Texture · UV** ทางขวาว่าการลงสีแบบ palette ทำงานยังไง ปุ่ม **EN / TH** มุมขวาบนใช้สลับภาษา

## 4. Export

```bash
npm run export -- sample_sword      # โมเดลธรรมดา
npm run export -- sample_lever      # โมเดลมีกระดูก + ท่า
npm run send -- Samples             # โฟลเดอร์ส่งงานสะอาด: export/Samples_SEND/
```
กลับไปที่สตูดิโอ หัวข้อ **ไฟล์ที่ export แล้ว** จะมีไฟล์ FBX ขึ้นมา กดดูได้ว่าไฟล์จริงกับ texture จริงหน้าตาเหมือนในสตูดิโอไหม

## 5. โมเดลของคุณเอง

```bash
cp -r workspace.example workspace
```
คัดลอกตัวอย่างจาก `models/samples/` มาไว้ใน `workspace/` แก้ path ที่ import (`'../models/kit.js'`)
แล้วใส่ชื่อไว้ใน `workspace/models.js` รีโหลดสตูดิโอ โมเดลของคุณจะขึ้นอยู่บนสุด
รูปอ้างอิงใส่ใน `ref/` (ขึ้นในแผงขวา) ทั้งสองโฟลเดอร์ git ไม่ติดตาม

## แผนที่โฟลเดอร์

```
index.html, studio.js     หน้าสตูดิโอ
models/kit.js, slab.js    ชุดสร้างโมเดล
models/themes.js          ธีมสี
models/samples/           ตัวอย่างในตัว (อัปเดตตาม git pull)
workspace/                โมเดลของคุณ (git ไม่ติดตาม)
ref/                      รูป / FBX อ้างอิงของคุณ (git ไม่ติดตาม)
export/                   ผล export (git ไม่ติดตาม)
tools/                    export · QC · ส่งงาน · topology (Node + Blender + Python)
docs/                     เอกสารนี้
```
