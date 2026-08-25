import { state, lotsForProduct, stockLevel, stockValue, simulatePick, productById, warehouseById } from '../store.js';
import { BRL, NUM, fmtDate, todayISO, daysBetween, uid, renderMarkdown, toast, escapeHTML } from '../utils.js';

const MODEL = 'gpt-5-nano';

const ANALYSES = {
  fraud: { title:'Análise de Fraudes Logísticas', icon:'shield-alert', color:'rose',
    desc:'Cruza custos, lotes e embarques para detectar indícios de fraude, desvio e manipulação de estoque.' },
  iso: { title:'Conformidade ISO 42001', icon:'badge-check', color:'brand',
    desc:'Avalia a governança de IA da operação segundo os controles do Anexo A da ISO/IEC 42001:2023.' },
  optimize: { title:'Otimização de Estoque & Rotas', icon:'route', color:'indigo',
    desc:'Recomenda ajustes de FIFO/FEFO/LIFO, modais e redução de custo/emissão com base nos dados atuais.' },
  expiry: { title:'Risco de Perdas & Validade', icon:'trending-down', color:'amber',
    desc:'Projeta perdas por vencimento e sugere ações de giro e remanejamento entre CDs.' },
};

export function renderAI(){
  const html = `
  <div class="grid lg:grid-cols-3 gap-5">
    <div class="lg:col-span-1 space-y-4">
      <div class="card p-4">
        <div class="flex items-center gap-2 mb-1"><i data-lucide="sparkles" class="w-4.5 h-4.5 text-brand-700 w-[18px] h-[18px]"></i><h3 class="font-bold text-slate-800">Motor de análise IA</h3></div>
        <p class="text-xs text-slate-400 mb-3">Escolha um tipo de análise. A IA lê os dados reais da sua operação.</p>
        <div class="space-y-2">
          ${Object.entries(ANALYSES).map(([k,a])=>`
            <button data-an="${k}" class="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-brand-300 hover:bg-brand-50/30 transition group">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-${a.color}-50 text-${a.color}-600 grid place-items-center shrink-0"><i data-lucide="${a.icon}" class="w-4 h-4"></i></div>
                <span class="font-semibold text-slate-700 text-sm">${a.title}</span>
              </div>
              <p class="text-[11px] text-slate-400 mt-1.5 leading-snug">${a.desc}</p>
            </button>`).join('')}
        </div>
      </div>

      <div class="card p-4">
        <div class="flex items-center gap-2 mb-2"><i data-lucide="message-square" class="w-4 h-4 text-slate-500"></i><h3 class="font-bold text-slate-800 text-sm">Pergunte à IA</h3></div>
        <textarea id="ai-q" class="field h-20 resize-none text-sm" placeholder="Ex: Há sinais de superfaturamento de frete? Qual produto tem maior risco de perda?"></textarea>
        <button id="ai-ask" class="btn btn-primary w-full py-2.5 text-sm mt-2"><i data-lucide="send" class="w-4 h-4"></i> Perguntar</button>
      </div>

      ${state.data.audits.length? `<div class="card p-4">
        <h3 class="font-bold text-slate-800 text-sm mb-2">Análises salvas</h3>
        <div class="space-y-1.5 max-h-48 overflow-auto">
          ${[...state.data.audits].reverse().map(a=>`<button data-audit="${a.id}" class="w-full text-left p-2 rounded-lg hover:bg-slate-50 text-xs"><div class="font-medium text-slate-600 truncate">${escapeHTML(a.title)}</div><div class="text-[10px] text-slate-400">${fmtDate(a.date)}</div></button>`).join('')}
        </div>
      </div>`:''}
    </div>

    <div class="lg:col-span-2">
      <div class="card p-5 min-h-[500px]" id="ai-panel">
        ${welcome()}
      </div>
    </div>
  </div>`;
  setTimeout(bindAI, 0);
  return html;
}

