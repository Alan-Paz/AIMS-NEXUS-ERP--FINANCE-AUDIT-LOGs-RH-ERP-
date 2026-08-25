import { state } from '../store.js';
import { BRL, toast } from '../utils.js';
import { NCM_LIST, CFOP_LIST, CST_ICMS, CSOSN, CST_PIS_COFINS, CST_IPI, REGIMES } from '../data.js';
import { askAI } from '../ai.js';

let tab='calc';

export function renderFiscal(view){
  view.innerHTML = `
  <div class="space-y-6">
    <div class="flex gap-2 flex-wrap">
      ${[['calc','Cálculo de Tributos','calculator'],['codigos','Códigos Tributários','list-tree'],['malha','Malha Fiscal (validação)','shield-check']].map(([id,l,i])=>`<button data-tab="${id}" class="tab-btn ${id===tab?'active':''} btn btn-ghost !py-2 text-sm"><i data-lucide="${i}" class="w-4 h-4"></i>${l}</button>`).join('')}
    </div>
    <div id="fiscal-body"></div>
  </div>`;
  view.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{ tab=b.dataset.tab; renderFiscal(view); window.lucideRefresh(); }));
  const body=view.querySelector('#fiscal-body');
  if(tab==='calc') calc(body);
  else if(tab==='codigos') codigos(body);
  else malha(body);
  window.lucideRefresh();
}

function calc(body){
  const isSimples = state.empresa.regime==='Simples Nacional';
  body.innerHTML = `
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div class="card p-5">
      <h3 class="font-semibold text-slate-100 mb-4 flex items-center gap-2"><i data-lucide="calculator" class="w-4 h-4 text-brand-400"></i>Simulador de Tributação de Venda</h3>
      <div class="space-y-3">
        <div><label class="text-xs text-slate-400">Produto</label><select id="c-prod" class="field mt-1">${state.produtos.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('')}</select></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs text-slate-400">Quantidade</label><input id="c-qtd" type="number" value="100" class="field mt-1"></div>
          <div><label class="text-xs text-slate-400">Regime</label><select id="c-reg" class="field mt-1">${REGIMES.map(r=>`<option ${r===state.empresa.regime?'selected':''}>${r}</option>`).join('')}</select></div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div><label class="text-xs text-slate-400">ICMS %</label><input id="c-icms" type="number" step="0.01" value="18" class="field mt-1"></div>
          <div><label class="text-xs text-slate-400">IPI %</label><input id="c-ipi" type="number" step="0.01" value="0" class="field mt-1"></div>
          <div><label class="text-xs text-slate-400">Simples %</label><input id="c-simp" type="number" step="0.01" value="8.5" class="field mt-1"></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs text-slate-400">PIS %</label><input id="c-pis" type="number" step="0.01" value="1.65" class="field mt-1"></div>
          <div><label class="text-xs text-slate-400">COFINS %</label><input id="c-cof" type="number" step="0.01" value="7.6" class="field mt-1"></div>
        </div>
        <button id="c-run" class="btn btn-primary w-full mt-1"><i data-lucide="play" class="w-4 h-4"></i>Calcular</button>
      </div>
    </div>
    <div class="card p-5">
      <div class="flex items-center justify-between mb-4"><h3 class="font-semibold text-slate-100">Resultado do Cálculo</h3><button id="c-ai" class="btn btn-ghost !py-1.5 text-xs"><i data-lucide="brain-circuit" class="w-4 h-4"></i>Explicar por IA</button></div>
      <div id="c-out" class="text-sm text-slate-400">Preencha e clique em <b>Calcular</b>.</div>
      <div id="c-ai-out" class="hidden mt-4 card-soft p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed"></div>
    </div>
  </div>`;

  const prodSel=body.querySelector('#c-prod');
  const syncRates=()=>{ const p=state.produtos.find(x=>x.id===prodSel.value); const n=NCM_LIST.find(x=>x.code===p.ncm); if(n){ body.querySelector('#c-icms').value=n.aliqICMS; body.querySelector('#c-ipi').value=n.aliqIPI; } };
  prodSel.addEventListener('change',syncRates); syncRates();

  const run=()=>{
    const p=state.produtos.find(x=>x.id===prodSel.value);
    const qtd=+body.querySelector('#c-qtd').value||0;
    const reg=body.querySelector('#c-reg').value;
    const base=p.preco*qtd;
    const icms=base*(+body.querySelector('#c-icms').value/100);
    const ipi=base*(+body.querySelector('#c-ipi').value/100);
    const pis=base*(+body.querySelector('#c-pis').value/100);
    const cof=base*(+body.querySelector('#c-cof').value/100);
    const simp=base*(+body.querySelector('#c-simp').value/100);
    const simples=reg==='Simples Nacional';
    const totalImp = simples? simp+ipi : icms+ipi+pis+cof;
    const totalNota = base+ipi;
    const liquido = base - (simples? simp : icms+pis+cof);
    const rows = simples
      ? [['Simples Nacional (DAS)',simp],['IPI',ipi]]
      : [['ICMS',icms],['IPI',ipi],['PIS',pis],['COFINS',cof]];
    body.querySelector('#c-out').innerHTML = `
      <div class="space-y-2">
        <div class="flex justify-between"><span class="text-slate-400">Base de cálculo (${qtd} × ${BRL(p.preco)})</span><b class="text-slate-100">${BRL(base)}</b></div>
        <div class="border-t border-slate-800 my-1"></div>
        ${rows.map(([l,v])=>`<div class="flex justify-between"><span class="text-slate-400">${l}</span><span class="text-rose-300">${BRL(v)}</span></div>`).join('')}
        <div class="border-t border-slate-800 my-1"></div>
        <div class="flex justify-between"><span class="text-slate-300">Total de tributos</span><b class="text-rose-300">${BRL(totalImp)}</b></div>
        <div class="flex justify-between"><span class="text-slate-300">Valor total da nota (c/ IPI)</span><b class="text-slate-100">${BRL(totalNota)}</b></div>
        <div class="flex justify-between"><span class="text-slate-300">Receita líquida estimada</span><b class="text-emerald-300">${BRL(liquido)}</b></div>
        <div class="flex justify-between text-xs pt-1"><span class="text-slate-500">Carga tributária efetiva</span><span class="text-amber-300">${(totalImp/base*100).toFixed(2)}%</span></div>
      </div>
      <p class="text-[11px] text-slate-600 mt-3">Cálculo estimativo para simulação. Alíquotas reais dependem de NCM, ST, benefícios fiscais e legislação estadual vigente.</p>`;
    body._last={p,base,totalImp,reg,rows};
  };
  body.querySelector('#c-run').addEventListener('click',()=>{ run(); window.lucideRefresh(); });
  body.querySelector('#c-ai').addEventListener('click',async()=>{
    if(!body._last){ toast('Calcule primeiro.','warn'); return; }
    const o=body.querySelector('#c-ai-out'); o.classList.remove('hidden');
    o.innerHTML=`<div class="ai-typing flex items-center gap-1"><span></span><span></span><span></span><span class="text-slate-500 text-xs ml-2">Analisando enquadramento fiscal...</span></div>`;
    const L=body._last;
    const txt=await askAI(`Explique de forma didática a tributação da venda do produto "${L.p.nome}" (NCM ${L.p.ncm}, CFOP ${L.p.cfop}) no regime ${L.reg}, base ${BRL(L.base)}, tributos totais ${BRL(L.totalImp)}. Aponte pontos de atenção e possível economia fiscal legal.`,{onToken:acc=>o.textContent=acc});
    o.textContent=txt; window.lucideRefresh();
  });
}

