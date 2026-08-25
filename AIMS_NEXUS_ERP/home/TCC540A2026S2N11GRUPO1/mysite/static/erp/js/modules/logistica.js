import { state, setState } from '../store.js';
import { BRL, NUM, fmtDate, daysUntil, toast } from '../utils.js';
import { MODAIS, METODOS_ESTOQUE } from '../data.js';
import { askAI } from '../ai.js';

let metodo = 'FEFO';
let prodSel = null;

export function renderLogistica(view){
  if(!prodSel) prodSel = state.produtos[0]?.id;
  const cfg = state.modalConfig;

  view.innerHTML = `
  <div class="space-y-6">
    <!-- FIFO/FEFO/LIFO -->
    <div class="card p-5">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 class="font-semibold text-slate-100 flex items-center gap-2"><i data-lucide="layers" class="w-4 h-4 text-brand-400"></i>Simulador de Movimentação de Estoque</h3>
          <p class="text-xs text-slate-500 mt-0.5">Ordem de consumo dos lotes por método FIFO · FEFO · LIFO</p>
        </div>
        <select id="prodsel" class="field !w-auto">${state.produtos.map(p=>`<option value="${p.id}" ${p.id===prodSel?'selected':''}>${p.nome}</option>`).join('')}</select>
      </div>
      <div class="flex gap-2 mb-4 flex-wrap">
        ${METODOS_ESTOQUE.map(m=>`<button data-m="${m.id}" class="tab-btn ${m.id===metodo?'active':''} btn btn-ghost !py-1.5 text-xs" title="${m.desc}">${m.nome}</button>`).join('')}
      </div>
      <p class="text-xs text-slate-500 mb-3">${METODOS_ESTOQUE.find(m=>m.id===metodo).desc}</p>
      <div id="lote-order"></div>
      <div class="mt-4 flex items-end gap-3 flex-wrap">
        <div><label class="text-xs text-slate-400">Simular saída (qtd)</label><input id="sim-qtd" type="number" min="1" value="150" class="field mt-1 !w-32"></div>
        <button id="sim-run" class="btn btn-primary !py-2 text-sm"><i data-lucide="play" class="w-4 h-4"></i>Simular baixa</button>
        <button id="ai-log" class="btn btn-ghost !py-2 text-sm"><i data-lucide="brain-circuit" class="w-4 h-4"></i>Recomendação IA</button>
      </div>
      <div id="sim-out" class="hidden mt-4"></div>
      <div id="ai-log-out" class="hidden mt-4 card-soft p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed"></div>
    </div>

    <!-- Modais -->
    <div class="card p-5">
      <h3 class="font-semibold text-slate-100 flex items-center gap-2 mb-1"><i data-lucide="route" class="w-4 h-4 text-brand-400"></i>Comparador de Modais Logísticos</h3>
      <p class="text-xs text-slate-500 mb-4">Custo, prazo e emissão de CO₂ por modal para o trecho informado</p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div><label class="text-xs text-slate-400">Origem</label><input id="mc-o" class="field mt-1" value="${cfg.origem}"></div>
        <div><label class="text-xs text-slate-400">Destino</label><input id="mc-d" class="field mt-1" value="${cfg.destino}"></div>
        <div><label class="text-xs text-slate-400">Distância (km)</label><input id="mc-km" type="number" class="field mt-1" value="${cfg.distancia}"></div>
        <div><label class="text-xs text-slate-400">Peso (kg)</label><input id="mc-peso" type="number" class="field mt-1" value="${cfg.peso}"></div>
      </div>
      <div id="modais-grid" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"></div>
    </div>
  </div>`;

  view.querySelector('#prodsel').addEventListener('change', e=>{ prodSel=e.target.value; renderLogistica(view); window.lucideRefresh(); });
  view.querySelectorAll('[data-m]').forEach(b=>b.addEventListener('click',()=>{ metodo=b.dataset.m; renderLogistica(view); window.lucideRefresh(); }));
  renderLoteOrder(view);
  renderModais(view);

  view.querySelector('#sim-run').addEventListener('click',()=>runSim(view));
  ['#mc-o','#mc-d','#mc-km','#mc-peso'].forEach(sel=>view.querySelector(sel).addEventListener('input',()=>{ saveCfg(view); renderModais(view); window.lucideRefresh(); }));
  view.querySelector('#ai-log').addEventListener('click', async ()=>{
    const out=view.querySelector('#ai-log-out'); out.classList.remove('hidden');
    out.innerHTML=`<div class="ai-typing flex items-center gap-1"><span></span><span></span><span></span><span class="text-slate-500 text-xs ml-2">Avaliando estratégia logística...</span></div>`;
    const p=state.produtos.find(x=>x.id===prodSel);
    const txt=await askAI(`Para o produto "${p.nome}" (validade dos lotes relevante: ${p.lotes.some(l=>l.validade)?'sim':'não'}), qual método entre FIFO, FEFO e LIFO é mais adequado e por quê? E para o transporte ${state.modalConfig.origem} → ${state.modalConfig.destino} (${state.modalConfig.distancia} km, ${state.modalConfig.peso} kg), qual modal recomenda considerando custo, prazo e CO₂?`, { onToken:acc=>out.textContent=acc });
    out.textContent=txt; window.lucideRefresh();
  });
}

