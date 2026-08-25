import { createIcons, icons } from 'https://cdn.jsdelivr.net/npm/lucide@latest/+esm';
import { CATEGORIES, STATUS, RISK, totalControls } from './controls.js';

/* ---------------- State ---------------- */
const KV_INDEX = 'auditai42001:index';
const KV_AUDIT = (id) => `auditai42001:audit:${id}`;

let signedIn = false;
let user = null;
let audits = [];        // [{id,name,org,auditor,createdAt,updatedAt}]
let current = null;     // full audit object {meta, answers:{[ctrlId]:{status,notes}}}
let view = 'dashboard'; // dashboard | <categoryId> | report
let saveTimer = null;

const $app = document.getElementById('app');

/* ---------------- Persistence ---------------- */
async function loadIndex() {
  try {
    const raw = await puter.kv.get(KV_INDEX);
    audits = raw ? JSON.parse(raw) : [];
  } catch { audits = []; }
}
async function saveIndex() {
  await puter.kv.set(KV_INDEX, JSON.stringify(audits));
}
async function loadAudit(id) {
  const raw = await puter.kv.get(KV_AUDIT(id));
  return raw ? JSON.parse(raw) : null;
}
async function persistCurrent() {
  if (!current) return;
  current.meta.updatedAt = Date.now();
  const idx = audits.find(a => a.id === current.meta.id);
  if (idx) { idx.updatedAt = current.meta.updatedAt; idx.name = current.meta.name; idx.org = current.meta.org; }
  await puter.kv.set(KV_AUDIT(current.meta.id), JSON.stringify(current));
  await saveIndex();
  flashSaved();
}
function queueSave() {
  clearTimeout(saveTimer);
  setSaveState('saving');
  saveTimer = setTimeout(() => persistCurrent(), 700);
}

/* ---------------- Scoring ---------------- */
function allControls() {
  return CATEGORIES.flatMap(c => c.controls.map(ctrl => ({ ...ctrl, catId: c.id, clause: c.clause })));
}
function answerFor(id) {
  return (current && current.answers[id]) || { status: 'pendente', notes: '' };
}
function scoreStats(catId = null) {
  let scored = 0, sum = 0, counts = { conforme:0, parcial:0, nao_conforme:0, na:0, pendente:0 };
  const list = catId ? CATEGORIES.find(c=>c.id===catId).controls : allControls();
  list.forEach(ctrl => {
    const a = answerFor(ctrl.id);
    counts[a.status] = (counts[a.status]||0) + 1;
    const s = STATUS[a.status].score;
    if (s !== null) { scored++; sum += s; }
  });
  const pct = scored ? Math.round((sum / scored) * 100) : 0;
  return { pct, scored, total: list.length, counts };
}
function openFindings() {
  return allControls().filter(c => {
    const s = answerFor(c.id).status;
    return s === 'nao_conforme' || s === 'parcial';
  }).sort((a,b) => riskRank(b.risk) - riskRank(a.risk));
}
function riskRank(r){ return { critico:4, alto:3, medio:2, baixo:1 }[r]||0; }

/* ---------------- Rendering ---------------- */
function render() {
  if (!signedIn) { renderSignedOut(); return; }
  if (!current) { renderHome(); return; }
  renderWorkspace();
  refreshIcons();
}
function refreshIcons(){ createIcons({ icons }); }

function shell(inner, opts = {}) {
  return `
  <header class="no-print sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-ink-300/60">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
      <div class="flex items-center gap-2.5 cursor-pointer" id="logoHome">
        <div class="w-9 h-9 rounded-xl bg-brand-700 flex items-center justify-center text-white">
          <i data-lucide="shield-check" class="w-5 h-5"></i>
        </div>
        <div class="leading-tight">
          <div class="font-extrabold tracking-tight">AIMS AUDIT<span class="text-brand-600">42001</span></div>
          <div class="text-[11px] text-ink-500 -mt-0.5 hidden sm:block">ISO/IEC 42001 · PLD / AML</div>
        </div>
      </div>
      <div class="flex-1"></div>
      ${opts.headerRight || ''}
      <div class="flex items-center gap-2 pl-2 border-l border-ink-300/60">
        <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">${(user?.username||'?').slice(0,1).toUpperCase()}</div>
        <div class="hidden sm:block text-sm font-medium max-w-[120px] truncate">${user?.username||''}</div>
        <button id="signOut" class="ml-1 text-ink-500 hover:text-ink-900 p-1.5 rounded-lg hover:bg-ink-100" title="Sair"><i data-lucide="log-out" class="w-4 h-4"></i></button>
      </div>
    </div>
  </header>
  ${inner}`;
}

