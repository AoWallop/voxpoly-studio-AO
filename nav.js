// ===== Top bar: page tabs + EN/TH switch (add <script type="module" src="nav.js"></script> to every page) =====
// New page = add one line to PAGES. Hidden in headless export / QC runs (?qc ?export) so screenshots stay clean.
import { t, getLang, setLang, applyLang } from './i18n.js';

const PAGES = [
  ['index.html', 'nav.studio'],
  ['viewer.html', 'nav.viewer'],
];
const q = new URLSearchParams(location.search);
if(!['qc', 'export'].some(k => q.has(k))){
  const H = 40, here = location.pathname.split('/').pop() || 'index.html';
  const css = document.createElement('style');
  css.textContent = `
  #vpNav{position:fixed;left:0;right:0;top:0;height:${H}px;z-index:50;display:flex;align-items:stretch;gap:2px;padding:0 10px;
    background:#100e16;border-bottom:1px solid #ffffff1f;font:600 13px 'Chakra Petch',Tahoma,sans-serif}
  #vpNav .brand{display:flex;align-items:center;color:var(--gold,#f0c874);letter-spacing:2px;font-size:12px;margin-right:14px}
  #vpNav a{display:flex;align-items:center;padding:0 14px;color:#bdb6ad;text-decoration:none;border-bottom:2px solid transparent}
  #vpNav a:hover{color:#eee9e1;background:#ffffff0a}
  #vpNav a.on{color:var(--gold,#f0c874);border-bottom-color:var(--gold,#f0c874);background:#ffffff08}
  #vpNav .lang{margin-left:auto;display:flex;align-items:center;gap:4px}
  #vpNav .lang button{font:600 12px 'Chakra Petch',Tahoma;background:#2a2533;color:#bdb6ad;border:1px solid #ffffff1f;border-radius:5px;padding:4px 8px;cursor:pointer}
  #vpNav .lang button.on{color:var(--gold,#f0c874);border-color:var(--gold,#f0c874)}
  body{margin-top:${H}px!important;height:calc(100vh - ${H}px)!important}
  @media (max-width:700px){#vpNav{overflow-x:auto}#vpNav .brand{display:none}#vpNav a{padding:0 10px;white-space:nowrap}}`;
  document.head.appendChild(css);
  const nav = document.createElement('nav'); nav.id = 'vpNav';
  const draw = () => {
    nav.innerHTML = `<span class="brand">VOXPOLY STUDIO</span>` +
      PAGES.map(([f, k]) => `<a href="${f}"${f === here ? ' class="on"' : ''}>${t(k)}</a>`).join('') +
      `<a href="docs/${getLang()}/README.md" target="_blank">${t('nav.docs')}</a>` +
      `<span class="lang"><button data-l="en">EN</button><button data-l="th">TH</button></span>`;
    nav.querySelectorAll('[data-l]').forEach(b => { b.classList.toggle('on', b.dataset.l === getLang()); b.onclick = () => setLang(b.dataset.l); });
  };
  draw(); addEventListener('langchange', draw);
  document.body.prepend(nav);
  dispatchEvent(new Event('resize'));          // let each page resize its canvas to the new space
}
applyLang();
