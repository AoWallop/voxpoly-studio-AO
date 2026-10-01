# workspace/ — your own files

Copy this folder to `workspace/` (without `.example`). Everything inside `workspace/` is ignored by git, so:

- `git pull` (updating the studio) never overwrites your models,
- nothing you make here is ever uploaded by accident.

Suggested layout:

```
workspace/
  models.js          ← list of your models (shown first in the studio)
  my_sword.js        ← a model file (copy a sample from models/samples/ to start)
  retopo/            ← output of `npm run retopo`
  fbx/               ← your animated FBX files (FBX Viewer, npm run motion / cues read from here)
  motion/            ← output of `npm run motion` (dumps, rig files, channels)
  cues/              ← output of `npm run cues` (sound cue JSON + timeline page)
ref/                 ← (repo root, also ignored) your reference images / FBX files
```

---

# workspace/ — ไฟล์ของคุณเอง

คัดลอกโฟลเดอร์นี้เป็น `workspace/` (ตัด `.example` ออก) ทุกอย่างใน `workspace/` git จะไม่ติดตาม เพราะฉะนั้น

- ตอนอัปเดตสตูดิโอด้วย `git pull` จะไม่ทับโมเดลของคุณ
- ของที่คุณทำในนี้จะไม่ถูกอัปโหลดขึ้นไปโดยไม่ตั้งใจ

เริ่มจากคัดลอกโมเดลตัวอย่างใน `models/samples/` มาแก้ แล้วใส่ชื่อไว้ใน `workspace/models.js`

ไฟล์ FBX ที่มี animation ใส่ใน `workspace/fbx/` (หน้าดู FBX และ `npm run motion` / `npm run cues` อ่านจากที่นี่) · ผลลัพธ์จะไปอยู่ใน `workspace/motion/` และ `workspace/cues/`