/* ----- Signed out ----- */
function renderSignedOut() {
  $app.innerHTML = `
  <div class="min-h-screen flex flex-col">
    <div class="flex-1 grid lg:grid-cols-2">
      <div class="flex items-center justify-center p-8 sm:p-14">
        <div class="max-w-md w-full fade-in">
          <div class="flex items-center gap-2.5 mb-8">
            <div class="w-11 h-11 rounded-xl bg-brand-700 flex items-center justify-center text-white"><i data-lucide="shield-check" class="w-6 h-6"></i></div>
            <div class="font-extrabold text-xl tracking-tight">AIMS AUDIT<span class="text-brand-600">42001</span></div>
          </div>
          <h1 class="text-3xl font-extrabold tracking-tight leading-tight">Auditoria de IA para prevenção à lavagem de dinheiro</h1>
          <p class="mt-4 text-ink-500 leading-relaxed">Avalie seus sistemas de inteligência artificial de PLD/AML contra os requisitos da <strong class="text-ink-700">ISO/IEC 42001:2023</strong>. Documente conformidade, evidências, riscos e gere relatórios de auditoria.</p>
          <ul class="mt-6 space-y-3 text-sm">
            ${['Framework completo com cláusulas 4–10 e anexos A','Pontuação de conformidade e mapa de riscos','Relatório de auditoria exportável'].map(t=>`
              <li class="flex items-center gap-3"><span class="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center flex-shrink-0"><i data-lucide="check" class="w-3 h-3"></i></span><span class="text-ink-700">${t}</span></li>`).join('')}
          </ul>
          <button id="signIn" class="mt-8 w-full bg-brand-700 hover:bg-brand-800 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2">
            <i data-lucide="log-in" class="w-4 h-4"></i> Entrar para começar
          </button>
          <p class="mt-3 text-xs text-ink-500 text-center">Seus dados de auditoria ficam salvos com segurança na sua conta.</p>
        </div>
      </div>
      <div class="hidden lg:flex items-center justify-center bg-brand-900 p-14 relative overflow-hidden">
        <div class="absolute inset-0 opacity-10" style="background-image:radial-gradient(circle at 20% 30%, #5eead4 0, transparent 40%),radial-gradient(circle at 80% 70%, #14b8a6 0, transparent 40%)"></div>
        <div class="relative text-white/90 max-w-sm">
          <div class="grid grid-cols-2 gap-4">
            ${[['file-check','11 domínios'],['scale','Gestão de risco de IA'],['database','Governança de dados'],['users','Impacto a indivíduos']].map(([ic,t])=>`
              <div class="rounded-2xl bg-white/10 border border-white/10 p-5">
                <i data-lucide="${ic}" class="w-6 h-6 text-brand-100 mb-3"></i>
                <div class="text-sm font-semibold">${t}</div>
              </div>`).join('')}
          </div>
          <p class="mt-8 text-sm text-white/70 leading-relaxed">Alinhado à Circular BACEN 3.978, Lei 9.613/98 e recomendações do COAF/GAFI para uso responsável de IA em compliance.</p>
        </div>
      </div>
    </div>
  </div>`;
  document.getElementById('signIn').onclick = doSignIn;
  refreshIcons();
}

