// ===== UI language (EN / TH) =====
// Elements with data-i18n="key" get their text from the dictionary · t('key') for strings built in code.
// The choice is remembered in localStorage and shared by every page.
const DICT = {
  en: {
    'nav.studio':'Model Studio', 'nav.docs':'Docs',
    'side.models':'Models', 'side.themes':'Color themes', 'side.themesHint':'(texture only)', 'side.anim':'Animation', 'side.animHint':'(click to play)',
    'side.loop':'Loop', 'side.slow':'Slow ×0.25', 'side.exports':'Exported files', 'side.camera':'Camera',
    'v.front':'Front', 'v.side':'Side', 'v.top':'Top', 'v.persp':'3/4', 'v.ortho':'Ortho', 'v.spin':'Turntable', 'v.reset':'↺ Reset view', 'v.resetHint':'press R or F',
    'side.display':'Display', 'd.wire':'Wireframe', 'd.hand':'Hand', 'd.ruler':'Ruler', 'd.soft':'Soft edges', 'd.softHint':'press S to compare',
    'side.stats':'Model info', 'side.palette':'Palette (1 material)',
    'help':'Left-drag rotate · wheel zoom · <b>middle-drag</b> or right-drag = pan · <kbd>1</kbd> front <kbd>2</kbd> side <kbd>3</kbd> top <kbd>4</kbd> 3/4 · <kbd>W</kbd> wireframe · <kbd>R</kbd> reset<br>The axis gizmo = pivot · ruler squares = 10 cm.',
    'tab.ref':'References', 'tab.tex':'Texture · UV', 'drop':'Drop images here<br>or put files in <b>ref/</b>',
    'tex.dots':'UV points', 'tex.grid':'Cell lines', 'tex.slots':'Color slots', 'tex.slotsHint':'(hover to highlight)',
    'tex.note':'Palette coloring: every face points its UV at the center of its color cell, so UVs show as dots, not an unwrap · crisp colors, no seams · recolor the whole model by editing the image.<br>Export ships 3 images: Albedo · Metallic (R) + Smoothness (A) in one URP map · Emission.',
    'st.tris':'triangles', 'st.over':'over budget', 'st.size':'size', 'st.sizeAxes':'cm (W × H × D)', 'st.mat':'material', 'st.slots':'color slots', 'st.build':'built in',
    'sw.metal':'metal', 'sw.emit':'glow', 'none.export':'No exported files yet', 'none.ref':'No files in ref/ yet', 'fbx.real':'Exported FBX', 'fbx.hint':'model + textures from the real export',
    'grp.user':'Your models (workspace/)', 'grp.samples':'Samples', 'bones':'bones', 'sec':'s', 'view.free':'free',
    'nav.viewer':'FBX Viewer',
    'vw.sub':'Animated FBX from <b>workspace/fbx/</b>', 'vw.files':'Files', 'vw.clips':'Clips', 'vw.display':'Display', 'vw.skel':'Skeleton', 'vw.mesh':'Mesh', 'vw.ground':'Ground',
    'vw.help':'Put FBX files in <code>workspace/fbx/</code> and reload. <code>Name.fbx</code> + <code>Name@clip.fbx</code> are grouped as one character.<br>Pick a bone to graph its height and speed · sound cues come from <code>npm run cues</code>.<br>Left-drag rotate · right-drag pan · wheel zoom · <kbd>Space</kbd> play',
    'vw.loop':'Loop', 'vw.tick':'Tick on cues', 'vw.bones':'Bones', 'vw.cues':'Sound cues', 'vw.none':'No FBX in workspace/fbx/ yet', 'vw.noclips':'This file has no animation',
    'vw.lift':'lift', 'vw.peak':'peak speed', 'vw.units':'(file units)', 'vw.height':'height', 'vw.speed':'speed', 'vw.pickbone':'Pick a bone on the right to graph it',
    'vw.nocues':'No cues found in this clip', 'vw.cuehint':'No cue file yet — run: npm run motion -- dump · rig · then npm run cues', 'vw.clipsN':'clips',
    'tex.info':(s, c, u, n) => `image <b>${s}×${s}</b> px · ${c} px per cell · <b>${u}</b> of ${n} cells used · one UV point per color`,
  },
  th: {
    'nav.studio':'สตูดิโอโมเดล', 'nav.docs':'คู่มือ',
    'side.models':'โมเดล', 'side.themes':'ธีมสี', 'side.themesHint':'(เปลี่ยนแค่ texture)', 'side.anim':'Animation', 'side.animHint':'(กดเล่น)',
    'side.loop':'วนซ้ำ', 'side.slow':'ช้า ×0.25', 'side.exports':'ไฟล์ที่ export แล้ว', 'side.camera':'มุมกล้อง',
    'v.front':'หน้า', 'v.side':'ข้าง', 'v.top':'บน', 'v.persp':'3/4', 'v.ortho':'ออร์โธ', 'v.spin':'หมุนโชว์', 'v.reset':'↺ รีเซ็ตมุมมอง', 'v.resetHint':'กด R หรือ F',
    'side.display':'การแสดงผล', 'd.wire':'เส้นโครง', 'd.hand':'มือเทียบ', 'd.ruler':'ไม้บรรทัด', 'd.soft':'Soft Edge', 'd.softHint':'กด S สลับเทียบ',
    'side.stats':'ข้อมูลชิ้นงาน', 'side.palette':'จานสี (1 วัสดุ)',
    'help':'ลากซ้ายหมุน · ล้อซูม · <b>ลากปุ่มกลาง</b> หรือคลิกขวาลาก = เลื่อน · <kbd>1</kbd> หน้า <kbd>2</kbd> ข้าง <kbd>3</kbd> บน <kbd>4</kbd> 3/4 · <kbd>W</kbd> เส้นโครง · <kbd>R</kbd> รีเซ็ต<br>แกนสี = จุด pivot · ไม้บรรทัดช่องละ 10 ซม.',
    'tab.ref':'รูปอ้างอิง', 'tab.tex':'Texture · UV', 'drop':'ลากรูปมาวางตรงนี้<br>หรือใส่ไฟล์ในโฟลเดอร์ <b>ref/</b>',
    'tex.dots':'จุด UV', 'tex.grid':'เส้นช่อง', 'tex.slots':'ช่องสี', 'tex.slotsHint':'(ชี้เพื่อไฮไลต์บนโมเดล)',
    'tex.note':'วิธีลงสีแบบ palette: ทุกหน้าชี้ UV ไปที่จุดกลางช่องสีของตัวเอง จึงเห็นเป็นจุด ไม่ใช่ลายแผ่ UV · สีคม ไม่มีรอยต่อ · เปลี่ยนสีทั้งชิ้นด้วยการแก้รูปอย่างเดียว<br>ตอน export ได้ 3 รูป: Albedo · Metallic (R) + Smoothness (A) รวมไฟล์เดียวแบบ URP · Emission',
    'st.tris':'triangle', 'st.over':'เกินงบ', 'st.size':'ขนาด', 'st.sizeAxes':'ซม. (กว้าง × สูง × หนา)', 'st.mat':'วัสดุ', 'st.slots':'ช่องสี', 'st.build':'สร้าง',
    'sw.metal':'โลหะ', 'sw.emit':'เรือง', 'none.export':'ยังไม่มีไฟล์ export', 'none.ref':'ยังไม่มีไฟล์ใน ref/', 'fbx.real':'ไฟล์ FBX ที่ export จริง', 'fbx.hint':'โมเดล + texture จากไฟล์จริง',
    'grp.user':'โมเดลของคุณ (workspace/)', 'grp.samples':'ตัวอย่าง', 'bones':'กระดูก', 'sec':'วิ', 'view.free':'อิสระ',
    'nav.viewer':'ดู FBX',
    'vw.sub':'FBX ที่มี animation จาก <b>workspace/fbx/</b>', 'vw.files':'ไฟล์', 'vw.clips':'ท่า', 'vw.display':'การแสดงผล', 'vw.skel':'โครงกระดูก', 'vw.mesh':'ผิว', 'vw.ground':'พื้น',
    'vw.help':'ใส่ไฟล์ FBX ใน <code>workspace/fbx/</code> แล้วรีโหลด · <code>Name.fbx</code> + <code>Name@ท่า.fbx</code> จะรวมเป็นตัวละครเดียว<br>เลือกกระดูกเพื่อดูกราฟความสูงและความเร็ว · จุดเสียงมาจาก <code>npm run cues</code><br>ลากซ้ายหมุน · ลากขวาเลื่อน · ล้อซูม · <kbd>Space</kbd> เล่น',
    'vw.loop':'วนซ้ำ', 'vw.tick':'เสียงติ๊กตามจุด', 'vw.bones':'กระดูก', 'vw.cues':'จุดใส่เสียง', 'vw.none':'ยังไม่มี FBX ใน workspace/fbx/', 'vw.noclips':'ไฟล์นี้ไม่มี animation',
    'vw.lift':'ยกสูงสุด', 'vw.peak':'เร็วสุด', 'vw.units':'(หน่วยของไฟล์)', 'vw.height':'ความสูง', 'vw.speed':'ความเร็ว', 'vw.pickbone':'เลือกกระดูกด้านขวาเพื่อดูกราฟ',
    'vw.nocues':'ท่านี้ไม่พบจุดใส่เสียง', 'vw.cuehint':'ยังไม่มีไฟล์จุดเสียง — รัน npm run motion -- dump · rig แล้ว npm run cues', 'vw.clipsN':'ท่า',
    'tex.info':(s, c, u, n) => `รูป <b>${s}×${s}</b> px · ช่องละ ${c} px · ใช้ <b>${u}</b> จาก ${n} ช่อง · 1 จุด UV ต่อ 1 สี`,
  },
};
const saved = (() => { try{ return localStorage.getItem('vp-lang'); }catch(e){ return null; } })();
let lang = saved || ((navigator.language || '').startsWith('th') ? 'th' : 'en');
export const getLang = () => lang;
export function t(key, ...args){ const v = DICT[lang][key] ?? DICT.en[key] ?? key; return typeof v === 'function' ? v(...args) : v; }
export function applyLang(root = document){
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
}
export function setLang(l){ lang = l; try{ localStorage.setItem('vp-lang', l); }catch(e){} applyLang(); dispatchEvent(new Event('langchange')); }
