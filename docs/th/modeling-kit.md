# ชุดสร้างโมเดล

โมเดล 1 ชิ้น = ไฟล์ JavaScript เล็กๆ 1 ไฟล์

```js
import * as THREE from 'three';
import { createKit, SECTION } from '../models/kit.js';
import { themed } from '../models/themes.js';

export const info = { id:'my_axe', name:'My Axe', note:'ลองครั้งแรก', exportName:'My_Axe', set:'Weapons' };
export const ROLE = { head:'steel', haft:'grip', band:'trim' };          // ช่องสี → บทบาทในธีม

export function build(theme){
  const K = createKit(themed({
    head:{ c:'#c9d1dc', metal:.85, smooth:.7 },
    haft:{ c:'#3b2a20', metal:0,   smooth:.3 },
    band:{ c:'#d9b25a', metal:1,   smooth:.7 },
  }, ROLE, theme));
  K.add(new THREE.CylinderGeometry(.015, .017, .6, 8), 'haft', K.at(0, .1));
  K.add(new THREE.BoxGeometry(.16, .09, .02), 'head', K.at(.05, .36));
  return K.build();
}
```

## ข้อตกลง

- **หน่วยเมตร** จุด (0,0,0) = pivot ที่อยากได้ใน engine (ด้ามจับอาวุธ · บานพับประตู) · ขึ้น = +Y · หน้า = +Z
- **1 mesh 1 วัสดุ** สีมาจากรูป palette: ทุกสามเหลี่ยมชี้ UV ไปกลางช่องสีของตัวเอง
  เปลี่ยนสี = เปลี่ยนรูป ไม่ต้องแก้ UV · ได้สูงสุด 64 สี
- **ธีมสี** (`models/themes.js`) กำหนดสีต่อ *บทบาท* โมเดลเดียวจึงมีหลายชุดสี โดยรูปทรงและ UV เหมือนเดิม

## ตัวสร้างพื้นฐาน

| คำสั่ง | ทำอะไร |
|---|---|
| `K.add(geometry, slot, matrix)` | geometry ของ three.js อะไรก็ได้ (Box · Cylinder · Lathe · Extrude · Octahedron …) |
| `K.loft(rings, slot)` | วงจุดเรียงตามแกน Y — ใบดาบ ด้าม เขา · วงที่จุดซ้อนกันหมด = ปลายแหลม (`SECTION.point`) |
| `K.plate(outline, depth, slot, matrix, bevel)` | แผ่นหนาจากรูป 2 มิติ |
| `makeSlab(K, grid, thickness, opts)` (`slab.js`) | เปลือกหนาโค้งจากตารางจุด มีผิวในและขอบปิด |
| `K.face(a, b, c, slot, hint)` | สามเหลี่ยม 1 แผ่น หันไปทาง `hint` |
| `K.at(x, y, z, rx, ry, rz, s)` · `K.mirrorX(m)` | ตัวช่วยสร้าง matrix |
| `K.soft(angle)` … `K.soft(0)` | soft edge ให้ส่วนที่สร้างระหว่างนั้น (เกลี่ยแสงข้ามขอบที่หักน้อยกว่ามุมที่กำหนด) |
| `K.newPart()` | normal ไม่เกลี่ยข้ามชิ้น |
| `K.bone(i)` | กระดูกแบบ rigid: สามเหลี่ยมหลังจากนี้ผูกกระดูก `i` 100% (ดู `models/samples/lever.js`) |
| `K.triCount()` | นับ tri ระหว่างสร้าง ดูว่าส่วนไหนกินงบ |
| `fromTris(TRIS, palette)` | สร้างโมเดลจากผลของ `npm run retopo` |

## นิสัยด้าน topology ที่คุ้ม

- **ให้แถวของเส้นวิ่งตามขอบสี** ถ้าเส้นขอบทองคือแถวหนึ่งของตาราง ขอบสีก็คือขอบของ mesh พอดี ไม่ต้องมีวงเส้นเพิ่ม (ดู `models/samples/shield.js`)
- **ใช้ tri ตรงที่เส้นรอบรูปโค้ง** ไม่ใช่บนพื้นเรียบ ตรวจด้วย `tools/topo/audit.py` (% เส้นล้น)
- **ด้านในที่คนไม่เห็นหยาบได้** ผิวในของแผ่นหนาใช้ tri น้อยกว่าผิวนอกมาก
- **เหลี่ยมแบบ flat คือสไตล์ soft edge คือเครื่องมือ** ใช้ `K.soft()` กับผิวโลหะโค้ง ส่วนสันและขอบทองให้คม
- **เช็กขนาดกับมือและไม้บรรทัด** ก่อนเก็บรายละเอียด

## กระดูกและท่า

ดู `models/samples/lever.js`: `BONES` (ชื่อ · พ่อ · จุดหมุน · แกน) · `JOINTS` (ตำแหน่งจุดหมุน) · `ANIMS`
(`{ len, loop, note, tracks:{ กระดูก:[[เวลา, มุม], ...] } }`) ชื่อท่าตัวเล็ก export ออกมาเป็น
`<Name>.fbx` (avatar) + `<Name>@<ท่า>.fbx` ตามธรรมเนียมของ Unity
