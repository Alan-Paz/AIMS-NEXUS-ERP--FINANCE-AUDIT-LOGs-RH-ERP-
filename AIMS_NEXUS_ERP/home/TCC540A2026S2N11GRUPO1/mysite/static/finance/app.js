import { createIcons, icons } from 'https://cdn.jsdelivr.net/npm/lucide@latest/+esm';
import { state, loadAudits, saveAudits, uid } from './state.js';
import { newSheet, importFile, exportXlsx, exportCsv, colLetter } from './sheet.js';
import { analyze, askAbout, auditTypes, extractScore, cleanHtml } from './ai.js';

const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
let currentAuditType = 'financeira';
let refreshIcons = () => createIcons({ icons });

// ---------- Auth ----------
async function initAuth() {
  try {
    if (puter.auth.isSignedIn()) {
      state.signedIn = true;
      state.user = await puter.auth.getUser();
    }
  } catch (e) {}
  await loadAudits();
}

async function signIn() {
  try {
    await puter.auth.signIn();
    state.signedIn = true;
    state.user = await puter.auth.getUser();
    await loadAudits();
    render();
  } catch (e) {}
}
async function signOut() {
  try { await puter.auth.signOut(); } catch (e) {}
  state.signedIn = false; state.user = null;
  render();
}

// ---------- Layout ----------
function render() {
  app.innerHTML = `
  <div class="min-h-screen flex flex-col md:flex-row">
    ${sidebar()}
    <main class="flex-1 min-w-0 bg-slate-100">
      ${topbar()}
      <div id="viewRoot" class="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto"></div>
    </main>
  </div>`;
  bindShell();
  renderView();
  refreshIcons();
}

function sidebar() {
  const item = (id, label, icon) => `
    <button data-nav="${id}" class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${state.view===id?'bg-brand-700 text-white':'text-slate-300 hover:bg-ink-700 hover:text-white'}">
      <i data-lucide="${icon}" class="w-[18px] h-[18px]"></i><span>${label}</span>
    </button>`;
  return `
  <aside class="md:w-64 shrink-0 bg-ink-900 md:min-h-screen flex md:flex-col">
    <div class="p-5 flex items-center gap-2.5 border-b border-white/10 w-full">
      <div class="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
        <i data-lucide="shield-check" class="w-5 h-5 text-white"></i>
      </div>
      <div class="leading-tight">
        <div class="text-white font-extrabold tracking-tight">AuditIA</div>
        <div class="text-[10px] text-brand-200 font-semibold tracking-wider">ISO/IEC 42001</div>
      </div>
    </div>
    <nav class="p-3 space-y-1 flex-1 hidden md:block">
      ${item('dashboard','Painel','layout-dashboard')}
      ${item('editor','Planilha & Editor','table-2')}
      ${item('history','Auditorias','folder-check')}
      ${item('about','Sobre a Norma','book-open')}
    </nav>
    <div class="p-3 mt-auto hidden md:block border-t border-white/10">
      ${state.signedIn ? `
        <div class="flex items-center gap-2.5 px-2 py-2">
          <div class="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">${(state.user?.username||'U').slice(0,2).toUpperCase()}</div>
          <div class="min-w-0"><div class="text-white text-sm font-medium truncate">${state.user?.username||'Usuário'}</div>
          <button id="signOutBtn" class="text-[11px] text-slate-400 hover:text-white">Sair</button></div>
        </div>` : `
        <button id="signInBtn" class="w-full bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2">
          <i data-lucide="log-in" class="w-4 h-4"></i> Entrar / Salvar na nuvem
        </button>`}
    </div>
  </aside>`;
}

function topbar() {
  const titles = { dashboard:'Painel de Auditoria', editor:'Editor de Planilhas', history:'Auditorias Realizadas', about:'ISO/IEC 42001' };
  return `
  <header class="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between sticky top-0 z-20">
    <div>
      <h1 class="text-lg font-bold text-ink-900">${titles[state.view]||''}</h1>
      <p class="text-xs text-slate-500 hidden sm:block">Análise financeira e fiscal assistida por Inteligência Artificial</p>
    </div>
    <div class="flex items-center gap-2">
      <div class="md:hidden flex gap-1">
        ${['dashboard','editor','history'].map(v=>`<button data-nav="${v}" class="p-2 rounded-lg ${state.view===v?'bg-brand-50 text-brand-700':'text-slate-500'}"><i data-lucide="${v==='dashboard'?'layout-dashboard':v==='editor'?'table-2':'folder-check'}" class="w-5 h-5"></i></button>`).join('')}
      </div>
      <button id="quickAnalyze" class="hidden sm:flex items-center gap-2 bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold px-4 py-2 rounded-lg">
        <i data-lucide="sparkles" class="w-4 h-4"></i> Analisar com IA
      </button>
    </div>
  </header>`;
}

function bindShell() {
  document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => { state.view = b.dataset.nav; render(); }));
  $('#signInBtn')?.addEventListener('click', signIn);
  $('#signOutBtn')?.addEventListener('click', signOut);
  $('#quickAnalyze')?.addEventListener('click', () => {
    if (!state.sheet) { state.view='editor'; render(); toast('Importe ou crie uma planilha primeiro.'); return; }
    state.view='editor'; render(); setTimeout(()=>openAnalyzeModal(), 50);
  });
}

