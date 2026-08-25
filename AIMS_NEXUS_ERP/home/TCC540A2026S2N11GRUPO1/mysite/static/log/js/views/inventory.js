import { state, lotsForProduct, orderLots, simulatePick, stockLevel, stockValue, addStock, removeStock, productById, warehouseById } from '../store.js';
import { BRL, NUM, fmtDate, todayISO, daysBetween, generateEAN13, uid, toast, escapeHTML } from '../utils.js';

let method = 'FIFO';
let selectedProduct = null;

const METHODS = {
  FIFO: { name:'FIFO', full:'First In, First Out', desc:'Consome primeiro os lotes mais antigos por data de entrada.', icon:'arrow-right-left' },
  FEFO: { name:'FEFO', full:'First Expired, First Out', desc:'Prioriza lotes com vencimento mais próximo — ideal para perecíveis.', icon:'alarm-clock' },
  LIFO: { name:'LIFO', full:'Last In, First Out', desc:'Consome primeiro os lotes mais recentes por data de entrada.', icon:'layers' },
};

export function renderInventory(){
  const d = state.data;
  if(!selectedProduct && d.products[0]) selectedProduct = d.products[0].id;

  const html = `
  <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
    <div class="flex gap-2 flex-wrap">
      ${Object.keys(METHODS).map(m=>`
        <button data-method="${m}" class="tab-btn ${m===method?'active':''} px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 bg-white hover:bg-slate-50 flex items-center gap-2">
          <i data-lucide="${METHODS[m].icon}" class="w-4 h-4"></i>${METHODS[m].name}
        </button>`).join('')}
    </div>
    <div class="sm:ml-auto flex gap-2">
      <button id="btn-addprod" class="btn btn-ghost px-3 py-2 text-sm"><i data-lucide="plus" class="w-4 h-4"></i> Novo produto</button>
      <button id="btn-in" class="btn btn-ghost px-3 py-2 text-sm"><i data-lucide="arrow-down-to-line" class="w-4 h-4"></i> Entrada</button>
      <button id="btn-out" class="btn btn-primary px-3 py-2 text-sm"><i data-lucide="arrow-up-from-line" class="w-4 h-4"></i> Separar (${method})</button>
    </div>
  </div>

  <div class="card p-4 mb-5 flex items-start gap-3 bg-brand-50/40 border-brand-100">
    <div class="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 grid place-items-center shrink-0"><i data-lucide="${METHODS[method].icon}" class="w-4.5 h-4.5 w-[18px] h-[18px]"></i></div>
    <div class="text-sm"><span class="font-bold text-slate-800">${METHODS[method].name}</span> <span class="text-slate-500">— ${METHODS[method].full}.</span> <span class="text-slate-500">${METHODS[method].desc}</span></div>
  </div>

  <div class="grid lg:grid-cols-3 gap-5">
    <!-- products list -->
    <div class="card p-4 lg:col-span-1 h-fit">
      <div class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 px-1">Produtos</div>
      <div class="space-y-1.5">
        ${d.products.map(p=>{
          const units = stockLevel(p.id);
          const active = p.id===selectedProduct;
          return `<button data-prod="${p.id}" class="w-full text-left p-3 rounded-xl border ${active?'border-brand-500 bg-brand-50/50':'border-slate-100 hover:bg-slate-50'} transition">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-slate-700 text-sm truncate">${p.name}</span>
              ${p.perishable?'<span class="badge bg-amber-100 text-amber-700 shrink-0">perecível</span>':''}
            </div>
            <div class="text-[11px] text-slate-400 mt-0.5 flex justify-between"><span>${p.sku}</span><span class="font-semibold text-slate-500">${NUM(Math.round(units))} ${p.unit}</span></div>
          </button>`;
        }).join('')}
      </div>
    </div>

    <!-- lots + simulation -->
    <div class="lg:col-span-2 space-y-5">
      <div id="lot-panel"></div>
      <div id="mov-panel"></div>
    </div>
  </div>
  <div id="modal-root"></div>`;

  setTimeout(bind, 0);
  return html;
}

function bind(){
  document.querySelectorAll('[data-method]').forEach(b=> b.addEventListener('click', ()=>{ method=b.dataset.method; window.__navigate('inventory'); }));
  document.querySelectorAll('[data-prod]').forEach(b=> b.addEventListener('click', ()=>{ selectedProduct=b.dataset.prod; renderLotPanel(); renderMovPanel(); document.querySelectorAll('[data-prod]').forEach(x=>{ const a=x.dataset.prod===selectedProduct; x.classList.toggle('border-brand-500',a); x.classList.toggle('bg-brand-50/50',a); x.classList.toggle('border-slate-100',!a); }); }));
  document.getElementById('btn-addprod')?.addEventListener('click', openAddProduct);
  document.getElementById('btn-in')?.addEventListener('click', openStockIn);
  document.getElementById('btn-out')?.addEventListener('click', openStockOut);
  renderLotPanel(); renderMovPanel();
}