/* ----- Home (audits list) ----- */
function renderHome() {
  const sorted = [...audits].sort((a,b)=>b.updatedAt-a.updatedAt);
  const inner = `
  <main class="max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full">
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight">Suas auditorias</h1>
        <p class="text-ink-500 mt-1 text-sm">Gerencie avaliações de conformidade dos seus sistemas de IA de PLD.</p>
      </div>
      <button id="newAudit" class="bg-brand-700 hover:bg-brand-800 text-white font-semibold px-4 py-2.5 rounded-xl transition flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i> Nova auditoria</button>
    </div>
    ${sorted.length === 0 ? `
      <div class="card p-12 text-center">
        <div class="w-14 h-14 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center mx-auto mb-4"><i data-lucide="clipboard-list" class="w-7 h-7"></i></div>
        <h3 class="font-bold text-lg">Nenhuma auditoria ainda</h3>
        <p class="text-ink-500 text-sm mt-1 max-w-sm mx-auto">Crie sua primeira auditoria para avaliar um sistema de IA contra a ISO/IEC 42001.</p>
        <button id="newAudit2" class="mt-5 bg-brand-700 hover:bg-brand-800 text-white font-semibold px-4 py-2.5 rounded-xl transition inline-flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i> Criar auditoria</button>
      </div>` : `
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${sorted.map(a => auditCard(a)).join('')}
      </div>`}
  </main>`;
  $app.innerHTML = shell(inner);
  bindHeader();
  const nb = document.getElementById('newAudit'); if(nb) nb.onclick = newAudit;
  const nb2 = document.getElementById('newAudit2'); if(nb2) nb2.onclick = newAudit;
  document.querySelectorAll('[data-open]').forEach(el => el.onclick = () => openAudit(el.dataset.open));
  document.querySelectorAll('[data-del]').forEach(el => el.onclick = (e) => { e.stopPropagation(); deleteAudit(el.dataset.del); });
  refreshIcons();
}
function auditCard(a) {
  const d = new Date(a.updatedAt);
  const pct = a.pct ?? 0;
  return `
  <div data-open="${a.id}" class="card p-5 cursor-pointer hover:border-brand-500 transition group">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h3 class="font-bold truncate">${escapeHtml(a.name)}</h3>
        <p class="text-xs text-ink-500 truncate mt-0.5">${escapeHtml(a.org||'—')}</p>
      </div>
      <button data-del="${a.id}" class="opacity-0 group-hover:opacity-100 text-ink-300 hover:text-red-500 p-1 rounded transition" title="Excluir"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    </div>
    <div class="mt-4 flex items-center gap-3">
      <div class="text-2xl font-extrabold" style="color:${scoreColor(pct)}">${pct}%</div>
      <div class="flex-1 h-2 rounded-full bg-ink-100 overflow-hidden"><div class="h-full rounded-full" style="width:${pct}%;background:${scoreColor(pct)}"></div></div>
    </div>
    <div class="mt-3 text-[11px] text-ink-500 flex items-center gap-1.5"><i data-lucide="clock" class="w-3 h-3"></i> Atualizado ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
  </div>`;
}

/* ----- Workspace ----- */
function renderWorkspace() {
  const overall = scoreStats();
  const navRight = `
    <div class="hidden md:flex items-center gap-2 mr-1">
      <span id="saveState" class="text-xs text-ink-500 flex items-center gap-1.5"></span>
    </div>
    <button id="backHome" class="no-print text-sm font-medium text-ink-700 hover:text-ink-900 px-3 py-2 rounded-lg hover:bg-ink-100 flex items-center gap-1.5"><i data-lucide="grid-2x2" class="w-4 h-4"></i><span class="hidden sm:inline">Auditorias</span></button>`;

  const inner = `
  <div class="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex gap-6">
    <!-- Sidebar -->
    <aside class="no-print hidden lg:block w-64 flex-shrink-0">
      <div class="sticky top-[88px] space-y-1">
        <div class="card p-4 mb-4">
          <div class="text-xs font-semibold text-ink-500 uppercase tracking-wide">Auditoria</div>
          <div class="font-bold mt-1 leading-snug">${escapeHtml(current.meta.name)}</div>
          <div class="text-xs text-ink-500 mt-0.5 truncate">${escapeHtml(current.meta.org||'—')}</div>
        </div>
        <div class="navlink ${view==='dashboard'?'active':''}" data-view="dashboard"><i data-lucide="layout-dashboard" class="w-4 h-4"></i> Painel</div>
        <div class="text-[11px] font-semibold text-ink-500 uppercase tracking-wide px-3 pt-4 pb-1">Domínios</div>
        ${CATEGORIES.map(c => {
          const st = scoreStats(c.id);
          const done = st.total - st.counts.pendente;
          return `<div class="navlink ${view===c.id?'active':''}" data-view="${c.id}">
            <i data-lucide="${c.icon}" class="w-4 h-4"></i>
            <span class="flex-1 truncate">${c.title}</span>
            <span class="text-[10px] font-semibold ${done===st.total?'text-brand-600':'text-ink-300'}">${done}/${st.total}</span>
          </div>`;
        }).join('')}
        <div class="pt-3"></div>
        <div class="navlink ${view==='report'?'active':''}" data-view="report"><i data-lucide="file-text" class="w-4 h-4"></i> Relatório</div>
      </div>
    </aside>
    <!-- Main -->
    <section class="flex-1 min-w-0" id="main"></section>
  </div>`;

  $app.innerHTML = shell(inner, { headerRight: navRight });
  bindHeader();
  document.getElementById('backHome').onclick = () => { current = null; view='dashboard'; render(); };
  document.querySelectorAll('[data-view]').forEach(el => el.onclick = () => { view = el.dataset.view; renderMain(); scrollTop(); });
  renderMain();
  setSaveState('saved');
  refreshIcons();
}