function welcome(){
  const risk = quickRisk();
  return `
  <div class="text-center py-6">
    <div class="w-14 h-14 rounded-2xl bg-brand-50 text-brand-700 grid place-items-center mx-auto mb-3"><i data-lucide="brain-circuit" class="w-7 h-7"></i></div>
    <h2 class="font-bold text-slate-800 text-lg">Inteligência Logística & ISO 42001</h2>
    <p class="text-sm text-slate-400 max-w-md mx-auto mt-1">Selecione uma análise ao lado. A IA examina estoque, lotes, custos e embarques para apontar fraudes, riscos e melhorias.</p>
  </div>
  <div class="grid sm:grid-cols-3 gap-3 mt-2">
    <div class="rounded-xl border border-slate-100 p-3 text-center"><div class="text-2xl font-bold ${risk.score>=70?'text-emerald-600':risk.score>=40?'text-amber-600':'text-rose-600'}">${risk.score}</div><div class="text-[11px] text-slate-400">Índice de saúde logística</div></div>
    <div class="rounded-xl border border-slate-100 p-3 text-center"><div class="text-2xl font-bold text-slate-800">${risk.flags}</div><div class="text-[11px] text-slate-400">Alertas detectados</div></div>
    <div class="rounded-xl border border-slate-100 p-3 text-center"><div class="text-2xl font-bold text-slate-800">${risk.expiringLots}</div><div class="text-[11px] text-slate-400">Lotes em risco</div></div>
  </div>
  ${risk.notes.length? `<div class="mt-4 space-y-2">${risk.notes.map(n=>`<div class="flex items-start gap-2 text-sm bg-amber-50 text-amber-800 rounded-xl p-2.5"><i data-lucide="alert-triangle" class="w-4 h-4 mt-0.5 shrink-0"></i><span>${n}</span></div>`).join('')}</div>`:''}`;
}

// heuristic pre-scan surfaced to the user AND fed to the AI
function quickRisk(){
  const d = state.data; const notes=[]; let flags=0;
  const today = todayISO();
  let expiringLots=0;
  d.products.forEach(p=>{
    lotsForProduct(p.id).forEach(l=>{ if(l.expiry && daysBetween(today,l.expiry)<=15){ expiringLots++; } });
  });
  // cost variance between lots (possible over-invoicing)
  d.products.forEach(p=>{
    const lots = lotsForProduct(p.id);
    if(lots.length>1){
      const costs = lots.map(l=>l.unitCost);
      const min=Math.min(...costs), max=Math.max(...costs);
      if(min>0 && (max-min)/min > 0.25){ flags++; notes.push(`Variação de custo >25% entre lotes de <b>${escapeHTML(p.name)}</b> (${BRL(min)}–${BRL(max)}) — possível superfaturamento.`); }
    }
  });
  // freight per km anomalies
  const perKm = d.shipments.filter(s=>s.distanceKm>0).map(s=> s.cost/s.distanceKm);
  if(perKm.length>1){
    const avg = perKm.reduce((a,b)=>a+b,0)/perKm.length;
    d.shipments.forEach(s=>{ if(s.distanceKm>0 && s.cost/s.distanceKm > avg*1.8){ flags++; notes.push(`Frete de <b>${s.code}</b> (${BRL(s.cost/s.distanceKm)}/km) muito acima da média (${BRL(avg)}/km).`); } });
  }
  if(expiringLots>0) notes.push(`${expiringLots} lote(s) vencem em até 15 dias — risco de perda por FEFO.`);
  const score = Math.max(5, 95 - flags*15 - expiringLots*6);
  return { score, flags, expiringLots, notes };
}

function buildSnapshot(){
  const d = state.data;
  const prods = d.products.map(p=>{
    const lots = lotsForProduct(p.id).map(l=>({ lote:l.id.slice(-4).toUpperCase(), saldo:Math.round(l.remaining), custoUn:l.unitCost, entrada:l.date, validade:l.expiry, cd:warehouseById(l.warehouseId)?.name }));
    return { produto:p.name, sku:p.sku, categoria:p.category, perecivel:p.perishable, unidade:p.unit, estoqueTotal:Math.round(stockLevel(p.id)), valorEstoque:Math.round(stockValue(p.id)), lotes:lots };
  });
  const movs = d.movements.slice(-25).map(m=>({ produto:productById(m.productId)?.name, tipo:m.type, qtd:m.qty, data:m.date, metodo:m.method||null, ref:m.ref, custoTotal:m.totalCost||null }));
  const ships = d.shipments.map(s=>({ codigo:s.code, modal:s.mode, transportadora:s.carrier, origem:s.origin, destino:s.dest, status:s.status, frete:s.cost, distanciaKm:s.distanceKm, pesoKg:s.weightKg, custoPorKm: s.distanceKm? +(s.cost/s.distanceKm).toFixed(2):null, despacho:s.dispatchDate }));
  return { geradoEm:todayISO(), produtos:prods, movimentacoesRecentes:movs, embarques:ships };
}