function renderLotPanel(){
  const p = productById(selectedProduct);
  const panel = document.getElementById('lot-panel');
  if(!p || !panel) return;
  const lots = orderLots(lotsForProduct(p.id), method);
  const val = stockValue(p.id), units = stockLevel(p.id);
  panel.innerHTML = `
  <div class="card p-5">
    <div class="flex items-start justify-between gap-3 mb-4 flex-wrap">
      <div>
        <h3 class="font-bold text-slate-800">${escapeHTML(p.name)}</h3>
        <div class="text-xs text-slate-400 mt-0.5">${p.sku} · ${p.category} · EAN ${p.ean}</div>
      </div>
      <div class="text-right">
        <div class="text-xl font-bold text-slate-800">${NUM(Math.round(units))} <span class="text-sm font-medium text-slate-400">${p.unit}</span></div>
        <div class="text-xs text-brand-700 font-semibold">${BRL(val)} em estoque</div>
      </div>
    </div>
    <div class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Fila de consumo — ordem ${method}</div>
    ${lots.length? `<div class="overflow-x-auto -mx-1"><table class="w-full text-sm">
      <thead><tr class="text-left text-[11px] uppercase text-slate-400">
        <th class="py-2 px-1 font-semibold">#</th><th class="px-1 font-semibold">Lote / Entrada</th><th class="px-1 font-semibold">Validade</th><th class="px-1 font-semibold text-right">Saldo</th><th class="px-1 font-semibold text-right">Custo un.</th><th class="px-1 font-semibold">Local</th>
      </tr></thead>
      <tbody>
        ${lots.map((l,i)=>{
          const exp = l.expiry? daysBetween(todayISO(), l.expiry) : null;
          const expColor = exp==null?'text-slate-400': exp<0?'text-rose-600 font-semibold': exp<=7?'text-amber-600 font-semibold':'text-slate-500';
          return `<tr class="border-t border-slate-50">
            <td class="py-2.5 px-1"><span class="w-6 h-6 rounded-lg ${i===0?'bg-brand-600 text-white':'bg-slate-100 text-slate-500'} grid place-items-center text-xs font-bold">${i+1}</span></td>
            <td class="px-1"><div class="font-medium text-slate-700">Lote ${l.id.slice(-4).toUpperCase()}</div><div class="text-[11px] text-slate-400">${fmtDate(l.date)}</div></td>
            <td class="px-1 ${expColor}">${l.expiry? fmtDate(l.expiry)+(exp<0?' (venc.)':exp<=30?` (${exp}d)`:'') : '—'}</td>
            <td class="px-1 text-right font-semibold text-slate-700">${NUM(Math.round(l.remaining))}</td>
            <td class="px-1 text-right text-slate-500">${BRL(l.unitCost)}</td>
            <td class="px-1 text-[11px] text-slate-400">${warehouseById(l.warehouseId)?.name||'—'}</td>
          </tr>`;
        }).join('')}
      </tbody></table></div>` : `<div class="text-sm text-slate-400 py-8 text-center">Sem lotes em estoque. Registre uma entrada.</div>`}
    ${lots[0]? `<div class="mt-3 text-[11px] text-slate-400 flex items-center gap-1.5"><i data-lucide="corner-down-right" class="w-3.5 h-3.5"></i> Próxima saída consumirá o <b class="text-slate-600">Lote ${lots[0].id.slice(-4).toUpperCase()}</b> primeiro.</div>`:''}
  </div>`;
  window.__refreshIcons?.();
}

function renderMovPanel(){
  const p = productById(selectedProduct);
  const panel = document.getElementById('mov-panel');
  if(!p || !panel) return;
  const movs = state.data.movements.filter(m=>m.productId===p.id).reverse();
  panel.innerHTML = `
  <div class="card p-5">
    <h3 class="font-bold text-slate-800 mb-3">Histórico de movimentações</h3>
    ${movs.length? `<div class="space-y-1.5 max-h-80 overflow-auto">
      ${movs.map(m=>{
        const isIn = m.type==='in';
        const consumedTxt = m.consumed? m.consumed.map(c=>`Lote ${c.lotId.slice(-4).toUpperCase()} (${NUM(Math.round(c.qty))})`).join(', ') : '';
        return `<div class="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
          <div class="w-8 h-8 rounded-lg grid place-items-center ${isIn?'bg-emerald-50 text-emerald-600':'bg-rose-50 text-rose-600'}"><i data-lucide="${isIn?'arrow-down-to-line':'arrow-up-from-line'}" class="w-4 h-4"></i></div>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-slate-700">${m.ref||(isIn?'Entrada':'Saída')} ${m.method?`<span class="badge bg-slate-100 text-slate-500">${m.method}</span>`:''}</div>
            <div class="text-[11px] text-slate-400 truncate">${fmtDate(m.date)}${consumedTxt?' · '+consumedTxt:''}${m.totalCost?' · custo '+BRL(m.totalCost):''}</div>
          </div>
          <div class="text-sm font-semibold shrink-0 ${isIn?'text-emerald-600':'text-rose-600'}">${isIn?'+':'−'}${NUM(m.qty)}</div>
        </div>`;
      }).join('')}
    </div>` : `<div class="text-sm text-slate-400 py-6 text-center">Sem movimentações.</div>`}
  </div>`;
  window.__refreshIcons?.();
}

