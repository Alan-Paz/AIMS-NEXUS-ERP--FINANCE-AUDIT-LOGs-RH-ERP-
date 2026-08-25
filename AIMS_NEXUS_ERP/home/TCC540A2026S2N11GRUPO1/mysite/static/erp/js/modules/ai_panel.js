import { state, setState } from '../store.js';
import { askAI, aiAvailable, buildContext } from '../ai.js';
import { el } from '../utils.js';

const SUGESTOES = [
  { i:'trending-up', t:'Analisar meu faturamento e margem', q:'Analise meu faturamento dos últimos meses, calcule a margem e aponte tendências e riscos.' },
  { i:'alarm-clock', t:'Quais lotes estão perto de vencer?', q:'Liste os lotes com validade próxima e recomende a estratégia FEFO para evitar perdas.' },
  { i:'route', t:'Melhor modal para minha rota', q:'Recomende o melhor modal logístico para minha rota atual considerando custo, prazo e emissão de CO₂.' },
  { i:'scale', t:'Revisar enquadramento tributário', q:'Revise o enquadramento tributário dos meus produtos (NCM, CFOP, CST/CSOSN) e aponte inconsistências.' },
  { i:'boxes', t:'O que preciso repor no estoque?', q:'Quais produtos estão abaixo do estoque mínimo e qual quantidade sugerida de reposição?' },
  { i:'file-text', t:'Como emitir uma NF-e correta?', q:'Explique o passo a passo para emitir uma NF-e correta no meu regime, evitando erros de malha fiscal.' }
];

export function renderAI(view){
  const hist = state.aiHistory;
  view.innerHTML = `
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <div class="lg:col-span-2 space-y-4">
      <div class="card flex flex-col" style="height:calc(100vh - 8rem);min-height:480px">
        <div class="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
          <div class="w-9 h-9 rounded-xl bg-brand-700 flex items-center justify-center"><i data-lucide="brain-circuit" class="w-5 h-5 text-brand-200"></i></div>
          <div class="flex-1"><p class="font-semibold text-slate-100">Nexus AI</p><p class="text-[11px] ${aiAvailable()?'text-emerald-400':'text-amber-400'}">${aiAvailable()?'Motor conectado':'Modo offline (heurístico)'}</p></div>
          <button id="clear" class="btn btn-ghost !py-1.5 !px-2 text-xs" title="Limpar"><i data-lucide="eraser" class="w-4 h-4"></i></button>
        </div>
        <div id="chat" class="flex-1 overflow-y-auto p-5 space-y-4"></div>
        <div class="p-3 border-t border-slate-800">
          <form id="chat-form" class="flex gap-2">
            <input id="chat-in" class="field flex-1" placeholder="Pergunte sobre finanças, estoque, logística ou tributos..." autocomplete="off">
            <button class="btn btn-primary !px-3"><i data-lucide="send" class="w-4 h-4"></i></button>
          </form>
        </div>
      </div>
    </div>
    <div class="space-y-4">
      <div class="card p-5">
        <h3 class="font-semibold text-slate-100 mb-3 flex items-center gap-2"><i data-lucide="wand-2" class="w-4 h-4 text-brand-400"></i>Perguntas sugeridas</h3>
        <div class="space-y-2">${SUGESTOES.map(s=>`<button data-q="${s.q.replace(/"/g,'&quot;')}" class="w-full text-left card-soft p-3 hover:border-brand-600 transition flex items-center gap-3"><i data-lucide="${s.i}" class="w-4 h-4 text-brand-400 shrink-0"></i><span class="text-sm text-slate-300">${s.t}</span></button>`).join('')}</div>
      </div>
      <div class="card p-5">
        <h3 class="font-semibold text-slate-100 mb-2 flex items-center gap-2"><i data-lucide="shield-check" class="w-4 h-4 text-emerald-400"></i>Governança ISO/IEC 42001</h3>
        <ul class="text-xs text-slate-400 space-y-2">
          <li class="flex gap-2"><i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0"></i>Transparência: respostas com premissas e ressalvas.</li>
          <li class="flex gap-2"><i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0"></i>Rastreabilidade: histórico de interações preservado.</li>
          <li class="flex gap-2"><i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0"></i>Supervisão humana: sugestões não substituem contador.</li>
          <li class="flex gap-2"><i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0"></i>Dados contextuais restritos à operação da empresa.</li>
        </ul>
      </div>
    </div>
  </div>`;

  const chat=view.querySelector('#chat');
  const renderHist=()=>{
    if(!hist.length){ chat.innerHTML=`<div class="h-full flex flex-col items-center justify-center text-center text-slate-500 gap-2"><i data-lucide="sparkles" class="w-8 h-8 text-brand-500/40"></i><p class="text-sm">Sou o motor de IA do seu ERP.<br>Pergunte sobre qualquer módulo.</p></div>`; }
    else chat.innerHTML=hist.map(m=>bubble(m.role,m.text)).join('');
    window.lucideRefresh(); chat.scrollTop=chat.scrollHeight;
  };
  renderHist();

  async function send(q){
    if(!q.trim())return;
    hist.push({role:'user',text:q}); setState(s=>{}); renderHist();
    chat.insertAdjacentHTML('beforeend',`<div id="typing" class="flex items-start gap-3"><div class="w-8 h-8 rounded-lg bg-brand-700 flex items-center justify-center shrink-0"><i data-lucide="brain-circuit" class="w-4 h-4 text-brand-200"></i></div><div class="card-soft px-4 py-3"><div class="ai-typing flex items-center gap-1"><span></span><span></span><span></span></div></div></div>`);
    window.lucideRefresh(); chat.scrollTop=chat.scrollHeight;
    let answerNode=null;
    const txt=await askAI(q,{ onToken:(acc)=>{
      const typing=chat.querySelector('#typing'); if(typing) typing.remove();
      if(!answerNode){ answerNode=el(bubble('assistant','')); chat.appendChild(answerNode); }
      answerNode.querySelector('[data-text]').textContent=acc; chat.scrollTop=chat.scrollHeight;
    }});
    chat.querySelector('#typing')?.remove();
    hist.push({role:'assistant',text:txt}); setState(s=>{}); renderHist();
  }

  view.querySelector('#chat-form').addEventListener('submit',e=>{ e.preventDefault(); const inp=view.querySelector('#chat-in'); const v=inp.value; inp.value=''; send(v); });
  view.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>send(b.dataset.q)));
  view.querySelector('#clear').addEventListener('click',()=>{ state.aiHistory.length=0; setState(s=>{}); renderHist(); });
}

function bubble(role,text){
  if(role==='user') return `<div class="flex items-start gap-3 justify-end"><div class="bg-brand-700/30 border border-brand-700/40 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]"><p class="text-sm text-slate-100 whitespace-pre-wrap">${esc(text)}</p></div></div>`;
  return `<div class="flex items-start gap-3"><div class="w-8 h-8 rounded-lg bg-brand-700 flex items-center justify-center shrink-0"><i data-lucide="brain-circuit" class="w-4 h-4 text-brand-200"></i></div><div class="card-soft px-4 py-3 max-w-[85%]"><p data-text class="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">${esc(text)}</p></div></div>`;
}
function esc(s){ return (s||'').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])); }