const PROMPTS = {
  fraud: `Você é um auditor forense sênior especializado em fraudes logísticas e de supply chain. Analise os dados JSON da operação e identifique INDÍCIOS DE FRAUDE, DESVIO E MANIPULAÇÃO. Cubra: (1) superfaturamento de frete (custo/km fora do padrão), (2) variação suspeita de custo unitário entre lotes do mesmo produto, (3) saídas/movimentações inconsistentes ou possível desvio de estoque, (4) lotes "fantasma" ou giro anômalo, (5) escolha de modal incompatível com o custo. Para cada achado dê: nível de risco (ALTO/MÉDIO/BAIXO), evidência baseada nos números reais, e ação recomendada. Termine com um score de risco de fraude de 0 a 100 e um plano de controles internos. Responda em português do Brasil, em markdown, com títulos e tabelas quando útil.`,
  iso: `Você é um consultor de governança de IA certificado na ISO/IEC 42001:2023 (Sistema de Gestão de IA - AIMS). Avalie como esta operação logística — que usa IA para previsão, detecção de fraudes e otimização — se posiciona frente aos controles do Anexo A da ISO 42001. Estruture por temas: A.2 Políticas de IA, A.3 Papéis e responsabilidades, A.4 Recursos, A.5 Avaliação de impacto do sistema de IA, A.6 Ciclo de vida do sistema, A.7 Dados para IA, A.8 Informação às partes interessadas, A.9 Uso responsável, A.10 Fornecedores. Para cada tema: status (Conforme / Parcial / Não conforme), justificativa ligada aos dados/uso de IA aqui, e recomendação prática. Destaque especificamente como a detecção de fraudes atende requisitos de gestão de risco e transparência. Dê um % de maturidade de conformidade e próximos passos priorizados. Português do Brasil, markdown com tabelas.`,
  optimize: `Você é um especialista em otimização de supply chain. Com base nos dados JSON, recomende melhorias concretas: (1) qual método de saída (FIFO/FEFO/LIFO) é ideal por categoria de produto e por quê, (2) produtos com excesso ou ruptura de estoque, (3) escolha e consolidação de modais para reduzir custo e CO2, (4) remanejamento entre CDs. Quantifique economias estimadas em R$ sempre que possível. Português do Brasil, markdown, objetivo e acionável.`,
  expiry: `Você é um analista de perdas e prevenção de desperdício. Com base nos lotes e validades do JSON, projete perdas por vencimento nos próximos 30/60 dias, identifique os lotes mais críticos (FEFO), estime o valor em R$ em risco, e recomende ações de giro, promoção, remanejamento entre CDs e ajuste de compras. Português do Brasil, markdown com tabela de lotes críticos.`,
};

let currentAnalysis = null;

function bindAI(){
  document.querySelectorAll('[data-an]').forEach(b=> b.addEventListener('click', ()=> runAnalysis(b.dataset.an)));
  document.getElementById('ai-ask')?.addEventListener('click', ()=>{
    const q = document.getElementById('ai-q').value.trim();
    if(!q){ toast('Escreva uma pergunta','warn'); return; }
    runAnalysis('custom', q);
  });
  document.querySelectorAll('[data-audit]').forEach(b=> b.addEventListener('click', ()=>{
    const a = state.data.audits.find(x=>x.id===b.dataset.audit); if(a) showResult(a.title, a.content, a.meta);
  }));
  window.__refreshIcons?.();
}