// ===== Modals =====
function modal(inner){
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="fixed inset-0 modal-bg z-50 flex items-center justify-center p-4" id="ov">
    <div class="card w-full max-w-md p-5 max-h-[90vh] overflow-auto" onclick="event.stopPropagation()">${inner}</div>
  </div>`;
  document.getElementById('ov').addEventListener('click', ()=> root.innerHTML='');
  window.__refreshIcons?.();
}
function closeModal(){ document.getElementById('modal-root').innerHTML=''; }
window.__closeInvModal = closeModal;

function openAddProduct(){
  modal(`
    <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2"><i data-lucide="package-plus" class="w-5 h-5 text-brand-700"></i> Novo produto</h3>
    <div class="space-y-3">
      <div><label class="text-xs font-semibold text-slate-500">Nome</label><input id="np-name" class="field mt-1" placeholder="Ex: Café Torrado 500g"></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-xs font-semibold text-slate-500">SKU</label><input id="np-sku" class="field mt-1" placeholder="CAT-XXX-000"></div>
        <div><label class="text-xs font-semibold text-slate-500">Unidade</label><input id="np-unit" class="field mt-1" value="un"></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-xs font-semibold text-slate-500">Categoria</label>
          <select id="np-cat" class="field mt-1"><option>Alimentos</option><option>Bebidas</option><option>Farmacêutico</option><option>Eletrônicos</option><option>Vestuário</option><option>Industrial</option><option>Outros</option></select></div>
        <div><label class="text-xs font-semibold text-slate-500">Custo un. (R$)</label><input id="np-cost" type="number" step="0.01" class="field mt-1" value="0"></div>
      </div>
      <label class="flex items-center gap-2 text-sm text-slate-600"><input id="np-per" type="checkbox" class="w-4 h-4 accent-brand-600"> Produto perecível (usa FEFO)</label>
    </div>
    <div class="flex gap-2 mt-5">
      <button onclick="__closeInvModal()" class="btn btn-ghost flex-1 py-2.5 text-sm">Cancelar</button>
      <button id="np-save" class="btn btn-primary flex-1 py-2.5 text-sm">Criar produto</button>
    </div>`);
  document.getElementById('np-save').addEventListener('click', ()=>{
    const name = document.getElementById('np-name').value.trim();
    if(!name){ toast('Informe o nome','warn'); return; }
    const prod = { id:uid(), name, sku:document.getElementById('np-sku').value.trim()||('SKU-'+Math.floor(Math.random()*9999)), unit:document.getElementById('np-unit').value.trim()||'un', category:document.getElementById('np-cat').value, unitCost:+document.getElementById('np-cost').value||0, ean:generateEAN13(), perishable:document.getElementById('np-per').checked };
    state.data.products.push(prod); selectedProduct=prod.id;
    import('../store.js').then(m=>m.saveData());
    closeModal(); window.__navigate('inventory'); toast('Produto criado');
  });
}

function openStockIn(){
  const p = productById(selectedProduct);
  const whOpts = state.data.warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  modal(`
    <h3 class="font-bold text-slate-800 mb-1 flex items-center gap-2"><i data-lucide="arrow-down-to-line" class="w-5 h-5 text-emerald-600"></i> Entrada de estoque</h3>
    <p class="text-xs text-slate-400 mb-4">${escapeHTML(p.name)}</p>
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-xs font-semibold text-slate-500">Quantidade</label><input id="si-qty" type="number" min="1" class="field mt-1" value="100"></div>
        <div><label class="text-xs font-semibold text-slate-500">Custo un. (R$)</label><input id="si-cost" type="number" step="0.01" class="field mt-1" value="${p.unitCost}"></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-xs font-semibold text-slate-500">Data entrada</label><input id="si-date" type="date" class="field mt-1" value="${todayISO()}"></div>
        <div><label class="text-xs font-semibold text-slate-500">Validade ${p.perishable?'':'(opc.)'}</label><input id="si-exp" type="date" class="field mt-1"></div>
      </div>
      <div><label class="text-xs font-semibold text-slate-500">Centro de distribuição</label><select id="si-wh" class="field mt-1">${whOpts}</select></div>
      <div><label class="text-xs font-semibold text-slate-500">Referência</label><input id="si-ref" class="field mt-1" placeholder="Ex: NF 12345 / Compra"></div>
    </div>
    <div class="flex gap-2 mt-5">
      <button onclick="__closeInvModal()" class="btn btn-ghost flex-1 py-2.5 text-sm">Cancelar</button>
      <button id="si-save" class="btn btn-primary flex-1 py-2.5 text-sm">Registrar entrada</button>
    </div>`);
  document.getElementById('si-save').addEventListener('click', ()=>{
    const qty=+document.getElementById('si-qty').value;
    if(!qty||qty<=0){ toast('Quantidade inválida','warn'); return; }
    addStock({ productId:p.id, qty, unitCost:+document.getElementById('si-cost').value||0, date:document.getElementById('si-date').value||todayISO(), expiry:document.getElementById('si-exp').value||null, warehouseId:document.getElementById('si-wh').value, ref:document.getElementById('si-ref').value.trim()||'Entrada' });
    closeModal(); renderLotPanel(); renderMovPanel(); toast('Entrada registrada');
  });
}

function openStockOut(){
  const p = productById(selectedProduct);
  const render = (qty)=>{
    const sim = simulatePick(p.id, qty||0, method);
    const box = document.getElementById('so-sim');
    if(!box) return;
    if(!qty||qty<=0){ box.innerHTML=''; return; }
    if(sim.shortfall>0){ box.innerHTML=`<div class="text-sm text-rose-600 bg-rose-50 rounded-xl p-3 flex items-center gap-2"><i data-lucide="alert-triangle" class="w-4 h-4"></i> Estoque insuficiente. Faltam ${NUM(Math.round(sim.shortfall))} ${p.unit}.</div>`; window.__refreshIcons?.(); return; }
    box.innerHTML = `<div class="bg-slate-50 rounded-xl p-3">
      <div class="text-[11px] font-semibold text-slate-400 uppercase mb-2">Simulação ${method} — lotes consumidos</div>
      ${sim.consumed.map(c=>`<div class="flex justify-between text-sm py-0.5"><span class="text-slate-600">Lote ${c.lotId.slice(-4).toUpperCase()} ${c.expiry?'· venc '+fmtDate(c.expiry):''}</span><span class="font-semibold text-slate-700">${NUM(Math.round(c.qty))} × ${BRL(c.unitCost)}</span></div>`).join('')}
      <div class="flex justify-between text-sm border-t border-slate-200 mt-2 pt-2 font-bold text-slate-800"><span>Custo total (CMV)</span><span>${BRL(sim.totalCost)}</span></div>
    </div>`;
    window.__refreshIcons?.();
  };
  modal(`
    <h3 class="font-bold text-slate-800 mb-1 flex items-center gap-2"><i data-lucide="arrow-up-from-line" class="w-5 h-5 text-rose-600"></i> Separação / Saída — ${method}</h3>
    <p class="text-xs text-slate-400 mb-4">${escapeHTML(p.name)} · disponível ${NUM(Math.round(stockLevel(p.id)))} ${p.unit}</p>
    <div class="space-y-3">
      <div><label class="text-xs font-semibold text-slate-500">Quantidade a separar</label><input id="so-qty" type="number" min="1" class="field mt-1" value="10"></div>
      <div><label class="text-xs font-semibold text-slate-500">Referência (pedido)</label><input id="so-ref" class="field mt-1" placeholder="Ex: Pedido #1050"></div>
      <div id="so-sim"></div>
    </div>
    <div class="flex gap-2 mt-5">
      <button onclick="__closeInvModal()" class="btn btn-ghost flex-1 py-2.5 text-sm">Cancelar</button>
      <button id="so-save" class="btn btn-primary flex-1 py-2.5 text-sm">Confirmar saída</button>
    </div>`);
  const qtyEl = document.getElementById('so-qty');
  qtyEl.addEventListener('input', ()=> render(+qtyEl.value));
  render(+qtyEl.value);
  document.getElementById('so-save').addEventListener('click', ()=>{
    const qty=+qtyEl.value;
    const res = removeStock({ productId:p.id, qty, method, warehouseId:null, ref:document.getElementById('so-ref').value.trim()||'Separação '+method });
    if(!res.ok){ toast('Estoque insuficiente','err'); return; }
    closeModal(); renderLotPanel(); renderMovPanel(); toast(`Saída ${method} registrada · CMV ${BRL(res.totalCost)}`);
  });
}