function renderView() {
  const root = $('#viewRoot');
  if (state.view === 'dashboard') root.innerHTML = viewDashboard();
  else if (state.view === 'editor') { root.innerHTML = viewEditor(); bindEditor(); }
  else if (state.view === 'history') { root.innerHTML = viewHistory(); bindHistory(); }
  else if (state.view === 'about') root.innerHTML = viewAbout();
  refreshIcons();
  if (state.view==='dashboard') bindDashboard();
}

// ---------- Dashboard ----------
function viewDashboard() {
  const total = state.audits.length;
  const avg = total ? Math.round(state.audits.reduce((a,b)=>a+(b.score||0),0)/total) : 0;
  const critical = state.audits.reduce((a,b)=>a+(b.criticals||0),0);
  const last = state.audits[0];
  const card = (icon,label,value,sub,color)=>`
    <div class="bg-white rounded-xl border border-slate-200 p-5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide">${label}</span>
        <span class="w-9 h-9 rounded-lg ${color} flex items-center justify-center"><i data-lucide="${icon}" class="w-[18px] h-[18px]"></i></span>
      </div>
      <div class="mt-3 text-3xl font-extrabold text-ink-900">${value}</div>
      <div class="text-xs text-slate-400 mt-1">${sub}</div>
    </div>`;
  return `
  <div class="fade-in space-y-6">
    <div class="rounded-2xl bg-ink-900 text-white p-6 sm:p-8 relative overflow-hidden">
      <div class="relative z-10 max-w-2xl">
        <div class="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1 text-xs font-semibold text-brand-200 mb-3">
          <i data-lucide="cpu" class="w-3.5 h-3.5"></i> Motor de IA conectado
        </div>
        <h2 class="text-2xl sm:text-3xl font-extrabold leading-tight">Auditoria financeira e fiscal<br>automatizada por Inteligência Artificial</h2>
        <p class="text-slate-300 mt-3 text-sm sm:text-base">Importe uma planilha, edite dentro do sistema e receba um laudo de auditoria completo — achados, anomalias, pontuação de conformidade e alinhamento à ISO/IEC 42001.</p>
        <div class="flex flex-wrap gap-2 mt-5">
          <button data-nav="editor" class="bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm px-5 py-2.5 rounded-lg flex items-center gap-2"><i data-lucide="upload" class="w-4 h-4"></i> Importar planilha</button>
          <button id="dashNew" class="bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-5 py-2.5 rounded-lg flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i> Criar do zero</button>
        </div>
      </div>
      <i data-lucide="scan-line" class="w-64 h-64 absolute -right-8 -bottom-12 text-white/5"></i>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      ${card('file-check-2','Auditorias', total, 'realizadas no total','bg-brand-50 text-brand-700')}
      ${card('gauge','Conformidade média', avg+'%', 'pontuação geral','bg-emerald-50 text-emerald-600')}
      ${card('triangle-alert','Achados críticos', critical, 'acumulados','bg-red-50 text-red-600')}
      ${card('clock','Última auditoria', last?timeAgo(last.date):'—', last?last.sheetName:'nenhuma ainda','bg-amber-50 text-amber-600')}
    </div>

    <div class="grid lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-ink-900">Tipos de auditoria disponíveis</h3>
        </div>
        <div class="grid sm:grid-cols-2 gap-3">
          ${Object.entries(auditTypes()).map(([k,v])=>`
            <div class="border border-slate-200 rounded-lg p-4 hover:border-brand-400 transition">
              <div class="flex items-center gap-2 font-semibold text-sm text-ink-900"><i data-lucide="${k==='fiscal'?'receipt':k==='conformidade'?'shield-check':k==='fraude'?'search-check':'landmark'}" class="w-4 h-4 text-brand-600"></i>${v.label}</div>
              <p class="text-xs text-slate-500 mt-1.5 leading-relaxed">${v.focus}</p>
            </div>`).join('')}
        </div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-5">
        <h3 class="font-bold text-ink-900 mb-4">Auditorias recentes</h3>
        ${state.audits.length? `<div class="space-y-2">${state.audits.slice(0,5).map(a=>auditRow(a)).join('')}</div>` :
          `<div class="text-center py-8 text-slate-400"><i data-lucide="inbox" class="w-10 h-10 mx-auto mb-2"></i><p class="text-sm">Nenhuma auditoria ainda</p></div>`}
      </div>
    </div>
  </div>`;
}
function auditRow(a){
  return `<button data-open-audit="${a.id}" class="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200">
    <span class="w-9 h-9 rounded-lg ${scoreBg(a.score)} flex items-center justify-center text-xs font-bold shrink-0">${a.score??'—'}</span>
    <div class="min-w-0 flex-1"><div class="text-sm font-semibold text-ink-900 truncate">${a.sheetName}</div>
    <div class="text-[11px] text-slate-400">${auditTypes()[a.type]?.label||a.type} · ${timeAgo(a.date)}</div></div>
    <i data-lucide="chevron-right" class="w-4 h-4 text-slate-300"></i>
  </button>`;
}
function bindDashboard(){
  $('#dashNew')?.addEventListener('click', ()=>{ state.sheet = newSheet(); state.view='editor'; render(); });
  document.querySelectorAll('[data-open-audit]').forEach(b=>b.addEventListener('click',()=>{
    state.activeAudit = state.audits.find(a=>a.id===b.dataset.openAudit); state.view='history'; render();
  }));
}