function renderMain() {
  const main = document.getElementById('main');
  // update active nav
  document.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view===view));
  if (view === 'dashboard') main.innerHTML = dashboardHtml();
  else if (view === 'report') main.innerHTML = reportHtml();
  else main.innerHTML = categoryHtml(view);
  bindMain();
  refreshIcons();
}

function dashboardHtml() {
  const s = scoreStats();
  const findings = openFindings();
  const riskCounts = { critico:0, alto:0, medio:0, baixo:0 };
  findings.forEach(f => riskCounts[f.risk]++);
  const C = 2*Math.PI*54;
  const off = C*(1 - s.pct/100);
  return `
  <div class="fade-in space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight">Painel de conformidade</h1>
        <p class="text-ink-500 text-sm mt-1">Visão geral da avaliação ISO/IEC 42001 para PLD.</p>
      </div>
      <div class="lg:hidden"><button class="text-sm font-medium text-brand-700 flex items-center gap-1" data-view="report"><i data-lucide="file-text" class="w-4 h-4"></i> Relatório</button></div>
    </div>

    <div class="grid lg:grid-cols-3 gap-4">
      <div class="card p-6 flex items-center gap-6">
        <div class="relative w-32 h-32 flex-shrink-0">
          <svg class="ring w-32 h-32" viewBox="0 0 120 120">
            <circle class="ring-bg" cx="60" cy="60" r="54" fill="none" stroke-width="11"/>
            <circle class="ring-fg" cx="60" cy="60" r="54" fill="none" stroke-width="11" stroke-dasharray="${C}" stroke-dashoffset="${off}" style="stroke:${scoreColor(s.pct)}"/>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-3xl font-extrabold" style="color:${scoreColor(s.pct)}">${s.pct}%</span>
            <span class="text-[11px] text-ink-500 font-medium">conformidade</span>
          </div>
        </div>
        <div class="min-w-0">
          <div class="text-sm font-semibold text-ink-700">${maturityLabel(s.pct)}</div>
          <p class="text-xs text-ink-500 mt-1 leading-relaxed">${s.scored} de ${s.total} controles avaliados. ${totalControls()-s.scored+ (s.counts.na||0)} restantes.</p>
          <div class="mt-3 flex flex-wrap gap-1.5">
            ${statusChip('conforme', s.counts.conforme)}
            ${statusChip('parcial', s.counts.parcial)}
            ${statusChip('nao_conforme', s.counts.nao_conforme)}
            ${statusChip('pendente', s.counts.pendente)}
          </div>
        </div>
      </div>

      <div class="card p-6">
        <div class="text-sm font-semibold flex items-center gap-2"><i data-lucide="alert-triangle" class="w-4 h-4 text-amber-500"></i> Achados em aberto</div>
        <div class="mt-4 grid grid-cols-2 gap-3">
          ${Object.entries(riskCounts).map(([k,v])=>`
            <div class="rounded-xl border border-ink-300/60 p-3">
              <div class="text-2xl font-extrabold" style="color:${RISK[k].color}">${v}</div>
              <div class="text-[11px] font-medium text-ink-500">${RISK[k].label}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="card p-6">
        <div class="text-sm font-semibold flex items-center gap-2"><i data-lucide="list-checks" class="w-4 h-4 text-brand-600"></i> Progresso por domínio</div>
        <div class="mt-4 space-y-2.5 max-h-48 overflow-auto pr-1">
          ${CATEGORIES.map(c=>{const st=scoreStats(c.id);return`
            <div class="cursor-pointer group" data-view="${c.id}">
              <div class="flex items-center justify-between text-xs mb-1"><span class="font-medium text-ink-700 group-hover:text-brand-700 truncate">${c.title}</span><span class="text-ink-500">${st.pct}%</span></div>
              <div class="h-1.5 rounded-full bg-ink-100 overflow-hidden"><div class="h-full rounded-full" style="width:${st.pct}%;background:${scoreColor(st.pct)}"></div></div>
            </div>`;}).join('')}
        </div>
      </div>
    </div>

    <div class="card p-6">
      <div class="flex items-center justify-between mb-4">
        <div class="text-sm font-semibold flex items-center gap-2"><i data-lucide="flag" class="w-4 h-4 text-red-500"></i> Prioridades de remediação</div>
        <span class="text-xs text-ink-500">${findings.length} item(ns)</span>
      </div>
      ${findings.length===0 ? `<div class="text-center py-8 text-ink-500 text-sm"><i data-lucide="party-popper" class="w-6 h-6 mx-auto mb-2 text-brand-600"></i>Nenhuma não conformidade em aberto.</div>` : `
      <div class="divide-y divide-ink-300/50">
        ${findings.slice(0,8).map(f=>`
          <div class="py-3 flex items-start gap-3 cursor-pointer hover:bg-ink-100/50 -mx-2 px-2 rounded-lg" data-goctrl="${f.catId}">
            <span class="mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded" style="color:${RISK[f.risk].color};background:${RISK[f.risk].color}1a">${RISK[f.risk].label}</span>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium truncate">${f.id} · ${escapeHtml(f.title)}</div>
              <div class="text-xs text-ink-500 truncate">${f.clause}</div>
            </div>
            <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full" style="color:${STATUS[answerFor(f.id).status].color};background:${STATUS[answerFor(f.id).status].bg}">${STATUS[answerFor(f.id).status].label}</span>
          </div>`).join('')}
      </div>`}
    </div>
  </div>`;
}

function categoryHtml(catId) {
  const c = CATEGORIES.find(x=>x.id===catId);
  const idx = CATEGORIES.findIndex(x=>x.id===catId);
  const st = scoreStats(catId);
  return `
  <div class="fade-in space-y-5">
    <div class="flex items-start gap-4">
      <div class="w-11 h-11 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0"><i data-lucide="${c.icon}" class="w-6 h-6"></i></div>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-semibold text-brand-600">${c.clause}</div>
        <h1 class="text-2xl font-extrabold tracking-tight">${c.title}</h1>
        <p class="text-ink-500 text-sm mt-1">${c.desc}</p>
      </div>
      <div class="text-right flex-shrink-0">
        <div class="text-2xl font-extrabold" style="color:${scoreColor(st.pct)}">${st.pct}%</div>
        <div class="text-[11px] text-ink-500">${st.total-st.counts.pendente}/${st.total} avaliados</div>
      </div>
    </div>

    <div class="space-y-4">
      ${c.controls.map(ctrl => controlCard(ctrl)).join('')}
    </div>

    <div class="flex items-center justify-between pt-2">
      <button class="text-sm font-medium text-ink-700 hover:text-ink-900 flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-ink-100 ${idx===0?'invisible':''}" data-view="${idx>0?CATEGORIES[idx-1].id:''}"><i data-lucide="arrow-left" class="w-4 h-4"></i> Anterior</button>
      <button class="text-sm font-medium text-white bg-brand-700 hover:bg-brand-800 flex items-center gap-1.5 px-4 py-2 rounded-lg ${idx===CATEGORIES.length-1?'invisible':''}" data-view="${idx<CATEGORIES.length-1?CATEGORIES[idx+1].id:''}">Próximo <i data-lucide="arrow-right" class="w-4 h-4"></i></button>
    </div>
  </div>`;
}

function controlCard(ctrl) {
  const a = answerFor(ctrl.id);
  return `
  <div class="card p-5" id="card-${ctrl.id}">
    <div class="flex items-start gap-3 flex-wrap">
      <span class="text-xs font-bold text-ink-500 bg-ink-100 px-2 py-1 rounded-md">${ctrl.id}</span>
      <div class="flex-1 min-w-0">
        <h3 class="font-bold leading-snug">${escapeHtml(ctrl.title)}</h3>
      </div>
      <span class="text-[10px] font-bold px-2 py-1 rounded" style="color:${RISK[ctrl.risk].color};background:${RISK[ctrl.risk].color}1a">Risco ${RISK[ctrl.risk].label}</span>
    </div>
    <p class="text-sm text-ink-700 mt-3 leading-relaxed">${escapeHtml(ctrl.req)}</p>
    <div class="mt-3 flex items-start gap-2 text-xs text-ink-500 bg-ink-100/70 rounded-lg p-2.5">
      <i data-lucide="paperclip" class="w-3.5 h-3.5 mt-0.5 flex-shrink-0"></i>
      <span><span class="font-semibold text-ink-700">Evidência sugerida:</span> ${escapeHtml(ctrl.evidencia)}</span>
    </div>
    <div class="mt-4 flex flex-wrap items-center gap-3">
      <div class="seg" data-ctrl="${ctrl.id}">
        ${Object.entries(STATUS).filter(([k])=>k!=='pendente').map(([k,v])=>`
          <button data-status="${k}" class="${a.status===k?'active':''}" style="${a.status===k?`background:${v.color}`:''}">${v.label}</button>`).join('')}
      </div>
    </div>
    <div class="mt-3">
      <label class="text-xs font-semibold text-ink-500 flex items-center gap-1.5 mb-1"><i data-lucide="pen-line" class="w-3.5 h-3.5"></i> Notas de auditoria & evidências</label>
      <textarea data-notes="${ctrl.id}" rows="2" placeholder="Registre observações, evidências analisadas e ações requeridas..." class="w-full text-sm rounded-lg border border-ink-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none px-3 py-2 transition">${escapeHtml(a.notes||'')}</textarea>
    </div>
  </div>`;
}

function reportHtml() {
  const s = scoreStats();
  const findings = openFindings();
  const now = new Date();
  return `
  <div class="fade-in space-y-6">
    <div class="no-print flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight">Relatório de auditoria</h1>
        <p class="text-ink-500 text-sm mt-1">Resumo executivo e detalhamento por controle.</p>
      </div>
      <div class="flex gap-2">
        <button id="printBtn" class="border border-ink-300 hover:bg-ink-100 font-semibold text-sm px-4 py-2.5 rounded-xl flex items-center gap-2"><i data-lucide="printer" class="w-4 h-4"></i> Imprimir / PDF</button>
        <button id="exportBtn" class="bg-brand-700 hover:bg-brand-800 text-white font-semibold text-sm px-4 py-2.5 rounded-xl flex items-center gap-2"><i data-lucide="download" class="w-4 h-4"></i> Exportar</button>
      </div>
    </div>

    <div class="card p-6 sm:p-8">
      <div class="flex items-start justify-between border-b border-ink-300/60 pb-5">
        <div>
          <div class="text-xs font-bold text-brand-600 uppercase tracking-wide">Relatório de conformidade ISO/IEC 42001</div>
          <h2 class="text-xl font-extrabold mt-1">${escapeHtml(current.meta.name)}</h2>
          <div class="text-sm text-ink-500 mt-1">${escapeHtml(current.meta.org||'—')}</div>
        </div>
        <div class="text-right text-xs text-ink-500 space-y-0.5">
          <div><span class="font-semibold text-ink-700">Auditor:</span> ${escapeHtml(current.meta.auditor||user?.username||'—')}</div>
          <div><span class="font-semibold text-ink-700">Data:</span> ${now.toLocaleDateString('pt-BR')}</div>
          <div><span class="font-semibold text-ink-700">Escopo:</span> IA em PLD/AML</div>
        </div>
      </div>

      <div class="grid sm:grid-cols-4 gap-4 py-6">
        <div><div class="text-3xl font-extrabold" style="color:${scoreColor(s.pct)}">${s.pct}%</div><div class="text-xs text-ink-500">Conformidade geral</div></div>
        <div><div class="text-3xl font-extrabold text-emerald-600">${s.counts.conforme}</div><div class="text-xs text-ink-500">Conformes</div></div>
        <div><div class="text-3xl font-extrabold text-amber-600">${s.counts.parcial}</div><div class="text-xs text-ink-500">Parciais</div></div>
        <div><div class="text-3xl font-extrabold text-red-600">${s.counts.nao_conforme}</div><div class="text-xs text-ink-500">Não conformes</div></div>
      </div>

      <div class="py-4 border-t border-ink-300/60">
        <h3 class="font-bold text-sm mb-1">Parecer</h3>
        <p class="text-sm text-ink-700 leading-relaxed">${verdict(s)}</p>
      </div>

      ${findings.length ? `
      <div class="py-4 border-t border-ink-300/60">
        <h3 class="font-bold text-sm mb-3">Achados prioritários (${findings.length})</h3>
        <div class="space-y-2">
          ${findings.map(f=>`
            <div class="flex items-start gap-3 text-sm border border-ink-300/60 rounded-lg p-3">
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5" style="color:${RISK[f.risk].color};background:${RISK[f.risk].color}1a">${RISK[f.risk].label}</span>
              <div class="flex-1 min-w-0">
                <div class="font-semibold">${f.id} · ${escapeHtml(f.title)} <span class="font-normal text-ink-500">(${f.clause})</span></div>
                ${answerFor(f.id).notes?`<div class="text-ink-500 text-xs mt-0.5">${escapeHtml(answerFor(f.id).notes)}</div>`:''}
              </div>
              <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style="color:${STATUS[answerFor(f.id).status].color};background:${STATUS[answerFor(f.id).status].bg}">${STATUS[answerFor(f.id).status].label}</span>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="py-4 border-t border-ink-300/60">
        <h3 class="font-bold text-sm mb-3">Detalhamento completo</h3>
        <div class="space-y-4">
          ${CATEGORIES.map(c=>{const st=scoreStats(c.id);return`
            <div>
              <div class="flex items-center justify-between text-sm font-semibold mb-1.5"><span>${c.clause} · ${c.title}</span><span style="color:${scoreColor(st.pct)}">${st.pct}%</span></div>
              <div class="border border-ink-300/60 rounded-lg divide-y divide-ink-300/40">
                ${c.controls.map(ctrl=>{const a=answerFor(ctrl.id);return`
                  <div class="flex items-center gap-3 px-3 py-2 text-sm">
                    <span class="text-xs font-bold text-ink-500 w-16 flex-shrink-0">${ctrl.id}</span>
                    <span class="flex-1 min-w-0 truncate">${escapeHtml(ctrl.title)}</span>
                    <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style="color:${STATUS[a.status].color};background:${STATUS[a.status].bg}">${STATUS[a.status].label}</span>
                  </div>`;}).join('')}
              </div>
            </div>`;}).join('')}
        </div>
      </div>
      <div class="pt-4 text-[11px] text-ink-300 border-t border-ink-300/60">Gerado por AuditAI42001 · ${now.toLocaleString('pt-BR')} · Documento de suporte à auditoria, não constitui certificação.</div>
    </div>
  </div>`;
}

/* ---------------- Bindings ---------------- */
function bindHeader() {
  const so = document.getElementById('signOut'); if (so) so.onclick = doSignOut;
  const lh = document.getElementById('logoHome'); if (lh) lh.onclick = () => { current=null; view='dashboard'; render(); };
}
function bindMain() {
  document.querySelectorAll('[data-view]').forEach(el => el.onclick = () => { view=el.dataset.view; renderMain(); scrollTop(); });
  document.querySelectorAll('[data-goctrl]').forEach(el => el.onclick = () => { view=el.dataset.goctrl; renderMain(); scrollTop(); });
  // status segments
  document.querySelectorAll('.seg[data-ctrl]').forEach(seg => {
    seg.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => {
        const id = seg.dataset.ctrl;
        setStatus(id, btn.dataset.status);
        seg.querySelectorAll('button').forEach(b=>{ b.classList.remove('active'); b.style.background=''; });
        btn.classList.add('active');
        btn.style.background = STATUS[btn.dataset.status].color;
      };
    });
  });
  // notes
  document.querySelectorAll('[data-notes]').forEach(t => {
    t.oninput = () => setNotes(t.dataset.notes, t.value);
  });
  const pb = document.getElementById('printBtn'); if (pb) pb.onclick = () => window.print();
  const eb = document.getElementById('exportBtn'); if (eb) eb.onclick = exportAudit;
}

function setStatus(id, status) {
  current.answers[id] = { ...(current.answers[id]||{notes:''}), status };
  queueSave();
}
function setNotes(id, notes) {
  current.answers[id] = { ...(current.answers[id]||{status:'pendente'}), notes };
  queueSave();
}

/* ---------------- Actions ---------------- */
async function doSignIn() {
  try {
    await puter.auth.signIn();
    await boot();
  } catch (e) { /* cancelled */ }
}
async function doSignOut() {
  await puter.auth.signOut();
  signedIn = false; user = null; current = null;
  render();
}
async function newAudit() {
  const name = prompt('Nome da auditoria (ex.: Sistema de monitoramento transacional 2024):');
  if (!name) return;
  const org = prompt('Instituição / área auditada:') || '';
  const id = 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  const meta = { id, name: name.trim(), org: org.trim(), auditor: user?.username||'', createdAt: Date.now(), updatedAt: Date.now(), pct: 0 };
  current = { meta, answers: {} };
  audits.push({ ...meta });
  await puter.kv.set(KV_AUDIT(id), JSON.stringify(current));
  await saveIndex();
  view = 'dashboard';
  render();
}
async function openAudit(id) {
  const a = await loadAudit(id);
  if (!a) { alert('Auditoria não encontrada.'); return; }
  current = a;
  view = 'dashboard';
  render();
}
async function deleteAudit(id) {
  if (!confirm('Excluir esta auditoria permanentemente?')) return;
  audits = audits.filter(a => a.id !== id);
  await saveIndex();
  try { await puter.kv.del(KV_AUDIT(id)); } catch {}
  render();
}
function exportAudit() {
  const data = { framework: 'ISO/IEC 42001:2023 · PLD/AML', meta: current.meta, results: {} };
  allControls().forEach(c => {
    const a = answerFor(c.id);
    data.results[c.id] = { titulo:c.title, clausula:c.clause, risco:c.risk, status:a.status, notas:a.notes||'' };
  });
  data.pontuacao = scoreStats().pct;
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `auditoria-42001-${current.meta.name.replace(/\s+/g,'-').toLowerCase()}.json`;
  a.click(); URL.revokeObjectURL(url);
}

/* ---------------- Helpers ---------------- */
function scoreColor(p){ if(p>=80) return '#059669'; if(p>=50) return '#d97706'; return '#dc2626'; }
function maturityLabel(p){ if(p>=85) return 'Maturidade alta — sistema de gestão de IA robusto'; if(p>=60) return 'Maturidade moderada — melhorias recomendadas'; if(p>=30) return 'Maturidade em desenvolvimento — lacunas relevantes'; return 'Maturidade inicial — atenção prioritária'; }
function verdict(s){
  if(s.scored===0) return 'Auditoria ainda não iniciada. Avalie os controles para gerar o parecer.';
  if(s.pct>=85) return `Com ${s.pct}% de conformidade, o sistema de IA demonstra aderência sólida à ISO/IEC 42001 no contexto de PLD. Manter monitoramento contínuo e tratar os ${s.counts.parcial+s.counts.nao_conforme} pontos residuais.`;
  if(s.pct>=60) return `Conformidade de ${s.pct}%. O sistema atende à maioria dos requisitos, porém há ${s.counts.nao_conforme} não conformidade(s) e ${s.counts.parcial} controle(s) parcial(is) que exigem planos de ação com prazos definidos.`;
  return `Conformidade de ${s.pct}%, abaixo do nível recomendado. Há ${s.counts.nao_conforme} não conformidade(s) que representam risco relevante à prevenção à lavagem de dinheiro e requerem remediação prioritária.`;
}
function statusChip(k,n){ const v=STATUS[k]; return `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full" style="color:${v.color};background:${v.bg}">${n} ${v.label}</span>`; }
function escapeHtml(s){ return (s==null?'':String(s)).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function scrollTop(){ window.scrollTo({top:0,behavior:'smooth'}); }
function setSaveState(state){
  const el = document.getElementById('saveState');
  if(!el) return;
  if(state==='saving') el.innerHTML = '<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Salvando...';
  else el.innerHTML = '<i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-brand-600"></i> Salvo';
  createIcons({ icons });
}
function flashSaved(){ setSaveState('saved'); if(current){ const m=audits.find(a=>a.id===current.meta.id); if(m) m.pct=scoreStats().pct; } }

/* ---------------- Boot ---------------- */
async function boot() {
  signedIn = puter.auth.isSignedIn();
  if (signedIn) {
    try { user = await puter.auth.getUser(); } catch { user = { username:'usuário' }; }
    await loadIndex();
  }
  render();
}
boot();
