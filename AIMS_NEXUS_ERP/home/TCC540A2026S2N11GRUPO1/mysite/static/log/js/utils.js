// ===== Formatting helpers =====
export const BRL = (n) => (Number(n)||0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
export const NUM = (n) => (Number(n)||0).toLocaleString('pt-BR');
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
export const todayISO = () => new Date().toISOString().slice(0,10);
export const fmtDate = (iso) => { if(!iso) return '—'; const d=new Date(iso+ (iso.length<=10?'T00:00:00':'')); return d.toLocaleDateString('pt-BR'); };
export const daysBetween = (a,b)=> Math.round((new Date(b) - new Date(a))/86400000);
export const escapeHTML = (s='') => String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

export function toast(msg, type='ok'){
  const c = { ok:'#0f766e', err:'#dc2626', warn:'#d97706' }[type] || '#0f766e';
  let host = document.getElementById('toast-host');
  if(!host){ host=document.createElement('div'); host.id='toast-host'; host.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;'; document.body.appendChild(host); }
  const el = document.createElement('div');
  el.style.cssText=`background:${c};color:#fff;padding:10px 18px;border-radius:10px;font-size:.85rem;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.18);opacity:0;transform:translateY(8px);transition:.25s;max-width:90vw;`;
  el.textContent = msg; host.appendChild(el);
  requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.transform='none'; });
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(8px)'; setTimeout(()=>el.remove(),300); }, 2800);
}

// ===== EAN-13 =====
export function ean13CheckDigit(twelve){
  let sum=0;
  for(let i=0;i<12;i++){ const d=+twelve[i]; sum += (i%2===0)? d : d*3; }
  return (10 - (sum%10))%10;
}
export function generateEAN13(prefix='789'){
  let base = prefix;
  while(base.length<12) base += Math.floor(Math.random()*10);
  base = base.slice(0,12);
  return base + ean13CheckDigit(base);
}
export function isValidEAN13(code){
  if(!/^\d{13}$/.test(code)) return false;
  return +code[12] === ean13CheckDigit(code.slice(0,12));
}

// EAN-13 encoding tables
const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

export function ean13SVG(code, opts={}){
  if(!isValidEAN13(code)) return `<div class="text-red-600 text-sm">Código EAN-13 inválido</div>`;
  const scale = opts.scale||2, height = opts.height||70, quiet=11, guardExtra=5;
  const first = +code[0];
  const parity = PARITY[first];
  let bits = '101';
  for(let i=1;i<=6;i++){ const d=+code[i]; bits += (parity[i-1]==='L'? L[d] : G[d]); }
  bits += '01010';
  for(let i=7;i<=12;i++){ bits += R[+code[i]]; }
  bits += '101';
  const totalModules = bits.length + quiet*2;
  const w = totalModules*scale;
  const fullH = height + 22;
  let rects='';
  let x = quiet*scale;
  // determine guard positions to extend downward
  const guardIdx = new Set();
  [0,1,2, 45,46,47,48,49, 92,93,94].forEach(i=>guardIdx.add(i));
  for(let i=0;i<bits.length;i++){
    if(bits[i]==='1'){
      const isGuard = guardIdx.has(i);
      const h = height + (isGuard? guardExtra:0);
      rects += `<rect x="${x}" y="0" width="${scale}" height="${h}" fill="#111827"/>`;
    }
    x += scale;
  }
  const ty = height + 16;
  const c = code;
  const tx1 = (quiet-8)*scale;
  return `<svg class="ean" viewBox="0 0 ${w} ${fullH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff">
    ${rects}
    <g font-family="monospace" font-size="${11*scale/2}" fill="#111827">
      <text x="${(quiet-9)*scale}" y="${ty}">${c[0]}</text>
      <text x="${(quiet+7)*scale}" y="${ty}">${c.slice(1,7)}</text>
      <text x="${(quiet+50)*scale}" y="${ty}">${c.slice(7)}</text>
    </g>
  </svg>`;
}

// ===== simple markdown renderer for AI output =====
export function renderMarkdown(md=''){
  let html = escapeHTML(md);
  // tables
  html = html.replace(/^\|(.+)\|\s*\n\|([ :|\-]+)\|\s*\n((?:\|.*\|\s*\n?)*)/gm, (m, header, sep, rows)=>{
    const th = header.split('|').map(s=>`<th>${s.trim()}</th>`).join('');
    const trs = rows.trim().split('\n').map(r=>{
      const tds = r.replace(/^\||\|$/g,'').split('|').map(s=>`<td>${s.trim()}</td>`).join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
  });
  html = html
    .replace(/^### (.*)$/gm,'<h3>$1</h3>')
    .replace(/^## (.*)$/gm,'<h2>$1</h2>')
    .replace(/^# (.*)$/gm,'<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/`([^`]+?)`/g,'<code>$1</code>');
  // lists
  html = html.replace(/(?:^[-*] .*(?:\n|$))+/gm, block=>{
    const items = block.trim().split('\n').map(l=>`<li>${l.replace(/^[-*]\s*/,'')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });
  html = html.replace(/(?:^\d+\. .*(?:\n|$))+/gm, block=>{
    const items = block.trim().split('\n').map(l=>`<li>${l.replace(/^\d+\.\s*/,'')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });
  html = html.split(/\n{2,}/).map(p=>{
    if(/^\s*<(h\d|ul|ol|table|p)/.test(p)) return p;
    return `<p>${p.replace(/\n/g,'<br>')}</p>`;
  }).join('');
  return html;
}
