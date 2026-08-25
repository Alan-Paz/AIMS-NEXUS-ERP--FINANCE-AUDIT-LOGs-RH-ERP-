import { createIcons, icons } from 'https://cdn.jsdelivr.net/npm/lucide@latest/+esm';
import { loadState, state, subscribe } from './store.js';
import { toast } from './utils.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderFinanceiro } from './modules/financeiro.js';
import { renderLogistica } from './modules/logistica.js';
import { renderEstoque } from './modules/estoque.js';
import { renderFiscal } from './modules/fiscal.js';
import { renderNFe } from './modules/nfe.js';
import { renderAI } from './modules/ai_panel.js';

window.lucideRefresh = () => createIcons({ icons });

const ROUTES = {
  dashboard: { title:'AIMS ERP NEXUS Painel Geral', icon:'layout-dashboard', render:renderDashboard, group:'Visão' },
  financeiro:{ title:'Análise Financeira', icon:'line-chart', render:renderFinanceiro, group:'Módulos' },
  logistica: { title:'Logística & Modais', icon:'truck', render:renderLogistica, group:'Módulos' },
  estoque:   { title:'Estoque / EAN / QR', icon:'boxes', render:renderEstoque, group:'Módulos' },
  fiscal:    { title:'Malha Fiscal & Tributos', icon:'scale', render:renderFiscal, group:'Módulos' },
  nfe:       { title:'Gerador NF-e / DANFE', icon:'file-text', render:renderNFe, group:'Módulos' },
  ai:        { title:'Motor de IA · ISO 42001', icon:'brain-circuit', render:renderAI, group:'Inteligência' }
};

let current = location.hash.replace('#','') || 'dashboard';

function navHTML(){
  const groups = {};
  Object.entries(ROUTES).forEach(([k,v])=>{ (groups[v.group]=groups[v.group]||[]).push([k,v]); });
  return Object.entries(groups).map(([g,items])=>`
    <div class="mb-4">
      <p class="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">${g}</p>
      ${items.map(([k,v])=>`
        <a href="#${k}" data-nav="${k}" class="nav-link ${k===current?'active':''} flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 transition">
          <i data-lucide="${v.icon}" class="w-[18px] h-[18px]"></i>
          <span>${v.title}</span>
        </a>`).join('')}
    </div>`).join('');
}

async function authArea(){
  let signed=false, name='';
  try { if(typeof puter!=='undefined' && puter.auth){ signed = await puter.auth.isSignedIn(); if(signed){ const u=await puter.auth.getUser(); name=u?.username||'usuário'; } } } catch(e){}
  if(signed){
    return `<div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold text-white">${name.slice(0,2).toUpperCase()}</div>
      <div class="hidden sm:block"><p class="text-xs text-slate-200 leading-tight">${name}</p><p class="text-[10px] text-emerald-400">sincronizado</p></div>
      <button id="signout" class="btn btn-ghost !py-1.5 !px-2 ml-1"><i data-lucide="log-out" class="w-4 h-4"></i></button>
    </div>`;
  }
  return `<button id="signin" class="btn btn-primary !py-1.5"><i data-lucide="log-in" class="w-4 h-4"></i><span class="hidden sm:inline">Entrar / Sincronizar</span></button>`;
}

async function shell(){
  const app = document.getElementById('app');
  const route = ROUTES[current] || ROUTES.dashboard;
  app.innerHTML = `
  <div class="flex min-h-screen">
    <!-- Sidebar -->
    <aside id="sidebar" class="fixed lg:static inset-y-0 left-0 z-40 w-64 shrink-0 bg-ink-900 border-r border-slate-800 flex flex-col -translate-x-full lg:translate-x-0 transition-transform">
      <div class="flex items-center gap-2.5 px-4 h-16 border-b border-slate-800">
        <div class="w-9 h-9 rounded-xl bg-brand-700 flex items-center justify-center"><i data-lucide="hexagon" class="w-5 h-5 text-brand-200"></i></div>
        <div><p class="font-extrabold text-white leading-none tracking-tight">Nexus<span class="text-brand-400">ERP</span></p><p class="text-[10px] text-slate-500 mt-0.5">Motor de IA · ISO 42001</p></div>
      </div>
      <nav class="flex-1 overflow-y-auto p-3">${navHTML()}</nav>
      <div class="p-3 border-t border-slate-800">
        <div class="card-soft p-3 text-[11px] text-slate-400 flex items-start gap-2">
          <i data-lucide="shield-check" class="w-4 h-4 text-emerald-400 mt-0.5 shrink-0"></i>
          <span>Governança de IA conforme <b class="text-slate-200">ISO/IEC 42001</b>: decisões rastreáveis e auditáveis.</span>
        </div>
      </div>
    </aside>
    <div id="sb-backdrop" class="fixed inset-0 z-30 bg-black/50 hidden lg:hidden"></div>

    <!-- Main -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="sticky top-0 z-20 h-16 bg-ink-950/85 backdrop-blur border-b border-slate-800 flex items-center gap-3 px-4 sm:px-6">
        <button id="menu-btn" class="lg:hidden text-slate-300"><i data-lucide="menu" class="w-6 h-6"></i></button>
        <div class="flex items-center gap-2 min-w-0">
          <i data-lucide="${route.icon}" class="w-5 h-5 text-brand-400 shrink-0"></i>
          <h1 class="font-semibold text-slate-100 truncate">${route.title}</h1>
        </div>
        <div class="ml-auto flex items-center gap-3">
          <div id="auth-area"></div>
        </div>
      </header>
      <main id="view" class="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto"></main>
    </div>
  </div>`;

  document.getElementById('auth-area').innerHTML = await authArea();
  bindShell();
  window.lucideRefresh();
  const view = document.getElementById('view');
  view.classList.add('fade-in');
  await route.render(view);
  window.lucideRefresh();
}

function bindShell(){
  document.querySelectorAll('[data-nav]').forEach(a=>a.addEventListener('click', (e)=>{
    current = a.dataset.nav; closeSidebar();
  }));
  const menu = document.getElementById('menu-btn');
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sb-backdrop');
  menu?.addEventListener('click', ()=>{ sb.classList.remove('-translate-x-full'); bd.classList.remove('hidden'); });
  bd?.addEventListener('click', closeSidebar);

  document.getElementById('signin')?.addEventListener('click', async ()=>{
    try { await puter.auth.signIn(); await loadState(); toast('Conectado. Dados sincronizados na nuvem.', 'success'); shell(); }
    catch(e){ toast('Não foi possível entrar.', 'error'); }
  });
  document.getElementById('signout')?.addEventListener('click', async ()=>{
    try { await puter.auth.signOut(); toast('Sessão encerrada.', 'info'); shell(); } catch(e){}
  });
}
function closeSidebar(){ document.getElementById('sidebar')?.classList.add('-translate-x-full'); document.getElementById('sb-backdrop')?.classList.add('hidden'); }

window.addEventListener('hashchange', ()=>{ const h=location.hash.replace('#',''); if(ROUTES[h]){ current=h; shell(); } });

(async function init(){
  await loadState();
  await shell();
})();