// ---------- Editor ----------
function viewEditor() {
  if (!state.sheet) {
    return `<div class="fade-in max-w-3xl mx-auto">
      <div id="dropZone" class="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center hover:border-brand-400 transition cursor-pointer">
        <div class="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4"><i data-lucide="file-spreadsheet" class="w-8 h-8 text-brand-700"></i></div>
        <h3 class="text-lg font-bold text-ink-900">Importe sua planilha financeira ou fiscal</h3>
        <p class="text-sm text-slate-500 mt-1">Arraste um arquivo aqui ou clique para selecionar · <strong>.xlsx, .xls, .csv</strong></p>
        <div class="flex flex-wrap gap-2 justify-center mt-5">
          <button id="pickFile" class="bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2"><i data-lucide="upload" class="w-4 h-4"></i> Selecionar arquivo</button>
          <button id="createBlank" class="bg-slate-100 hover:bg-slate-200 text-ink-800 text-sm font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i> Criar planilha em branco</button>
          <button id="loadSample" class="bg-slate-100 hover:bg-slate-200 text-ink-800 text-sm font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2"><i data-lucide="beaker" class="w-4 h-4"></i> Carregar exemplo</button>
        </div>
        <input type="file" id="fileInput" accept=".xlsx,.xls,.csv" class="hidden">
      </div>
    </div>`;
  }
  const s = state.sheet;
  return `
  <div class="fade-in space-y-4">
    <div class="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center gap-2">
      <div class="flex items-center gap-2 mr-2 min-w-0">
        <i data-lucide="table-2" class="w-5 h-5 text-brand-700 shrink-0"></i>
        <input id="sheetName" value="${escapeHtml(s.name)}" class="font-bold text-ink-900 bg-transparent border border-transparent hover:border-slate-200 focus:border-brand-400 rounded px-2 py-1 outline-none min-w-0 w-44">
      </div>
      <div class="h-6 w-px bg-slate-200"></div>
      <button id="addRow" class="tbtn"><i data-lucide="plus" class="w-4 h-4"></i>Linha</button>
      <button id="addCol" class="tbtn"><i data-lucide="columns-3" class="w-4 h-4"></i>Coluna</button>
      <button id="importReplace" class="tbtn"><i data-lucide="upload" class="w-4 h-4"></i>Importar</button>
      <div class="flex-1"></div>
      <button id="exportXlsx" class="tbtn"><i data-lucide="file-down" class="w-4 h-4"></i>Excel</button>
      <button id="exportCsv" class="tbtn"><i data-lucide="download" class="w-4 h-4"></i>CSV</button>
      <button id="closeSheet" class="tbtn text-red-500"><i data-lucide="x" class="w-4 h-4"></i></button>
      <button id="analyzeBtn" class="bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2"><i data-lucide="sparkles" class="w-4 h-4"></i> Analisar com IA</button>
    </div>

    <div class="grid xl:grid-cols-3 gap-4">
      <div class="xl:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div class="overflow-auto max-h-[62vh]">
          <table class="border-collapse text-sm w-full" id="grid">
            <thead class="sticky top-0 z-10">
              <tr class="bg-slate-50">
                <th class="w-10 bg-slate-100 border-b border-r border-slate-200 text-[11px] text-slate-400 sticky left-0 z-10">#</th>
                ${s.header.map((h,c)=>`<th class="border-b border-r border-slate-200 min-w-[120px] p-0">
                  <div class="flex items-center">
                    <input data-h="${c}" value="${escapeHtml(h)}" class="sheet-input w-full px-2 py-2 font-semibold text-ink-800 bg-slate-50 text-left">
                    <button data-delcol="${c}" class="px-1 text-slate-300 hover:text-red-500"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
                  </div></th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${s.rows.map((row,r)=>`<tr class="group">
                <td class="bg-slate-50 border-b border-r border-slate-200 text-center text-[11px] text-slate-400 sticky left-0 relative">
                  <span class="group-hover:hidden">${r+1}</span>
                  <button data-delrow="${r}" class="hidden group-hover:flex items-center justify-center w-full text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                </td>
                ${row.map((cell,c)=>`<td class="border-b border-r border-slate-100 p-0"><input data-r="${r}" data-c="${c}" value="${escapeHtml(cell)}" class="sheet-input w-full px-2 py-1.5 text-ink-700"></td>`).join('')}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="px-3 py-2 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-4">
          <span>${s.rows.length} linhas × ${s.header.length} colunas</span>
          <span class="flex items-center gap-1"><i data-lucide="save" class="w-3.5 h-3.5"></i> edições salvas automaticamente</span>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 flex flex-col max-h-[70vh]">
        <div class="p-4 border-b border-slate-200 flex items-center gap-2">
          <span class="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center"><i data-lucide="bot" class="w-4 h-4 text-brand-700"></i></span>
          <div><div class="font-bold text-sm text-ink-900">Assistente de Auditoria</div><div class="text-[11px] text-slate-400">Pergunte sobre esta planilha</div></div>
        </div>
        <div id="chatLog" class="flex-1 overflow-auto p-4 space-y-3 text-sm">
          <div class="text-slate-400 text-center py-6 text-xs">
            <i data-lucide="messages-square" class="w-8 h-8 mx-auto mb-2"></i>
            Ex.: "Há lançamentos duplicados?", "Qual o total de débitos?", "Os tributos estão corretos?"
          </div>
        </div>
        <div class="p-3 border-t border-slate-200">
          <div class="flex gap-2">
            <input id="chatInput" placeholder="Pergunte à IA sobre a planilha..." class="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:border-brand-400 outline-none">
            <button id="chatSend" class="bg-brand-700 hover:bg-brand-800 text-white px-3 rounded-lg"><i data-lucide="send" class="w-4 h-4"></i></button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <input type="file" id="fileInputHidden" accept=".xlsx,.xls,.csv" class="hidden">
  <style>.tbtn{display:inline-flex;align-items:center;gap:.35rem;font-size:.8rem;font-weight:600;color:#334155;background:#f1f5f9;padding:.5rem .7rem;border-radius:.5rem}.tbtn:hover{background:#e2e8f0}</style>`;
}

function bindEditor() {
  if (!state.sheet) {
    const fi = $('#fileInput');
    const trigger = () => fi.click();
    $('#pickFile')?.addEventListener('click', trigger);
    $('#dropZone')?.addEventListener('click', (e)=>{ if(e.target.closest('button'))return; trigger(); });
    $('#createBlank')?.addEventListener('click', ()=>{ state.sheet=newSheet(); render(); });
    $('#loadSample')?.addEventListener('click', ()=>{ state.sheet=sampleSheet(); render(); });
    fi?.addEventListener('change', async e=>{ if(e.target.files[0]) await doImport(e.target.files[0]); });
    const dz = $('#dropZone');
    if (dz){
      ['dragover','dragenter'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('border-brand-500','bg-brand-50');}));
      ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('border-brand-500','bg-brand-50');}));
      dz.addEventListener('drop', async e=>{ const f=e.dataTransfer.files[0]; if(f) await doImport(f); });
    }
    return;
  }
  const s = state.sheet;
  $('#sheetName')?.addEventListener('input', e=>{ s.name=e.target.value; });
  document.querySelectorAll('[data-r]').forEach(inp=>{
    inp.addEventListener('input', e=>{ s.rows[+e.target.dataset.r][+e.target.dataset.c]=e.target.value; });
  });
  document.querySelectorAll('[data-h]').forEach(inp=>{
    inp.addEventListener('input', e=>{ s.header[+e.target.dataset.h]=e.target.value; });
  });
  document.querySelectorAll('[data-delrow]').forEach(b=>b.addEventListener('click',()=>{ s.rows.splice(+b.dataset.delrow,1); if(!s.rows.length)s.rows.push(new Array(s.header.length).fill('')); renderView(); }));
  document.querySelectorAll('[data-delcol]').forEach(b=>b.addEventListener('click',()=>{ const c=+b.dataset.delcol; if(s.header.length<=1)return; s.header.splice(c,1); s.rows.forEach(r=>r.splice(c,1)); renderView(); }));
  $('#addRow')?.addEventListener('click', ()=>{ s.rows.push(new Array(s.header.length).fill('')); renderView(); });
  $('#addCol')?.addEventListener('click', ()=>{ s.header.push('Coluna '+colLetter(s.header.length)); s.rows.forEach(r=>r.push('')); renderView(); });
  $('#exportXlsx')?.addEventListener('click', ()=>exportXlsx(s));
  $('#exportCsv')?.addEventListener('click', ()=>exportCsv(s));
  $('#closeSheet')?.addEventListener('click', ()=>{ if(confirm('Fechar a planilha atual? As edições não exportadas serão perdidas.')){ state.sheet=null; render(); } });
  $('#analyzeBtn')?.addEventListener('click', openAnalyzeModal);
  const fih = $('#fileInputHidden');
  $('#importReplace')?.addEventListener('click', ()=>fih.click());
  fih?.addEventListener('change', async e=>{ if(e.target.files[0]) await doImport(e.target.files[0]); });
  // chat
  const send = async ()=>{
    const inp=$('#chatInput'); const q=inp.value.trim(); if(!q)return;
    if(!ensureSignedInSoft())return;
    inp.value='';
    const log=$('#chatLog');
    if(log.querySelector('.text-center')) log.innerHTML='';
    log.insertAdjacentHTML('beforeend', `<div class="flex justify-end"><div class="bg-brand-700 text-white rounded-2xl rounded-br-sm px-3 py-2 max-w-[85%]">${escapeHtml(q)}</div></div>`);
    const aiWrap=document.createElement('div'); aiWrap.className='flex justify-start';
    aiWrap.innerHTML=`<div class="bg-slate-100 rounded-2xl rounded-bl-sm px-3 py-2 max-w-[90%] prose-ai text-slate-700"><i data-lucide="loader-2" class="w-4 h-4 spin text-brand-600"></i></div>`;
    log.appendChild(aiWrap); log.scrollTop=log.scrollHeight; refreshIcons();
    try{
      await askAbout(s, q, (full)=>{ aiWrap.querySelector('div').innerHTML=cleanHtml(full); log.scrollTop=log.scrollHeight; });
    }catch(err){ aiWrap.querySelector('div').innerHTML='<span class="text-red-500 text-xs">Erro ao consultar a IA. Tente novamente.</span>'; }
  };
  $('#chatSend')?.addEventListener('click', send);
  $('#chatInput')?.addEventListener('keydown', e=>{ if(e.key==='Enter') send(); });
}