function orderedLotes(p){
  const l=[...p.lotes];
  if(metodo==='FIFO') l.sort((a,b)=> a.entrada.localeCompare(b.entrada));
  else if(metodo==='LIFO') l.sort((a,b)=> b.entrada.localeCompare(a.entrada));
  else l.sort((a,b)=> (a.validade||'9999').localeCompare(b.validade||'9999'));
  return l;
}

function renderLoteOrder(view){
  const p=state.produtos.find(x=>x.id===prodSel); if(!p)return;
  const ord=orderedLotes(p);
  view.querySelector('#lote-order').innerHTML = `
  <div class="flex items-stretch gap-2 overflow-x-auto pb-2">
    ${ord.map((l,i)=>{
      const dv=l.validade?daysUntil(l.validade):null;
      const crit=dv!==null&&dv<20;
      return `<div class="shrink-0 w-44 card-soft p-3 border ${crit?'border-rose-500/40':'border-slate-800'}">
        <div class="flex items-center justify-between"><span class="pill bg-brand-500/10 text-brand-300">${i+1}º sair</span><span class="text-[11px] text-slate-500">${l.lote}</span></div>
        <p class="text-lg font-bold text-white mt-2">${NUM(l.qtd)} <span class="text-xs font-normal text-slate-500">un</span></p>
        <p class="text-[11px] text-slate-500 mt-1">Entrada: ${fmtDate(l.entrada)}</p>
        <p class="text-[11px] ${crit?'text-rose-400':'text-slate-500'}">Validade: ${l.validade?fmtDate(l.validade)+(dv!==null?` (${dv}d)`:''):'—'}</p>
        <p class="text-[11px] text-slate-500">Custo: ${BRL(l.custo)}</p>
      </div>${i<ord.length-1?`<div class="shrink-0 flex items-center text-slate-600"><i data-lucide="chevron-right" class="w-5 h-5"></i></div>`:''}`;
    }).join('')}
  </div>`;
}