function tableBlock(title,icon,cols,rows){
  return `<div class="card p-5">
    <h3 class="font-semibold text-slate-100 mb-3 flex items-center gap-2"><i data-lucide="${icon}" class="w-4 h-4 text-brand-400"></i>${title}</h3>
    <div class="overflow-x-auto"><table class="data w-full text-sm"><thead><tr class="text-left text-slate-500 text-xs border-b border-slate-800">${cols.map(c=>`<th class="py-2">${c}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r=>`<tr class="border-b border-slate-800/60">${r.map((c,i)=>`<td class="py-2 ${i===0?'font-mono text-brand-300':'text-slate-300'}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  </div>`;
}

function codigos(body){
  body.innerHTML = `<div class="space-y-4">
    ${tableBlock('NCM — Nomenclatura Comum do Mercosul','boxes',['Código','Descrição','IPI %','ICMS %'],NCM_LIST.map(n=>[n.code,n.desc,n.aliqIPI+'%',n.aliqICMS+'%']))}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      ${tableBlock('CFOP — Operações','arrow-left-right',['Código','Descrição','Tipo'],CFOP_LIST.map(c=>[c.code,c.desc,c.tipo]))}
      ${tableBlock('CST ICMS — Regime Normal','percent',['Código','Descrição'],CST_ICMS.map(c=>[c.code,c.desc]))}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      ${tableBlock('CSOSN — Simples Nacional','store',['Código','Descrição'],CSOSN.map(c=>[c.code,c.desc]))}
      ${tableBlock('CST PIS/COFINS','receipt',['Código','Descrição'],CST_PIS_COFINS.map(c=>[c.code,c.desc]))}
    </div>
    ${tableBlock('CST IPI','factory',['Código','Descrição'],CST_IPI.map(c=>[c.code,c.desc]))}
  </div>`;
}