async function doImport(file){
  try{
    toast('Importando planilha...');
    state.sheet = await importFile(file);
    render();
    toast('Planilha importada com sucesso.');
  }catch(e){ toast('Não foi possível ler o arquivo.'); }
}

// ---------- Analyze modal ----------
function openAnalyzeModal(){
  if(!state.sheet) return;
  if(!ensureSignedInSoft()) return;
  const types = auditTypes();
  const modal = document.createElement('div');
  modal.className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50';
  modal.innerHTML=`
    <div class="bg-white rounded-2xl w-full max-w-lg fade-in">
      <div class="p-5 border-b border-slate-200 flex items-center justify-between">
        <div class="flex items-center gap-2"><span class="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center"><i data-lucide="sparkles" class="w-4 h-4 text-brand-700"></i></span><h3 class="font-bold text-ink-900">Configurar auditoria com IA</h3></div>
        <button id="mClose" class="text-slate-400 hover:text-slate-700"><i data-lucide="x" class="w-5 h-5"></i></button>
      </div>
      <div class="p-5 space-y-4">
        <div>
          <label class="text-xs font-semibold text-slate-500 uppercase">Tipo de auditoria</label>
          <div class="grid grid-cols-2 gap-2 mt-2">
            ${Object.entries(types).map(([k,v])=>`<button data-type="${k}" class="typeBtn text-left border rounded-lg p-3 text-sm ${currentAuditType===k?'border-brand-500 bg-brand-50':'border-slate-200'}">
              <div class="font-semibold text-ink-900 flex items-center gap-1.5"><i data-lucide="${k==='fiscal'?'receipt':k==='conformidade'?'shield-check':k==='fraude'?'search-check':'landmark'}" class="w-3.5 h-3.5 text-brand-600"></i>${v.label}</div>
            </button>`).join('')}
          </div>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-500 uppercase">Instruções adicionais (opcional)</label>
          <textarea id="mExtra" rows="2" placeholder="Ex.: foque na conciliação bancária de março, verifique alíquota de ICMS 18%..." class="w-full mt-2 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-400"></textarea>
        </div>
        <div class="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 flex gap-2">
          <i data-lucide="info" class="w-4 h-4 shrink-0 text-brand-600"></i>
          <span>A IA analisará <strong>${state.sheet.rows.filter(r=>r.some(c=>String(c).trim())).length}</strong> linhas de "<strong>${escapeHtml(state.sheet.name)}</strong>" e gerará um laudo completo com pontuação de conformidade.</span>
        </div>
      </div>
      <div class="p-5 border-t border-slate-200 flex justify-end gap-2">
        <button id="mCancel" class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
        <button id="mRun" class="px-5 py-2 text-sm font-semibold bg-brand-700 hover:bg-brand-800 text-white rounded-lg flex items-center gap-2"><i data-lucide="play" class="w-4 h-4"></i> Iniciar análise</button>
      </div>
    </div>`;
  document.body.appendChild(modal); refreshIcons();
  const close=()=>modal.remove();
  $('#mClose',modal).onclick=close; $('#mCancel',modal).onclick=close;
  modal.addEventListener('click',e=>{ if(e.target===modal) close(); });
  modal.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{ currentAuditType=b.dataset.type; modal.querySelectorAll('.typeBtn').forEach(x=>x.className='typeBtn text-left border rounded-lg p-3 text-sm '+(x.dataset.type===currentAuditType?'border-brand-500 bg-brand-50':'border-slate-200')); });
  $('#mRun',modal).onclick=()=>{ const extra=$('#mExtra',modal).value.trim(); close(); runAnalysis(currentAuditType, extra); };
}

