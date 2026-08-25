import { state, stockLevel, stockValue, lotsForProduct, productById } from '../store.js';
import { BRL, NUM, daysBetween, todayISO, fmtDate } from '../utils.js';

export function renderDashboard(){
  const d = state.data;
  const totalValue = d.products.reduce((s,p)=> s + stockValue(p.id), 0);
  const totalUnits = d.products.reduce((s,p)=> s + stockLevel(p.id), 0);
  const skus = d.products.length;
  const activeShip = d.shipments.filter(s=> s.status!=='Entregue').length;
  const freightTotal = d.shipments.reduce((s,x)=> s + (x.cost||0), 0);

  // expiry risk (FEFO)
  const today = todayISO();
  const expiring = [];
  d.products.forEach(p=>{
    lotsForProduct(p.id).forEach(l=>{
      if(l.expiry){
        const dd = daysBetween(today, l.expiry);
        if(dd<=30) expiring.push({ product:p, lot:l, days:dd });
      }
    });
  });
  expiring.sort((a,b)=>a.days-b.days);

  const modes = {};
  d.shipments.forEach(s=> modes[s.mode]=(modes[s.mode]||0)+1);

  const kpi = (icon,label,value,sub,color)=>`
    <div class="card p-4 lg:p-5">
      <div class="flex items-start justify-between">
        <div>
          <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">${label}</div>
          <div class="text-2xl font-bold text-slate-800 mt-1">${value}</div>
          <div class="text-xs text-slate-400 mt-0.5">${sub}</div>
        </div>
        <div class="w-10 h-10 rounded-xl grid place-items-center ${color}"><i data-lucide="${icon}" class="w-5 h-5"></i></div>
      </div>
    </div>`;

  return `
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    ${kpi('wallet','Valor em estoque',BRL(totalValue),`${NUM(Math.round(totalUnits))} unidades`,'bg-brand-50 text-brand-700')}
    ${kpi('package','SKUs ativos',NUM(skus),`${d.warehouses.length} centros de distrib.`,'bg-indigo-50 text-indigo-600')}
    ${kpi('truck','Embarques ativos',NUM(activeShip),`${d.shipments.length} no total`,'bg-amber-50 text-amber-600')}
    ${kpi('receipt','Frete acumulado',BRL(freightTotal),'todos os modais','bg-rose-50 text-rose-600')}
  </div>

  <div class="grid lg:grid-cols-3 gap-4 lg:gap-6">
    <div class="card p-5 lg:col-span-2">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-slate-800">Estoque por produto</h3>
        <button onclick="__navigate('inventory')" class="text-xs font-semibold text-brand-700 hover:underline">Gerenciar →</button>
      </div>
      <div class="space-y-3">
        ${d.products.map(p=>{
          const units = stockLevel(p.id);
          const val = stockValue(p.id);
          const max = Math.max(...d.products.map(x=>stockLevel(x.id)),1);
          const pct = Math.round(units/max*100);
          return `<div>
            <div class="flex items-center justify-between text-sm mb-1">
              <div class="flex items-center gap-2 min-w-0">
                <span class="dot ${p.perishable?'bg-amber-400':'bg-brand-500'}"></span>
                <span class="font-medium text-slate-700 truncate">${p.name}</span>
                <span class="badge bg-slate-100 text-slate-500 hidden sm:inline">${p.category}</span>
              </div>
              <span class="text-slate-500 shrink-0 ml-2">${NUM(Math.round(units))} ${p.unit} · ${BRL(val)}</span>
            </div>
            <div class="h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-brand-500 rounded-full" style="width:${pct}%"></div></div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="card p-5">
      <div class="flex items-center gap-2 mb-4">
        <i data-lucide="alarm-clock" class="w-4.5 h-4.5 text-amber-500 w-[18px] h-[18px]"></i>
        <h3 class="font-bold text-slate-800">Risco de validade (FEFO)</h3>
      </div>
      ${expiring.length? `<div class="space-y-2.5 max-h-72 overflow-auto pr-1">
        ${expiring.slice(0,8).map(e=>`
          <div class="flex items-center justify-between p-2.5 rounded-xl ${e.days<0?'bg-rose-50':e.days<=7?'bg-amber-50':'bg-slate-50'}">
            <div class="min-w-0">
              <div class="text-sm font-medium text-slate-700 truncate">${e.product.name}</div>
              <div class="text-[11px] text-slate-400">Lote vence ${fmtDate(e.lot.expiry)} · ${NUM(Math.round(e.lot.remaining))} ${e.product.unit}</div>
            </div>
            <span class="badge ${e.days<0?'bg-rose-600 text-white':e.days<=7?'bg-amber-500 text-white':'bg-slate-200 text-slate-600'} shrink-0 ml-2">${e.days<0?'Vencido':e.days+'d'}</span>
          </div>`).join('')}
      </div>` : `<div class="text-sm text-slate-400 py-8 text-center">Nenhum lote em risco nos próximos 30 dias.</div>`}
    </div>
  </div>

  <div class="grid lg:grid-cols-3 gap-4 lg:gap-6 mt-6">
    <div class="card p-5">
      <h3 class="font-bold text-slate-800 mb-4">Distribuição por modal</h3>
      <div class="space-y-3">
        ${Object.keys(modes).length? Object.entries(modes).map(([m,c])=>{
          const icon = {Rodoviário:'truck',Aéreo:'plane',Ferroviário:'train-front',Marítimo:'ship',Dutoviário:'git-commit-horizontal'}[m]||'truck';
          const total = d.shipments.length;
          return `<div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 grid place-items-center"><i data-lucide="${icon}" class="w-4 h-4"></i></div>
            <div class="flex-1">
              <div class="flex justify-between text-sm"><span class="font-medium text-slate-700">${m}</span><span class="text-slate-400">${c}</span></div>
              <div class="h-1.5 bg-slate-100 rounded-full mt-1"><div class="h-full bg-brand-500 rounded-full" style="width:${Math.round(c/total*100)}%"></div></div>
            </div>
          </div>`;
        }).join('') : '<div class="text-sm text-slate-400">Sem embarques.</div>'}
      </div>
    </div>

    <div class="card p-5 lg:col-span-2">
      <h3 class="font-bold text-slate-800 mb-4">Últimas movimentações</h3>
      <div class="space-y-1.5 max-h-72 overflow-auto">
        ${[...d.movements].reverse().slice(0,10).map(m=>{
          const p = productById(m.productId);
          const isIn = m.type==='in';
          return `<div class="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
            <div class="w-8 h-8 rounded-lg grid place-items-center ${isIn?'bg-emerald-50 text-emerald-600':'bg-rose-50 text-rose-600'}">
              <i data-lucide="${isIn?'arrow-down-to-line':'arrow-up-from-line'}" class="w-4 h-4"></i>
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-slate-700 truncate">${p?.name||'—'}</div>
              <div class="text-[11px] text-slate-400">${fmtDate(m.date)} · ${m.ref||''} ${m.method?'· '+m.method:''}</div>
            </div>
            <div class="text-sm font-semibold shrink-0 ${isIn?'text-emerald-600':'text-rose-600'}">${isIn?'+':'−'}${NUM(m.qty)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}
