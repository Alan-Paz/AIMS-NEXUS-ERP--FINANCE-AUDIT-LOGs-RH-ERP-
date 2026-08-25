// Utilitários compartilhados

export const BRL = (n) => (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export const NUM = (n) => (Number(n)||0).toLocaleString('pt-BR');
export const PCT = (n) => (Number(n)||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';

export function fmtDate(s){
  if(!s) return '—';
  const d = new Date(s+ (s.length<=10?'T00:00:00':''));
  if(isNaN(d)) return s;
  return d.toLocaleDateString('pt-BR');
}
export function daysUntil(s){
  if(!s) return Infinity;
  const d = new Date(s+'T00:00:00');
  return Math.ceil((d - new Date().setHours(0,0,0,0))/86400000);
}

export function uid(prefix='ID'){ return prefix + Math.random().toString(36).slice(2,8).toUpperCase(); }

export function el(html){
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// Toast
export function toast(msg, type='info'){
  const root = document.getElementById('toast-root');
  const colors = { info:'border-brand-600 text-brand-200', success:'border-emerald-600 text-emerald-200', error:'border-rose-600 text-rose-200', warn:'border-amber-600 text-amber-200' };
  const icons = { info:'info', success:'check-circle-2', error:'x-circle', warn:'alert-triangle' };
  const node = el(`<div class="card fade-in flex items-center gap-3 px-4 py-3 border ${colors[type]||colors.info} shadow-lg max-w-sm">
    <i data-lucide="${icons[type]||'info'}" class="w-4 h-4 shrink-0"></i>
    <span class="text-sm text-slate-100">${msg}</span>
  </div>`);
  root.appendChild(node);
  if(window.lucideRefresh) window.lucideRefresh();
  setTimeout(()=>{ node.style.transition='opacity .3s'; node.style.opacity='0'; setTimeout(()=>node.remove(),300); }, 3200);
}

// Modal
export function openModal(title, contentNode, { wide=false }={}){
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  const overlay = el(`<div class="fixed inset-0 z-[90] flex items-start justify-center p-4 sm:p-8 overflow-y-auto" style="background:rgba(5,8,12,.72);backdrop-filter:blur(4px)">
    <div class="card w-full ${wide?'max-w-4xl':'max-w-lg'} my-4 fade-in">
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <h3 class="font-semibold text-slate-100">${title}</h3>
        <button data-close class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
      </div>
      <div data-body class="p-5"></div>
    </div>
  </div>`);
  overlay.querySelector('[data-body]').appendChild(contentNode);
  overlay.addEventListener('click', e=>{ if(e.target===overlay || e.target.closest('[data-close]')) closeModal(); });
  root.appendChild(overlay);
  if(window.lucideRefresh) window.lucideRefresh();
  return overlay;
}
export function closeModal(){ document.getElementById('modal-root').innerHTML=''; }

// Mini SVG line chart
export function sparkline(values, { w=120, h=40, color='#22d3ee', fill=true }={}){
  if(!values.length) return '';
  const max = Math.max(...values), min = Math.min(...values);
  const range = max-min || 1;
  const step = w/(values.length-1||1);
  const pts = values.map((v,i)=>[i*step, h - ((v-min)/range)*(h-6) - 3]);
  const d = pts.map((p,i)=> (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area = fill ? `<path d="${d} L ${w} ${h} L 0 ${h} Z" fill="${color}" opacity="0.08"/>` : '';
  return `<svg viewBox="0 0 ${w} ${h}" class="w-full h-full" preserveAspectRatio="none">${area}<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// Bar chart
export function barChart(data, { color='#0891b2', color2='#334155', h=180 }={}){
  const max = Math.max(...data.map(d=>Math.max(d.a||0,d.b||0)))||1;
  return `<div class="flex items-end gap-3 sm:gap-4" style="height:${h}px">
    ${data.map(d=>`<div class="flex-1 flex flex-col items-center gap-1 h-full justify-end">
      <div class="w-full flex gap-1 items-end h-full justify-center">
        <div class="w-1/2 rounded-t" style="height:${(d.a/max*100).toFixed(1)}%;background:${color}" title="${d.a}"></div>
        ${d.b!==undefined?`<div class="w-1/2 rounded-t" style="height:${(d.b/max*100).toFixed(1)}%;background:${color2}" title="${d.b}"></div>`:''}
      </div>
      <span class="text-[11px] text-slate-500">${d.label}</span>
    </div>`).join('')}
  </div>`;
}

// Donut
export function donut(segments, { size=140 }={}){
  const total = segments.reduce((s,x)=>s+x.value,0)||1;
  let acc=0; const r=size/2-14, c=size/2, circ=2*Math.PI*r;
  const arcs = segments.map(s=>{
    const frac=s.value/total; const dash=frac*circ;
    const el=`<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${s.color}" stroke-width="14" stroke-dasharray="${dash} ${circ-dash}" stroke-dashoffset="${-acc*circ}" transform="rotate(-90 ${c} ${c})"/>`;
    acc+=frac; return el;
  }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#1e293b" stroke-width="14"/>${arcs}</svg>`;
}

// EAN-13 barcode renderer (SVG) — encodes given 13-digit code
const EAN_L={'0':'0001101','1':'0011001','2':'0010011','3':'0111101','4':'0100011','5':'0110001','6':'0101111','7':'0111011','8':'0110111','9':'0001011'};
const EAN_G={'0':'0100111','1':'0110011','2':'0011011','3':'0100001','4':'0011101','5':'0111001','6':'0000101','7':'0010001','8':'0001001','9':'0010111'};
const EAN_R={'0':'1110010','1':'1100110','2':'1101100','3':'1000010','4':'1011100','5':'1001110','6':'1010000','7':'1000100','8':'1001000','9':'1110100'};
const EAN_PARITY={'0':'LLLLLL','1':'LLGLGG','2':'LLGGLG','3':'LLGGGL','4':'LGLLGG','5':'LGGLLG','6':'LGGGLL','7':'LGLGLG','8':'LGLGGL','9':'LGGLGL'};
export function ean13(code){
  code = (code||'').replace(/\D/g,'').padStart(13,'0').slice(0,13);
  let bits='101'; // start guard
  const parity = EAN_PARITY[code[0]];
  for(let i=1;i<=6;i++){ bits += (parity[i-1]==='L'?EAN_L:EAN_G)[code[i]]; }
  bits+='01010'; // center
  for(let i=7;i<=12;i++){ bits += EAN_R[code[i]]; }
  bits+='101'; // end guard
  const barW=2, h=60;
  let x=0, rects='';
  for(const b of bits){ if(b==='1') rects+=`<rect x="${x}" y="0" width="${barW}" height="${h}"/>`; x+=barW; }
  return `<svg viewBox="0 0 ${x} ${h+16}" class="w-full" style="max-width:220px"><g fill="#0f141b">${rects}</g><text x="${x/2}" y="${h+13}" text-anchor="middle" font-size="11" font-family="monospace" fill="#0f141b">${code}</text></svg>`;
}
export function eanValid(code){
  code=(code||'').replace(/\D/g,''); if(code.length!==13) return false;
  let s=0; for(let i=0;i<12;i++){ s += (+code[i])*(i%2?3:1); }
  return (10-(s%10))%10 === +code[12];
}

// QR Code — via public renderer image (offline-safe fallback to canvas grid)
export function qrImg(text, size=140){
  const url = 'https://api.qrserver.com/v1/create-qr-code/?size='+size+'x'+size+'&data='+encodeURIComponent(text);
  return `<img src="${url}" width="${size}" height="${size}" alt="QR" class="rounded bg-white p-1" onerror="this.style.display='none'"/>`;
}

export function csvExport(filename, rows){
  const csv = rows.map(r=>r.map(c=>{ const s=String(c??''); return /[",\n;]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }).join(';')).join('\n');
  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}
