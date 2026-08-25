import { state, productById } from '../store.js';
import { ean13SVG, generateEAN13, isValidEAN13, escapeHTML, toast, NUM, BRL } from '../utils.js';

// qrcodejs helper — renders into a container element
function makeQR(box, text, ec='M', size=200){
  if(!box || !window.QRCode) return;
  box.innerHTML = '';
  const level = { L:0, M:1, Q:2, H:3 }[ec] ?? 1;
  new window.QRCode(box, { text: text||' ', width:size, height:size, colorDark:'#0f172a', colorLight:'#ffffff', correctLevel: level });
}

let mode = 'ean'; // 'ean' | 'qr'
let lastEAN = generateEAN13();

export function renderCodes(){
  const d = state.data;
  const html = `
  <div class="flex gap-2 mb-5">
    <button data-cmode="ean" class="tab-btn ${mode==='ean'?'active':''} px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 bg-white flex items-center gap-2"><i data-lucide="barcode" class="w-4 h-4"></i> EAN-13</button>
    <button data-cmode="qr" class="tab-btn ${mode==='qr'?'active':''} px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 bg-white flex items-center gap-2"><i data-lucide="qr-code" class="w-4 h-4"></i> QR Code</button>
  </div>

  <div class="grid lg:grid-cols-2 gap-5">
    <div id="gen-panel"></div>
    <div class="card p-5">
      <h3 class="font-bold text-slate-800 mb-3">Etiquetas de produtos</h3>
      <p class="text-xs text-slate-400 mb-4">Códigos EAN-13 associados a cada SKU. Clique para gerar o QR de rastreio.</p>
      <div class="space-y-2 max-h-[520px] overflow-auto pr-1">
        ${d.products.map(p=>`
          <div class="border border-slate-100 rounded-xl p-3 flex items-center gap-3">
            <div class="w-28 shrink-0 barcode">${ean13SVG(p.ean,{scale:1.4,height:44})}</div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-slate-700 truncate">${escapeHTML(p.name)}</div>
              <div class="text-[11px] text-slate-400">${p.sku} · ${NUM(p.ean)}</div>
            </div>
            <button data-qrprod="${p.id}" class="btn btn-ghost px-2.5 py-1.5 text-xs shrink-0"><i data-lucide="qr-code" class="w-3.5 h-3.5"></i></button>
          </div>`).join('')}
      </div>
    </div>
  </div>
  <div id="modal-root3"></div>`;
  setTimeout(()=>{ renderGenPanel(); bindCodes(); }, 0);
  return html;
}

function bindCodes(){
  document.querySelectorAll('[data-cmode]').forEach(b=> b.addEventListener('click', ()=>{ mode=b.dataset.cmode; window.__navigate('codes'); }));
  document.querySelectorAll('[data-qrprod]').forEach(b=> b.addEventListener('click', ()=> openProductQR(b.dataset.qrprod)));
}