function malha(body){
  // Validações automáticas dos produtos vs regras
  const issues=[];
  const simples=state.empresa.regime==='Simples Nacional';
  state.produtos.forEach(p=>{
    const ncm=NCM_LIST.find(n=>n.code===p.ncm);
    if(!ncm) issues.push({sev:'error',p:p.nome,msg:`NCM ${p.ncm} não reconhecido na base.`});
    if((p.ean||'').replace(/\D/g,'').length!==13) issues.push({sev:'warn',p:p.nome,msg:'EAN ausente ou fora do padrão EAN-13.'});
    const cfop=CFOP_LIST.find(c=>c.code===p.cfop);
    if(!cfop) issues.push({sev:'error',p:p.nome,msg:`CFOP ${p.cfop} inválido.`});
    if(simples && p.csosn==='') issues.push({sev:'warn',p:p.nome,msg:'Regime Simples exige CSOSN, não CST.'});
    if(!simples && p.cst==='') issues.push({sev:'warn',p:p.nome,msg:'Regime normal exige CST ICMS.'});
    if(p.preco<=p.custo) issues.push({sev:'warn',p:p.nome,msg:'Preço de venda menor ou igual ao custo (margem negativa).'});
  });
  const ok=issues.length===0;
  const sevMap={error:'text-rose-300 bg-rose-500/5 border-rose-500/20',warn:'text-amber-300 bg-amber-500/5 border-amber-500/20'};

  body.innerHTML = `<div class="space-y-4">
    <div class="card p-5">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl ${ok?'bg-emerald-500/10':'bg-amber-500/10'} flex items-center justify-center"><i data-lucide="${ok?'shield-check':'shield-alert'}" class="w-5 h-5 ${ok?'text-emerald-400':'text-amber-400'}"></i></div>
          <div><p class="font-semibold text-slate-100">Malha Fiscal — Validação de Cadastros</p><p class="text-xs text-slate-500">Verificação cruzada de NCM, CFOP, CST/CSOSN, EAN e margem</p></div>
        </div>
        <div class="text-right"><p class="text-2xl font-bold ${ok?'text-emerald-400':'text-amber-400'}">${ok?'100%':Math.max(0,100-issues.length*8)+'%'}</p><p class="text-[11px] text-slate-500">conformidade</p></div>
      </div>
    </div>
    ${ok? `<div class="card p-8 text-center"><i data-lucide="check-circle-2" class="w-10 h-10 text-emerald-400 mx-auto mb-2"></i><p class="text-slate-200 font-medium">Nenhuma inconsistência encontrada</p><p class="text-sm text-slate-500 mt-1">Todos os produtos estão em conformidade com as regras cadastradas.</p></div>`
    : `<div class="card p-5"><h3 class="font-semibold text-slate-100 mb-3">${issues.length} ponto(s) de atenção</h3><div class="space-y-2">${issues.map(i=>`<div class="flex items-start gap-3 p-3 rounded-xl border ${sevMap[i.sev]}"><i data-lucide="${i.sev==='error'?'x-circle':'alert-triangle'}" class="w-4 h-4 mt-0.5 shrink-0"></i><div><p class="text-sm font-medium text-slate-100">${i.p}</p><p class="text-xs text-slate-400">${i.msg}</p></div></div>`).join('')}</div></div>`}
    <div class="card p-5"><div class="flex items-center justify-between mb-2"><h3 class="font-semibold text-slate-100 flex items-center gap-2"><i data-lucide="brain-circuit" class="w-4 h-4 text-brand-400"></i>Auditoria fiscal por IA</h3><button id="m-ai" class="btn btn-ghost !py-1.5 text-xs">Executar auditoria</button></div><div id="m-ai-out" class="text-sm text-slate-400">A IA revisa enquadramentos e sugere correções (ISO 42001: recomendações com ressalva).</div></div>
  </div>`;
  body.querySelector('#m-ai').addEventListener('click',async()=>{
    const o=body.querySelector('#m-ai-out');
    o.innerHTML=`<div class="ai-typing flex items-center gap-1"><span></span><span></span><span></span><span class="text-slate-500 text-xs ml-2">Auditando cadastros fiscais...</span></div>`;
    const resumo=state.produtos.map(p=>`${p.nome}: NCM ${p.ncm}, CFOP ${p.cfop}, CST ${p.cst}, CSOSN ${p.csosn}`).join('; ');
    const txt=await askAI(`Faça uma auditoria fiscal do regime ${state.empresa.regime}. Produtos: ${resumo}. Inconsistências detectadas: ${issues.map(i=>i.p+': '+i.msg).join(' | ')||'nenhuma'}. Priorize correções e cite riscos de autuação.`,{onToken:acc=>o.textContent=acc});
    o.textContent=txt; window.lucideRefresh();
  });
}