async function runAnalysis(type, extra){
  const overlay=document.createElement('div');
  overlay.className='fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4';
  overlay.innerHTML=`
    <div class="bg-white rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col fade-in">
      <div class="p-4 border-b border-slate-200 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="w-9 h-9 rounded-lg bg-brand-700 flex items-center justify-center"><i data-lucide="scan-search" class="w-5 h-5 text-white"></i></span>
          <div><div class="font-bold text-ink-900">${auditTypes()[type].label}</div><div class="text-xs text-slate-400" id="anStatus">Analisando com Inteligência Artificial...</div></div>
        </div>
        <button id="anClose" class="text-slate-400 hover:text-slate-700"><i data-lucide="x" class="w-5 h-5"></i></button>
      </div>
      <div class="p-2 bg-brand-50"><div class="h-1 rounded-full bg-brand-200 overflow-hidden"><div id="anBar" class="h-full bg-brand-600 w-1/3" style="transition:width .4s"></div></div></div>
      <div id="anBody" class="p-6 overflow-auto prose-ai text-slate-700 flex-1">
        <div class="flex flex-col items-center justify-center py-16 text-slate-400">
          <i data-lucide="loader-2" class="w-10 h-10 spin text-brand-600 mb-3"></i>
          <p class="text-sm font-medium">Conectando à IA e processando os dados...</p>
        </div>
      </div>
      <div class="p-4 border-t border-slate-200 flex justify-end gap-2" id="anFooter" style="display:none">
        <button id="anDownload" class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-2"><i data-lucide="download" class="w-4 h-4"></i> Baixar laudo</button>
        <button id="anSaved" class="px-5 py-2 text-sm font-semibold bg-brand-700 text-white rounded-lg flex items-center gap-2"><i data-lucide="check" class="w-4 h-4"></i> Concluído — salvo</button>
      </div>
    </div>`;
  document.body.appendChild(overlay); refreshIcons();
  $('#anClose',overlay).onclick=()=>overlay.remove();
  const body=$('#anBody',overlay); const bar=$('#anBar',overlay);
  let started=false; let prog=33;
  const tick=setInterval(()=>{ prog=Math.min(92,prog+3); bar.style.width=prog+'%'; },600);
  let full='';
  try{
    full = await analyze(state.sheet, type, extra, (txt)=>{
      if(!started){ started=true; body.innerHTML=''; }
      body.innerHTML = cleanHtml(txt);
      body.scrollTop = body.scrollHeight;
    });
  }catch(e){
    clearInterval(tick);
    body.innerHTML=`<div class="text-center py-10 text-red-500"><i data-lucide="alert-triangle" class="w-8 h-8 mx-auto mb-2"></i><p class="text-sm">Não foi possível concluir a análise. Verifique sua conexão e tente novamente.</p></div>`;
    refreshIcons(); return;
  }
  clearInterval(tick); bar.style.width='100%'; $('#anStatus',overlay).textContent='Análise concluída';
  const score = extractScore(full);
  const criticals = (full.match(/\[CR[IÍ]TICO\]/gi)||[]).length;
  const cleaned = cleanHtml(full);
  body.innerHTML = scoreHeader(score, criticals) + cleaned;
  // save
  const record = { id:uid(), sheetName:state.sheet.name, type, extra, date:Date.now(), score, criticals, html:cleaned, rows:state.sheet.rows.filter(r=>r.some(c=>String(c).trim())).length };
  state.audits.unshift(record); await saveAudits();
  const footer=$('#anFooter',overlay); footer.style.display='flex';
  $('#anDownload',overlay).onclick=()=>downloadReport(record);
  $('#anSaved',overlay).onclick=()=>{ overlay.remove(); state.activeAudit=record; state.view='history'; render(); };
  refreshIcons();
}