function renderGenPanel(){
  const panel = document.getElementById('gen-panel');
  if(mode==='ean'){
    panel.innerHTML = `
    <div class="card p-5">
      <h3 class="font-bold text-slate-800 mb-1">Gerador EAN-13</h3>
      <p class="text-xs text-slate-400 mb-4">Código de barras padrão com dígito verificador calculado automaticamente.</p>
      <div class="flex gap-2 mb-3">
        <input id="ean-in" class="field font-mono" maxlength="13" value="${lastEAN}" placeholder="13 dígitos">
        <button id="ean-gen" class="btn btn-ghost px-3 shrink-0"><i data-lucide="dice-5" class="w-4 h-4"></i></button>
      </div>
      <div class="flex flex-wrap gap-2 mb-4">
        ${['789','790','780','000'].map(pfx=>`<button data-pfx="${pfx}" class="badge bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer">Prefixo ${pfx}</button>`).join('')}
      </div>
      <div id="ean-out" class="bg-white border border-slate-200 rounded-xl p-4 grid place-items-center min-h-[140px]"></div>
      <div id="ean-msg" class="text-xs mt-2"></div>
      <div class="flex gap-2 mt-4">
        <button id="ean-svg" class="btn btn-ghost flex-1 py-2.5 text-sm"><i data-lucide="download" class="w-4 h-4"></i> Baixar SVG</button>
        <button id="ean-copy" class="btn btn-primary flex-1 py-2.5 text-sm"><i data-lucide="copy" class="w-4 h-4"></i> Copiar código</button>
      </div>
    </div>`;
    const draw = ()=>{
      const v = document.getElementById('ean-in').value.trim();
      const out = document.getElementById('ean-out'), msg=document.getElementById('ean-msg');
      if(isValidEAN13(v)){ out.innerHTML=`<div class="barcode w-full max-w-[280px]">${ean13SVG(v,{scale:2.4,height:80})}</div>`; msg.innerHTML='<span class="text-emerald-600 font-medium">✓ Código válido</span>'; lastEAN=v; }
      else if(/^\d{12}$/.test(v)){ const full=generateEAN13(v); document.getElementById('ean-in').value=full; draw(); }
      else { out.innerHTML='<span class="text-slate-300 text-sm">Digite 13 dígitos válidos</span>'; msg.innerHTML='<span class="text-rose-500 font-medium">✗ Código inválido (dígito verificador)</span>'; }
      window.__refreshIcons?.();
    };
    document.getElementById('ean-in').addEventListener('input', draw);
    document.getElementById('ean-gen').addEventListener('click', ()=>{ document.getElementById('ean-in').value=generateEAN13(); draw(); });
    document.querySelectorAll('[data-pfx]').forEach(b=> b.addEventListener('click', ()=>{ document.getElementById('ean-in').value=generateEAN13(b.dataset.pfx); draw(); }));
    document.getElementById('ean-copy').addEventListener('click', ()=>{ navigator.clipboard?.writeText(document.getElementById('ean-in').value); toast('Código copiado'); });
    document.getElementById('ean-svg').addEventListener('click', ()=>{
      const svg = document.querySelector('#ean-out svg'); if(!svg){ toast('Gere um código válido','warn'); return; }
      const blob = new Blob([svg.outerHTML], { type:'image/svg+xml' }); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`ean13-${document.getElementById('ean-in').value}.svg`; a.click();
    });
    draw();
  } else {
    panel.innerHTML = `
    <div class="card p-5">
      <h3 class="font-bold text-slate-800 mb-1">Gerador QR Code</h3>
      <p class="text-xs text-slate-400 mb-4">Para rastreio de volumes, links de rota ou dados de produto.</p>
      <textarea id="qr-in" class="field font-mono h-24 resize-none" placeholder="Texto, URL ou JSON de rastreio">LOGIFLOW|TRACK|SHP-1001|Guarulhos-SP>Rio de Janeiro-RJ</textarea>
      <div class="flex items-center gap-3 my-3">
        <label class="text-xs font-semibold text-slate-500">Correção de erro</label>
        <select id="qr-ec" class="field w-auto"><option value="L">L (7%)</option><option value="M" selected>M (15%)</option><option value="Q">Q (25%)</option><option value="H">H (30%)</option></select>
      </div>
      <div id="qr-out" class="bg-white border border-slate-200 rounded-xl p-4 grid place-items-center min-h-[200px]"><div id="qr-box"></div></div>
      <div class="flex gap-2 mt-4">
        <button id="qr-dl" class="btn btn-ghost flex-1 py-2.5 text-sm"><i data-lucide="download" class="w-4 h-4"></i> Baixar PNG</button>
        <button id="qr-copy" class="btn btn-primary flex-1 py-2.5 text-sm"><i data-lucide="copy" class="w-4 h-4"></i> Copiar conteúdo</button>
      </div>
    </div>`;
    const draw = ()=>{
      const v = document.getElementById('qr-in').value || ' ';
      const ec = document.getElementById('qr-ec').value;
      makeQR(document.getElementById('qr-box'), v, ec, 200);
    };
    document.getElementById('qr-in').addEventListener('input', draw);
    document.getElementById('qr-ec').addEventListener('change', draw);
    document.getElementById('qr-dl').addEventListener('click', ()=>{
      const c=document.querySelector('#qr-box canvas'); const img=document.querySelector('#qr-box img');
      const url = c? c.toDataURL('image/png') : (img? img.src : null);
      if(!url){ toast('Gere um QR primeiro','warn'); return; }
      const a=document.createElement('a'); a.href=url; a.download='qrcode.png'; a.click();
    });
    document.getElementById('qr-copy').addEventListener('click', ()=>{ navigator.clipboard?.writeText(document.getElementById('qr-in').value); toast('Conteúdo copiado'); });
    draw();
  }
  window.__refreshIcons?.();
}

function openProductQR(pid){
  const p = productById(pid);
  const root = document.getElementById('modal-root3');
  const payload = `LOGIFLOW|PRODUCT|${p.sku}|EAN:${p.ean}|${p.name}`;
  root.innerHTML = `<div class="fixed inset-0 modal-bg z-50 flex items-center justify-center p-4" id="ov3">
    <div class="card w-full max-w-xs p-5 text-center" onclick="event.stopPropagation()">
      <h3 class="font-bold text-slate-800 mb-1">${escapeHTML(p.name)}</h3>
      <p class="text-xs text-slate-400 mb-3">QR de rastreio</p>
      <div class="grid place-items-center mb-3"><div id="pqr"></div></div>
      <div class="barcode mb-3">${ean13SVG(p.ean,{scale:2,height:60})}</div>
      <button onclick="document.getElementById('modal-root3').innerHTML=''" class="btn btn-primary w-full py-2.5 text-sm">Fechar</button>
    </div></div>`;
  document.getElementById('ov3').addEventListener('click', ()=> root.innerHTML='');
  makeQR(document.getElementById('pqr'), payload, 'M', 180);
  window.__refreshIcons?.();
}
