// ===== Color themes — swap colors without touching shape or UVs =====
// Each model maps its color slots to ROLES (e.g. blade → 'steel'), a theme gives a color per role.
// Roles: steel · edge · trim · trimDk · grip · panel · gem · inner · accent (falls back to trim) · field (falls back to panel)
export const THEMES = {
  steel:  { name:'Steel',  note:'silver · brass · blue', roles:{
    steel:{ c:'#c9d1dc', metal:.85, smooth:.72 }, edge:{ c:'#f4f7fb', metal:.7, smooth:.86 }, trim:{ c:'#d9b25a', metal:1, smooth:.7 },
    trimDk:{ c:'#a9823a', metal:1, smooth:.55 }, grip:{ c:'#3b2a20', metal:0, smooth:.3 }, panel:{ c:'#2c4a7a', metal:.4, smooth:.6 },
    gem:{ c:'#5fd0ff', metal:0, smooth:.95, emit:.9 }, inner:{ c:'#3a3f4c', metal:.6, smooth:.35 } } },
  ember:  { name:'Ember',  note:'black · copper · orange glow', roles:{
    steel:{ c:'#3d3f45', metal:.85, smooth:.6 }, edge:{ c:'#9aa0a8', metal:.8, smooth:.8 }, trim:{ c:'#c46a3a', metal:1, smooth:.6 },
    trimDk:{ c:'#7c3d1f', metal:1, smooth:.5 }, grip:{ c:'#18161a', metal:0, smooth:.35 }, panel:{ c:'#22201f', metal:.5, smooth:.5 },
    gem:{ c:'#ff8a2a', metal:0, smooth:.95, emit:1 }, inner:{ c:'#1a1a1d', metal:.6, smooth:.35 } } },
  forest: { name:'Forest', note:'bronze · green · bone', roles:{
    steel:{ c:'#b08d57', metal:.9, smooth:.6 }, edge:{ c:'#e2cf9e', metal:.8, smooth:.75 }, trim:{ c:'#4f7a3a', metal:.2, smooth:.5 },
    trimDk:{ c:'#2f4d24', metal:.2, smooth:.45 }, grip:{ c:'#e7dfc9', metal:0, smooth:.4 }, panel:{ c:'#355e2c', metal:.2, smooth:.5 },
    gem:{ c:'#8dff6a', metal:0, smooth:.95, emit:.8 }, inner:{ c:'#2b2a22', metal:.5, smooth:.35 } } },
};

// a model palette + ROLE (slot → role) + theme id → a new palette with the same slot order (= same UVs)
export function themed(palette, role, themeId){
  const t = THEMES[themeId]; if(!t) return palette;
  const FALLBACK = { accent:'trim', field:'panel' }, out = {};
  for(const [slot, p] of Object.entries(palette)) out[slot] = { ...p, ...(t.roles[role[slot]] || t.roles[FALLBACK[role[slot]]] || {}) };
  return out;
}