function scoreHeader(score, criticals){
  const c = scoreColorHex(score);
  return `<div class="not-prose mb-5 grid grid-cols-3 gap-3 text-center">
    <div class="rounded-xl border border-slate-200 p-4"><div class="text-3xl font-extrabold" style="color:${c}">${score??'—'}</div><div class="text-[11px] text-slate-500 uppercase font-semibold mt-1">Conformidade</div></div>
    <div class="rounded-xl border border-slate-200 p-4"><div class="text-3xl font-extrabold text-red-500">${criticals}</div><div class="text-[11px] text-slate-500 uppercase font-semibold mt-1">Achados críticos</div></div>
    <div class="rounded-xl border border-slate-200 p-4"><div class="text-sm font-bold ${score>=80?'text-emerald-600':score>=60?'text-amber-600':'text-red-600'} mt-2">${score>=80?'APROVADO':score>=60?'RESSALVAS':score===null?'—':'REPROVADO'}</div><div class="text-[11px] text-slate-500 uppercase font-semibold mt-1">Parecer</div></div>
  </div>`;
}

// ---------- History ----------
function viewHistory(){
  if(state.activeAudit){
    const a=state.activeAudit;
    return `<div class="fade-in max-w-4xl mx-auto">
      <button id="backHist" class="text-sm text-slate-500 hover:text-ink-900 flex items-center gap-1 mb-4"><i data-lucide="arrow-left" class="w-4 h-4"></i> Voltar às auditorias</button>
      <div class="bg-white rounded-xl border border-slate-200 p-6">
        <div class="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <div class="text-xs font-semibold text-brand-700 uppercase">${auditTypes()[a.type]?.label||a.type}</div>
            <h2 class="text-xl font-extrabold text-ink-900">${escapeHtml(a.sheetName)}</h2>
            <div class="text-xs text-slate-400 mt-1">${new Date(a.date).toLocaleString('pt-BR')} · ${a.rows} linhas analisadas</div>
          </div>
          <div class="flex gap-2">
            <button id="dlReport" class="tbtn2"><i data-lucide="download" class="w-4 h-4"></i> Baixar laudo</button>
            <button id="delAudit" class="tbtn2 text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
        </div>
        ${scoreHeader(a.score, a.criticals)}
        <div class="prose-ai text-slate-700">${a.html}</div>
      </div>
      <style>.tbtn2{display:inline-flex;align-items:center;gap:.4rem;font-size:.8rem;font-weight:600;color:#334155;background:#f1f5f9;padding:.5rem .8rem;border-radius:.5rem}.tbtn2:hover{background:#e2e8f0}</style>
    </div>`;
  }
  return `<div class="fade-in">
    ${state.audits.length? `
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      ${state.audits.map(a=>`
        <div class="bg-white rounded-xl border border-slate-200 p-5 hover:border-brand-400 transition cursor-pointer" data-open="${a.id}">
          <div class="flex items-center justify-between">
            <span class="w-11 h-11 rounded-xl ${scoreBg(a.score)} flex items-center justify-center font-extrabold">${a.score??'—'}</span>
            <span class="text-[11px] font-semibold px-2 py-1 rounded-full ${a.score>=80?'bg-emerald-50 text-emerald-600':a.score>=60?'bg-amber-50 text-amber-600':'bg-red-50 text-red-600'}">${a.score>=80?'Aprovado':a.score>=60?'Ressalvas':'Reprovado'}</span>
          </div>
          <h3 class="font-bold text-ink-900 mt-3 truncate">${escapeHtml(a.sheetName)}</h3>
          <p class="text-xs text-slate-400">${auditTypes()[a.type]?.label||a.type}</p>
          <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span class="flex items-center gap-1"><i data-lucide="triangle-alert" class="w-3.5 h-3.5 text-red-400"></i>${a.criticals} críticos</span>
            <span>${timeAgo(a.date)}</span>
          </div>
        </div>`).join('')}
    </div>` : `
    <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
      <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><i data-lucide="folder-open" class="w-8 h-8 text-slate-400"></i></div>
      <h3 class="text-lg font-bold text-ink-900">Nenhuma auditoria realizada</h3>
      <p class="text-sm text-slate-500 mt-1">Importe uma planilha e execute uma análise com IA para ver os laudos aqui.</p>
      <button data-nav="editor" class="mt-5 bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg inline-flex items-center gap-2"><i data-lucide="upload" class="w-4 h-4"></i> Importar planilha</button>
    </div>`}
  </div>`;
}
function bindHistory(){
  $('#backHist')?.addEventListener('click',()=>{ state.activeAudit=null; render(); });
  document.querySelectorAll('[data-open]').forEach(c=>c.addEventListener('click',()=>{ state.activeAudit=state.audits.find(a=>a.id===c.dataset.open); render(); }));
  document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>{ state.view=b.dataset.nav; render(); }));
  $('#dlReport')?.addEventListener('click',()=>downloadReport(state.activeAudit));
  $('#delAudit')?.addEventListener('click',async()=>{ if(confirm('Excluir esta auditoria?')){ state.audits=state.audits.filter(a=>a.id!==state.activeAudit.id); await saveAudits(); state.activeAudit=null; render(); } });
}

