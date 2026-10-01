# Export ไป Unity

```bash
npm run export -- <modelId> [--set Folder] [--uv-size 1024] [--uv-themes Steel,Ember] [--no-uv]
npm run send -- <Set>
```

## ขั้นตอนที่เกิดขึ้น

1. **เบราว์เซอร์แบบไม่มีหน้าต่าง** สร้างโมเดลแล้วเขียน `export/<Set>/<Name>.glb` + texture palette ของทุกธีม
   (`<Name>_<Theme>_Albedo.png` · `_MetallicSmoothness.png` (แบบ URP: metal ใน R · smoothness ใน A) · `_Emission.png`)
2. **Blender**
   - โมเดลธรรมดา: GLB → `<Name>.fbx` (เมตร · Y ขึ้น · apply transform · คง normal) แล้วทำ Smart UV + bake ทุกธีม → `export/<Set>_UV/`
   - โมเดลมีกระดูก: avatar `<Name>.fbx` + `<Name>@<ท่า>.fbx` ท่าละไฟล์ + Smart UV + bake → `export/<Set>_UV/`
3. **ตรวจ**: นับ tri หลัง import กลับ · ไฟล์ท่าตรวจด้วย `tools/fbx_check.py` (อ่าน binary ของ FBX ตรงๆ)
   ว่าทุกท่ามีคีย์จริง **และ** path กระดูกตรงกับ avatar ในแบบที่ Unity เห็น
4. **`npm run send`** คัดเฉพาะไฟล์ที่ engine ต้องใช้ไปไว้ใน `export/<Set>_SEND/` (ล้างไฟล์เก่าก่อนทุกครั้ง)

## texture 2 ชุด ใช้ชุดไหน

| ชุด | UV | ใช้เมื่อ |
|---|---|---|
| `export/<Set>/` | UV แบบ palette (ชี้เข้าช่องสี) | แค่เปลี่ยนสี · texture เล็กสุด · สีคม |
| `export/<Set>_UV/` | Smart UV + bake + AO + UV layout | Artist จะวาดทับ · ต้องการ AO |

## เช็กลิสต์ก่อนส่ง (ห้ามข้าม)

1. ดูโมเดลในสตูดิโอ มุมหน้า / ข้าง / บน และเปิดเส้นโครง
2. `npm run export` แล้วอ่านบรรทัด `[CHECK]` (tri ตรง · ไม่มี rotation ค้าง · scale 1)
3. โมเดลมีกระดูกต้องขึ้น `[FBXCHECK] OK`
4. กดไฟล์ FBX ในสตูดิโอ ไฟล์จริงกับ texture จริงต้องหน้าตาเหมือนกัน
5. `npm run send` รายชื่อไฟล์ที่พิมพ์ออกมาคือของที่ส่งจริง ไม่มี `.glb` ไม่มี `.json`
6. เขียน `README_Unity.md` ไว้ในโฟลเดอร์ SEND (ใช้แม่แบบในหน้าภาษาอังกฤษ [export-unity.md](../en/export-unity.md#readme_unitymd-template))
7. ลอง import เข้า Unity เองสักครั้งก่อนส่ง

## ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| โมเดลสีเทาใน Unity | ใช้ texture ผิดชุด หรือยังไม่ได้ใส่ texture · texture palette ต้องคู่กับ FBX ชุด palette · texture Smart UV ต้องคู่กับ FBX ใน `_UV` |
| ท่าเล่นแต่ไม่มีอะไรขยับ | avatar กับไฟล์ท่ามีโหนดบนสุดไม่เหมือนกัน path กระดูกเลยไม่ตรง `fbx_check.py` จับเคสนี้ได้ ให้ export ใหม่ อย่าแก้มือ |
| โมเดลนอนหงาย | มี rotation ค้างบน object ตัว export apply transform ให้แล้ว ถ้าไปแก้ไฟล์ในโปรแกรมอื่นมา ให้ export ใหม่ |
| แสงเป็นเหลี่ยมทั้งชิ้น | ยังไม่ได้ตั้ง soft edge: ใช้ `K.soft(มุม)` หรือ weighted normal (`npm run retopo`) |