async function runAnalysis(type, question){
  const panel = document.getElementById('ai-panel');
  const meta = ANALYSES[type];
  const title = type==='custom'? 'Pergunta à IA' : meta.title;
  currentAnalysis = { type, question };
  panel.innerHTML = `
    <div class="flex items-center gap-3 pb-4 border-b border-slate-100 mb-4">
      <div class="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center"><i data-lucide="${meta?.icon||'message-square'}" class="w-5 h-5"></i></div>
      <div><h3 class="font-bold text-slate-800">${escapeHTML(title)}</h3><p class="text-[11px] text-slate-400">Analisando dados reais da operação…</p></div>
    </div>
    <div class="flex items-center gap-3 text-slate-500 text-sm py-10 justify-center">
      <i data-lucide="loader-2" class="w-5 h-5 spin text-brand-600"></i> A IA está examinando estoque, lotes, custos e rotas…
    </div>`;
  window.__refreshIcons?.();

  const snapshot = buildSnapshot();
  const heur = quickRisk();
  const sys = type==='custom'
    ? `Você é um analista de logística e supply chain sênior, também especialista em fraudes e na ISO/IEC 42001. Responda à pergunta do usuário usando EXCLUSIVAMENTE os dados JSON fornecidos da operação. Seja preciso, cite números reais, e responda em português do Brasil em markdown.`
    : PROMPTS[type];
  const userMsg = `${question? 'PERGUNTA DO USUÁRIO: '+question+'\n\n':''}PRÉ-VARREDURA HEURÍSTICA (alertas já detectados pelo sistema): ${JSON.stringify(heur.notes)}\n\nDADOS DA OPERAÇÃO (JSON):\n${JSON.stringify(snapshot)}`;

  try{
    if(!state.signedIn){
      // AI still works via puter without explicit login for some calls, but guide the user
    }
    const resp = await puter.ai.chat([
      { role:'system', content: sys },
      { role:'user', content: userMsg }
    ], { model: MODEL });
    const text = (resp?.message?.content) || (typeof resp==='string'? resp : (resp?.text||'')) || 'Sem resposta da IA.';
    showResult(title, text, { type, model:MODEL });
    // auto-save audits for the two compliance-oriented analyses
    if(type==='fraud' || type==='iso' || type==='custom'){
      state.data.audits.push({ id:uid(), title: title + (question?' — '+question.slice(0,40):''), content:text, date:todayISO(), meta:{type,model:MODEL} });
      import('../store.js').then(m=>m.saveData());
    }
  }catch(e){
    console.error(e);
    document.getElementById('ai-panel').innerHTML = `
      <div class="text-center py-10">
        <div class="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 grid place-items-center mx-auto mb-3"><i data-lucide="wifi-off" class="w-6 h-6"></i></div>
        <h3 class="font-bold text-slate-800">Não foi possível concluir a análise</h3>
        <p class="text-sm text-slate-400 max-w-sm mx-auto mt-1">${state.signedIn?'Tente novamente em instantes.':'Entre com sua conta Puter para usar a IA.'} </p>
        ${!state.signedIn? '<button onclick="__logiSignIn()" class="btn btn-primary px-4 py-2 text-sm mt-4"><i data-lucide="log-in" class="w-4 h-4"></i> Entrar</button>':'<button id="ai-back" class="btn btn-ghost px-4 py-2 text-sm mt-4">Voltar</button>'}
      </div>`;
    document.getElementById('ai-back')?.addEventListener('click', ()=> window.__navigate('ai'));
    window.__refreshIcons?.();
  }
}

function showResult(title, text, meta){
  const panel = document.getElementById('ai-panel');
  const icon = ANALYSES[meta?.type]?.icon || 'sparkles';
  panel.innerHTML = `
    <div class="flex items-center gap-3 pb-4 border-b border-slate-100 mb-4">
      <div class="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center shrink-0"><i data-lucide="${icon}" class="w-5 h-5"></i></div>
      <div class="min-w-0"><h3 class="font-bold text-slate-800 truncate">${escapeHTML(title)}</h3><p class="text-[11px] text-slate-400">Gerado por IA (${meta?.model||MODEL}) · ${fmtDate(todayISO())}</p></div>
      <div class="ml-auto flex gap-2 shrink-0">
        <button id="ai-copy" class="btn btn-ghost px-2.5 py-1.5 text-xs"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>
        <button id="ai-new" class="btn btn-ghost px-2.5 py-1.5 text-xs"><i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i></button>
      </div>
    </div>
    <div class="ai-md text-sm text-slate-700">${renderMarkdown(text)}</div>
    <div class="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5"><i data-lucide="info" class="w-3.5 h-3.5"></i> Análise assistida por IA — valide achados críticos com auditoria humana (princípio de uso responsável, ISO 42001).</div>`;
  document.getElementById('ai-copy').addEventListener('click', ()=>{ navigator.clipboard?.writeText(text); toast('Análise copiada'); });
  document.getElementById('ai-new').addEventListener('click', ()=> window.__navigate('ai'));
  window.__refreshIcons?.();
}