function downloadReport(a){
  const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Laudo — ${escapeHtml(a.sheetName)}</title>
  <style>body{font-family:Inter,Arial,sans-serif;max-width:820px;margin:40px auto;padding:0 24px;color:#1f2937;line-height:1.6}
  h1{color:#0f766e}h2{color:#0f172a;border-bottom:2px solid #0f766e;padding-bottom:4px;margin-top:1.6em}h3{color:#0f172a}
  table{width:100%;border-collapse:collapse;margin:.6em 0}th,td{border:1px solid #e2e8f0;padding:6px 10px;text-align:left}th{background:#f0fdfa}
  .head{border-left:4px solid #0f766e;padding:8px 16px;background:#f0fdfa;border-radius:6px}</style></head>
  <body><h1>Laudo de Auditoria — AuditIA (ISO/IEC 42001)</h1>
  <div class="head"><strong>Planilha:</strong> ${escapeHtml(a.sheetName)}<br><strong>Tipo:</strong> ${auditTypes()[a.type]?.label||a.type}<br>
  <strong>Data:</strong> ${new Date(a.date).toLocaleString('pt-BR')}<br><strong>Conformidade:</strong> ${a.score??'—'}/100 · <strong>Achados críticos:</strong> ${a.criticals}</div>
  ${a.html}<hr><p style="font-size:12px;color:#94a3b8">Gerado por AuditIA — análise assistida por Inteligência Artificial. Este documento é um apoio à decisão e não substitui o parecer de um auditor responsável.</p></body></html>`;
  const blob=new Blob([html],{type:'text/html'}); const el=document.createElement('a');
  el.href=URL.createObjectURL(blob); el.download='laudo-'+a.sheetName.replace(/\s+/g,'_')+'.html'; el.click();
}

// ---------- About ----------
function viewAbout(){
  const req=(t,d,i)=>`<div class="bg-white rounded-xl border border-slate-200 p-5"><div class="flex items-center gap-2 font-bold text-ink-900"><i data-lucide="${i}" class="w-4 h-4 text-brand-700"></i>${t}</div><p class="text-sm text-slate-500 mt-2 leading-relaxed">${d}</p></div>`;
  return `<div class="fade-in max-w-4xl mx-auto space-y-6">
    <div class="bg-white rounded-xl border border-slate-200 p-6">
      <div class="inline-flex items-center gap-2 bg-brand-50 text-brand-700 rounded-full px-3 py-1 text-xs font-semibold mb-3"><i data-lucide="shield-check" class="w-3.5 h-3.5"></i> Norma internacional</div>
      <h2 class="text-2xl font-extrabold text-ink-900">ISO/IEC 42001 — Sistema de Gestão de IA</h2>
      <p class="text-slate-600 mt-2 leading-relaxed">A ISO/IEC 42001 é a primeira norma internacional para <strong>Sistemas de Gestão de Inteligência Artificial (SGIA)</strong>. Ela estabelece requisitos para desenvolver, implementar e melhorar o uso responsável de IA — com foco em governança, transparência, gestão de riscos e rastreabilidade. Este sistema aplica esses princípios à auditoria financeira e fiscal automatizada.</p>
    </div>
    <div class="grid sm:grid-cols-2 gap-4">
      ${req('Transparência','Cada laudo indica claramente que foi gerado por IA, com os dados de entrada rastreáveis e um parecer explicável.','eye')}
      ${req('Gestão de riscos','A ferramenta classifica achados por severidade (crítico, alto, médio, baixo) apoiando a tomada de decisão baseada em risco.','triangle-alert')}
      ${req('Rastreabilidade','Todas as auditorias ficam registradas com data, tipo, planilha analisada e pontuação, formando trilha de auditoria.','history')}
      ${req('Supervisão humana','A IA é um apoio à decisão — o parecer final e a responsabilidade permanecem com o auditor humano.','user-check')}
    </div>
    <div class="bg-amber-50 border border-amber-200 rounded-xl p-5 flex gap-3">
      <i data-lucide="info" class="w-5 h-5 text-amber-600 shrink-0"></i>
      <p class="text-sm text-amber-800">Este aplicativo é uma ferramenta de apoio à auditoria. Os resultados gerados pela IA devem ser revisados por um profissional qualificado e não substituem um parecer contábil ou jurídico oficial.</p>
    </div>
  </div>`;
}

// ---------- Helpers ----------
function ensureSignedInSoft(){
  // AI works for guests too, but encourage sign-in for cloud save
  if(!state.signedIn){
    // allow but inform once
    if(!window.__warnedGuest){ window.__warnedGuest=true; toast('Dica: entre para salvar suas auditorias na nuvem.'); }
  }
  return true;
}
function escapeHtml(s){ return String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function scoreBg(s){ if(s==null)return 'bg-slate-100 text-slate-500'; if(s>=80)return 'bg-emerald-50 text-emerald-600'; if(s>=60)return 'bg-amber-50 text-amber-600'; return 'bg-red-50 text-red-600'; }
function scoreColorHex(s){ if(s==null)return '#64748b'; if(s>=80)return '#059669'; if(s>=60)return '#d97706'; return '#dc2626'; }
function timeAgo(t){ const d=Math.floor((Date.now()-t)/1000); if(d<60)return 'agora'; if(d<3600)return Math.floor(d/60)+'min'; if(d<86400)return Math.floor(d/3600)+'h'; return Math.floor(d/86400)+'d'; }
function toast(msg){
  let t=$('#toast'); if(t)t.remove();
  t=document.createElement('div'); t.id='toast';
  t.className='fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] bg-ink-900 text-white text-sm px-4 py-2.5 rounded-lg fade-in shadow-lg';
  t.textContent=msg; document.body.appendChild(t);
  setTimeout(()=>t.remove(),2600);
}
function sampleSheet(){
  const header=['Data','Descrição','Categoria','Débito (R$)','Crédito (R$)','ICMS (R$)'];
  const rows=[
    ['05/01/2024','Venda NF 1021','Receita','','12500,00','2250,00'],
    ['07/01/2024','Compra fornecedor A','Custo','8300,00','','1494,00'],
    ['07/01/2024','Compra fornecedor A','Custo','8300,00','','1494,00'],
    ['12/01/2024','Pagamento salários','Despesa','15400,00','',''],
    ['15/01/2024','Venda NF 1044','Receita','','9800,00','1764,00'],
    ['18/01/2024','Serviço consultoria','Receita','','4500,00','0,00'],
    ['20/01/2024','Aluguel','Despesa','3200,00','',''],
    ['22/01/2024','Venda NF 1050','Receita','','98000,00','17640,00'],
    ['25/01/2024','Reembolso indevido','Despesa','9999,99','',''],
    ['28/01/2024','Compra material','Custo','1200,00','','216,00'],
  ];
  return { name:'Razão Contábil - Jan/2024 (exemplo)', header, rows };
}

// ---------- Boot ----------
(async function(){
  render();
  await initAuth();
  render();
})();
