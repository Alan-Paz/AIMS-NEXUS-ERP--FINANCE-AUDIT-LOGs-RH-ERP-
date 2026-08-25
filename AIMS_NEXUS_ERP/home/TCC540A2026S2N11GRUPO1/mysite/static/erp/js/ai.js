// Motor de IA — governança ISO/IEC 42001
import { state } from './store.js';
import { BRL, NUM } from './utils.js';

let puterAI = false;
try { puterAI = typeof puter !== 'undefined' && puter.ai; } catch(e){ puterAI = false; }

// Resumo de contexto operacional para alimentar o modelo
export function buildContext(){
  const s = state;
  const totalProdutos = s.produtos.length;
  const valorEstoque = s.produtos.reduce((a,p)=> a + p.lotes.reduce((x,l)=>x+l.qtd*l.custo,0), 0);
  const receber = s.financeiro.receber.reduce((a,x)=> x.status!=='recebido'? a+x.valor:a, 0);
  const pagar = s.financeiro.pagar.reduce((a,x)=> x.status!=='pago'? a+x.valor:a, 0);
  const ult = s.financeiro.faturamento.slice(-1)[0]||{};
  return `EMPRESA: ${s.empresa.razao} (${s.empresa.regime}, ${s.empresa.uf}).
Produtos cadastrados: ${totalProdutos}. Valor total em estoque: ${BRL(valorEstoque)}.
Contas a receber em aberto: ${BRL(receber)}. Contas a pagar em aberto: ${BRL(pagar)}.
Faturamento último mês: ${BRL(ult.receita||0)}, custo ${BRL(ult.custo||0)}.
Produtos: ${s.produtos.map(p=>`${p.nome} [NCM ${p.ncm}, CFOP ${p.cfop}, preço ${BRL(p.preco)}, estoque ${p.lotes.reduce((a,l)=>a+l.qtd,0)}]`).join('; ')}.`;
}

const SYSTEM = `Você é o Nexus AI, motor de inteligência de um ERP brasileiro. Você opera sob governança ISO/IEC 42001 (Sistema de Gestão de IA): seja transparente, cite premissas, sinalize incertezas e nunca invente valores fiscais/legais sem ressalva. Responda em português do Brasil, de forma objetiva e prática, usando os dados de contexto fornecidos. Foco: finanças, logística (FIFO/FEFO/LIFO, modais), estoque, tributação (NCM, CFOP, CST/CSOSN, ICMS, IPI, PIS/COFINS) e NF-e/DANFE. Quando fizer cálculos, mostre o raciocínio resumido. Formate com tópicos curtos quando útil.`;

export async function askAI(prompt, { withContext=true, onToken }={}){
  const ctx = withContext ? `\n\n[CONTEXTO OPERACIONAL]\n${buildContext()}` : '';
  const full = `${SYSTEM}${ctx}\n\n[PERGUNTA DO USUÁRIO]\n${prompt}`;
  if(!puterAI){
    return fallback(prompt);
  }
  try {
    if(onToken){
      const resp = await puter.ai.chat(full, { model:'gpt-4o-mini', stream:true });
      let acc='';
      for await (const part of resp){ const t = part?.text||''; acc+=t; onToken(acc); }
      return acc || fallback(prompt);
    } else {
      const resp = await puter.ai.chat(full, { model:'gpt-4o-mini' });
      return (resp?.message?.content) || (typeof resp==='string'?resp:'') || fallback(prompt);
    }
  } catch(e){
    return fallback(prompt);
  }
}

// Resposta heurística offline (quando IA indisponível)
function fallback(prompt){
  const p = prompt.toLowerCase();
  const s = state;
  if(p.includes('estoque')||p.includes('vencer')||p.includes('validade')){
    const risco = [];
    s.produtos.forEach(pr=> pr.lotes.forEach(l=>{ if(l.validade){ const d=Math.ceil((new Date(l.validade)-Date.now())/86400000); if(d<30) risco.push(`${pr.nome} (lote ${l.lote}, vence em ${d} dias, ${l.qtd} un)`); } }));
    return `**Análise de estoque (modo offline)**\n\nLotes em risco de vencimento (recomenda-se FEFO):\n- ${risco.join('\n- ')||'Nenhum lote crítico nos próximos 30 dias.'}\n\n_Observação ISO 42001: análise heurística local; conecte-se para inferência completa._`;
  }
  if(p.includes('modal')||p.includes('frete')||p.includes('logíst')){
    return `**Recomendação logística (modo offline)**\n\nPara cargas de alto valor e prazo curto: rodoviário/aéreo. Para grandes volumes e baixo custo: ferroviário/aquaviário. Considere emissão de CO₂ na decisão.\n\n_Modo heurístico local ativo._`;
  }
  if(p.includes('imposto')||p.includes('tribut')||p.includes('icms')||p.includes('nf')){
    return `**Orientação tributária (modo offline)**\n\nVerifique NCM correto → define IPI e ICMS. Regime ${s.empresa.regime} usa ${s.empresa.regime==='Simples Nacional'?'CSOSN':'CST'}. Confirme CFOP conforme origem/destino da operação.\n\n_Sem conexão de IA; recomendação genérica. Valide com contabilidade._`;
  }
  return `Estou em **modo offline** (motor de IA não conectado). Faça login com Puter para respostas completas.\n\nResumo atual: ${s.produtos.length} produtos, faturamento último período ${BRL((s.financeiro.faturamento.slice(-1)[0]||{}).receita||0)}.`;
}

// Insights automáticos para o dashboard
export function autoInsights(){
  const s = state; const out=[];
  s.produtos.forEach(p=>{
    const tot = p.lotes.reduce((a,l)=>a+l.qtd,0);
    if(tot < p.estMin) out.push({ type:'warn', icon:'trending-down', title:'Estoque abaixo do mínimo', text:`${p.nome}: ${tot} un (mín. ${p.estMin}). Sugestão: reposição.` });
    p.lotes.forEach(l=>{ if(l.validade){ const d=Math.ceil((new Date(l.validade)-Date.now())/86400000); if(d>=0 && d<20) out.push({ type:'error', icon:'alarm-clock', title:'Validade crítica (FEFO)', text:`${p.nome} lote ${l.lote} vence em ${d} dias (${l.qtd} un).` }); } });
  });
  const atras = s.financeiro.receber.filter(x=>x.status==='atrasado');
  if(atras.length) out.push({ type:'warn', icon:'clock-alert', title:'Recebíveis atrasados', text:`${atras.length} título(s) vencido(s), total ${BRL(atras.reduce((a,x)=>a+x.valor,0))}.` });
  const f=s.financeiro.faturamento;
  if(f.length>=2){ const g=((f.at(-1).receita-f.at(-2).receita)/f.at(-2).receita*100); out.push({ type:g>=0?'success':'warn', icon:g>=0?'trending-up':'trending-down', title:'Tendência de faturamento', text:`Variação de ${g.toFixed(1)}% no último mês.` }); }
  out.push({ type:'info', icon:'shield-check', title:'Conformidade ISO 42001', text:'Motor de IA operando com rastreabilidade de decisões e sinalização de incerteza.' });
  return out;
}

export function aiAvailable(){ return !!puterAI; }