function runSim(view){
  const p=state.produtos.find(x=>x.id===prodSel); if(!p)return;
  let qtd=+view.querySelector('#sim-qtd').value||0;
  const ord=orderedLotes(p); const steps=[]; let restante=qtd, custo=0;
  for(const l of ord){ if(restante<=0)break; const take=Math.min(l.qtd,restante); if(take>0){ steps.push({lote:l.lote,take,custo:l.custo}); custo+=take*l.custo; restante-=take; } }
  const atendido=qtd-restante;
  const out=view.querySelector('#sim-out'); out.classList.remove('hidden');
  out.innerHTML=`<div class="card-soft p-4">
    <div class="flex items-center gap-2 mb-3"><i data-lucide="clipboard-check" class="w-4 h-4 text-brand-400"></i><p class="font-medium text-slate-100">Plano de baixa · método ${metodo}</p></div>
    <div class="space-y-1.5">${steps.map(s=>`<div class="flex items-center justify-between text-sm"><span class="text-slate-300">Lote ${s.lote}</span><span class="text-slate-400">${NUM(s.take)} un × ${BRL(s.custo)} = <b class="text-slate-100">${BRL(s.take*s.custo)}</b></span></div>`).join('')||'<p class="text-sm text-slate-500">Sem lotes disponíveis.</p>'}</div>
    <div class="border-t border-slate-800 mt-3 pt-3 flex flex-wrap gap-4 text-sm">
      <span class="text-slate-400">Atendido: <b class="text-slate-100">${NUM(atendido)}/${NUM(qtd)} un</b></span>
      <span class="text-slate-400">Custo total (CMV): <b class="text-emerald-300">${BRL(custo)}</b></span>
      ${restante>0?`<span class="text-rose-400">Falta: ${NUM(restante)} un</span>`:''}
    </div>
    <p class="text-[11px] text-slate-600 mt-2">Simulação — não altera o estoque real. Use o módulo Estoque para registrar a saída.</p>
  </div>`;
  window.lucideRefresh();
}

function saveCfg(view){
  setState(s=>{ s.modalConfig={ origem:view.querySelector('#mc-o').value, destino:view.querySelector('#mc-d').value, distancia:+view.querySelector('#mc-km').value||0, peso:+view.querySelector('#mc-peso').value||0 }; });
}

function renderModais(view){
  const cfg=state.modalConfig; const pesoT=cfg.peso/1000;
  const calc=MODAIS.map(m=>{
    const custo=cfg.distancia*m.custoKm*(0.6+pesoT*0.5);
    const prazo=m.prazoBase+Math.round(cfg.distancia/700);
    const co2=cfg.distancia*m.co2*pesoT;
    return {...m,custo,prazo,co2};
  });
  const minCusto=Math.min(...calc.map(c=>c.custo));
  const minPrazo=Math.min(...calc.map(c=>c.prazo));
  const minCo2=Math.min(...calc.map(c=>c.co2));
  view.querySelector('#modais-grid').innerHTML = calc.map(c=>`
    <div class="card-soft p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center"><i data-lucide="${c.icon}" class="w-4 h-4 text-brand-300"></i></div><p class="font-medium text-slate-100 text-sm">${c.nome}</p></div>
      </div>
      <div class="space-y-2 text-sm">
        <div class="flex items-center justify-between"><span class="text-slate-500 text-xs">Custo estimado</span><span class="font-semibold ${c.custo===minCusto?'text-emerald-300':'text-slate-200'}">${BRL(c.custo)} ${c.custo===minCusto?'<span class="pill bg-emerald-500/10 text-emerald-300 !text-[9px]">melhor</span>':''}</span></div>
        <div class="flex items-center justify-between"><span class="text-slate-500 text-xs">Prazo</span><span class="${c.prazo===minPrazo?'text-emerald-300':'text-slate-200'}">${c.prazo} dias ${c.prazo===minPrazo?'<span class="pill bg-emerald-500/10 text-emerald-300 !text-[9px]">rápido</span>':''}</span></div>
        <div class="flex items-center justify-between"><span class="text-slate-500 text-xs">Emissão CO₂</span><span class="${c.co2===minCo2?'text-emerald-300':'text-slate-200'}">${c.co2.toFixed(1)} kg ${c.co2===minCo2?'<span class="pill bg-emerald-500/10 text-emerald-300 !text-[9px]">verde</span>':''}</span></div>
      </div>
    </div>`).join('');
}
