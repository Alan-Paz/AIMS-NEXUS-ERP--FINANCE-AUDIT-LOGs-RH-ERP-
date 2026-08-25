import { state, setState } from '../store.js';
import { BRL, fmtDate, daysUntil, barChart, toast, openModal, closeModal, el, uid, csvExport } from '../utils.js';
import { askAI } from '../ai.js';

export function renderFinanceiro(view){
  const f = state.financeiro;
  const receberAberto = f.receber.filter(x=>x.status!=='recebido');
  const pagarAberto = f.pagar.filter(x=>x.status!=='pago');
  const totRec = receberAberto.reduce((a,x)=>a+x.valor,0);
  const totPag = pagarAberto.reduce((a,x)=>a+x.valor,0);
  const saldo = totRec - totPag;
  const receitaTot = f.faturamento.reduce((a,x)=>a+x.receita,0);
  const custoTot = f.faturamento.reduce((a,x)=>a+x.custo,0);
  const lucro = receitaTot - custoTot;
  const margem = receitaTot? lucro/receitaTot*100:0;

  const statusPill = (st)=>{
    const m={pendente:'bg-amber-500/10 text-amber-300',atrasado:'bg-rose-500/10 text-rose-300',recebido:'bg-emerald-500/10 text-emerald-300',pago:'bg-emerald-500/10 text-emerald-300'};
    return `<span class="pill ${m[st]||''}">${st}</span>`;
  };

  view.innerHTML = `
  <div class="space-y-6">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      ${[
        {l:'Receita acumulada',v:BRL(receitaTot),c:'#22d3ee',i:'trending-up'},
        {l:'Lucro bruto',v:BRL(lucro),c:'#34d399',i:'coins',sub:`Margem ${margem.toFixed(1)}%`},
        {l:'A receber (aberto)',v:BRL(totRec),c:'#60a5fa',i:'arrow-down-to-line'},
        {l:'Fluxo projetado',v:BRL(saldo),c:saldo>=0?'#34d399':'#fb7185',i:saldo>=0?'wallet':'alert-triangle'}
      ].map(k=>`<div class="card p-4">
        <div class="flex items-center justify-between"><p class="text-xs text-slate-500">${k.l}</p><i data-lucide="${k.i}" class="w-4 h-4" style="color:${k.c}"></i></div>
        <p class="text-lg font-bold text-white mt-1">${k.v}</p>${k.sub?`<p class="text-[11px] text-slate-500">${k.sub}</p>`:''}
      </div>`).join('')}
    </div>

    <div class="card p-5">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 class="font-semibold text-slate-100">Demonstrativo de Resultados (DRE simplificado)</h3>
        <button id="ai-fin" class="btn btn-ghost !py-1.5 text-xs"><i data-lucide="brain-circuit" class="w-4 h-4"></i>Análise por IA</button>
      </div>
      ${barChart(f.faturamento.map(x=>({label:x.mes,a:x.receita,b:x.custo})))}
      <div id="ai-fin-out" class="hidden mt-4 card-soft p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed"></div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-slate-100 flex items-center gap-2"><i data-lucide="arrow-down-to-line" class="w-4 h-4 text-emerald-400"></i>Contas a Receber</h3>
          <div class="flex gap-2">
            <button data-add="receber" class="btn btn-ghost !py-1 !px-2 text-xs"><i data-lucide="plus" class="w-4 h-4"></i></button>
            <button data-exp="receber" class="btn btn-ghost !py-1 !px-2 text-xs"><i data-lucide="download" class="w-4 h-4"></i></button>
          </div>
        </div>
        <div class="overflow-x-auto"><table class="data w-full text-sm">
          <thead><tr class="text-left text-slate-500 text-xs border-b border-slate-800"><th class="py-2">Cliente</th><th>Venc.</th><th class="text-right">Valor</th><th>Status</th><th></th></tr></thead>
          <tbody>${f.receber.map(x=>rowFin(x,'receber',statusPill)).join('')}</tbody>
        </table></div>
      </div>
      <div class="card p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-slate-100 flex items-center gap-2"><i data-lucide="arrow-up-from-line" class="w-4 h-4 text-rose-400"></i>Contas a Pagar</h3>
          <div class="flex gap-2">
            <button data-add="pagar" class="btn btn-ghost !py-1 !px-2 text-xs"><i data-lucide="plus" class="w-4 h-4"></i></button>
            <button data-exp="pagar" class="btn btn-ghost !py-1 !px-2 text-xs"><i data-lucide="download" class="w-4 h-4"></i></button>
          </div>
        </div>
        <div class="overflow-x-auto"><table class="data w-full text-sm">
          <thead><tr class="text-left text-slate-500 text-xs border-b border-slate-800"><th class="py-2">Fornecedor</th><th>Venc.</th><th class="text-right">Valor</th><th>Status</th><th></th></tr></thead>
          <tbody>${f.pagar.map(x=>rowFin(x,'pagar',statusPill)).join('')}</tbody>
        </table></div>
      </div>
    </div>
  </div>`;

  view.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>{
    const [tipo,id]=b.dataset.toggle.split(':');
    setState(s=>{ const it=s.financeiro[tipo].find(x=>x.id===id); if(!it)return; if(tipo==='receber') it.status = it.status==='recebido'?'pendente':'recebido'; else it.status = it.status==='pago'?'pendente':'pago'; });
    toast('Status atualizado.','success'); renderFinanceiro(view); window.lucideRefresh();
  }));
  view.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{
    const [tipo,id]=b.dataset.del.split(':');
    setState(s=>{ s.financeiro[tipo]=s.financeiro[tipo].filter(x=>x.id!==id); });
    renderFinanceiro(view); window.lucideRefresh();
  }));
  view.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>addFin(b.dataset.add,view)));
  view.querySelectorAll('[data-exp]').forEach(b=>b.addEventListener('click',()=>{
    const tipo=b.dataset.exp; const nmeLabel= tipo==='receber'?'Cliente':'Fornecedor';
    csvExport(`${tipo}.csv`, [[nmeLabel,'Documento','Vencimento','Valor','Status'], ...state.financeiro[tipo].map(x=>[x.cliente||x.fornecedor,x.doc,x.venc,x.valor,x.status])]);
  }));

  view.querySelector('#ai-fin')?.addEventListener('click', async (e)=>{
    const out = view.querySelector('#ai-fin-out'); out.classList.remove('hidden');
    out.innerHTML = `<div class="ai-typing flex items-center gap-1"><span></span><span></span><span></span><span class="text-slate-500 text-xs ml-2">Analisando indicadores financeiros...</span></div>`;
    const txt = await askAI('Analise a saúde financeira da empresa: margem, tendência de faturamento, contas a receber/pagar e recomende 3 ações prioritárias de fluxo de caixa.', { onToken:(acc)=>{ out.textContent=acc; } });
    out.textContent = txt; window.lucideRefresh();
  });
}

function rowFin(x, tipo, statusPill){
  const nome = x.cliente||x.fornecedor;
  const late = daysUntil(x.venc)<0 && x.status!=='recebido' && x.status!=='pago';
  return `<tr class="border-b border-slate-800/60">
    <td class="py-2.5"><p class="text-slate-200">${nome}</p><p class="text-[11px] text-slate-500">${x.doc}</p></td>
    <td class="text-slate-400 ${late?'text-rose-400':''}">${fmtDate(x.venc)}</td>
    <td class="text-right font-medium text-slate-100">${BRL(x.valor)}</td>
    <td>${statusPill(x.status)}</td>
    <td class="text-right whitespace-nowrap">
      <button data-toggle="${tipo}:${x.id}" title="Baixar" class="text-slate-500 hover:text-emerald-400 p-1"><i data-lucide="check-circle-2" class="w-4 h-4"></i></button>
      <button data-del="${tipo}:${x.id}" title="Excluir" class="text-slate-500 hover:text-rose-400 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    </td></tr>`;
}

function addFin(tipo, view){
  const isRec = tipo==='receber';
  const form = el(`<form class="space-y-3">
    <div><label class="text-xs text-slate-400">${isRec?'Cliente':'Fornecedor'}</label><input name="nome" class="field mt-1" required></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="text-xs text-slate-400">Documento</label><input name="doc" class="field mt-1" placeholder="NF / Boleto"></div>
      <div><label class="text-xs text-slate-400">Valor (R$)</label><input name="valor" type="number" step="0.01" class="field mt-1" required></div>
    </div>
    <div><label class="text-xs text-slate-400">Vencimento</label><input name="venc" type="date" class="field mt-1" required></div>
    <div class="flex justify-end gap-2 pt-2"><button type="button" data-close class="btn btn-ghost">Cancelar</button><button class="btn btn-primary">Adicionar</button></div>
  </form>`);
  form.addEventListener('submit',(e)=>{
    e.preventDefault(); const d=Object.fromEntries(new FormData(form));
    setState(s=>{ const obj={ id:uid('A'), valor:+d.valor, venc:d.venc, doc:d.doc||'—', status:'pendente' }; if(isRec) obj.cliente=d.nome; else obj.fornecedor=d.nome; s.financeiro[tipo].unshift(obj); });
    closeModal(); toast('Lançamento adicionado.','success'); renderFinanceiro(view); window.lucideRefresh();
  });
  form.querySelector('[data-close]').addEventListener('click',closeModal);
  openModal(isRec?'Nova conta a receber':'Nova conta a pagar', form);
}
