import { createIcons, icons } from 'https://cdn.jsdelivr.net/npm/lucide@latest/+esm';
import { state, loadData, saveData } from './store.js';
import { toast } from './utils.js';
import { renderDashboard } from './views/dashboard.js';
import { renderInventory } from './views/inventory.js';
import { renderTransport } from './views/transport.js';
import { renderCodes } from './views/codes.js';
import { renderAI } from './views/ai.js';

const NAV = [
  { id:'dashboard', label:'Painel', icon:'layout-dashboard', render:renderDashboard },
  { id:'inventory', label:'Estoque FIFO/FEFO/LIFO', icon:'boxes', render:renderInventory },
  { id:'transport', label:'Modais & Rotas', icon:'truck', render:renderTransport },
  { id:'codes', label:'EAN-13 & QR Code', icon:'qr-code', render:renderCodes },
  { id:'ai', label:'IA & ISO 42001', icon:'shield-check', render:renderAI },
];

let current = 'dashboard';

function refreshIcons(){ createIcons({ icons }); }
window.__refreshIcons = refreshIcons;

async function initAuth(){
  try{ state.signedIn = puter.auth.isSignedIn(); }catch(e){ state.signedIn=false; }
  if(state.signedIn){
    try{ state.user = await puter.auth.getUser(); }catch(e){}
  }
}

async function signIn(){
  try{
    await puter.auth.signIn();
    state.signedIn = true;
    state.user = await puter.auth.getUser();
    await loadData();
    renderShell(); navigate(current);
    toast('Conectado. Seus dados agora são salvos na nuvem.');
  }catch(e){ toast('Login cancelado', 'warn'); }
}

async function signOut(){
  try{ await puter.auth.signOut(); }catch(e){}
  state.signedIn=false; state.user=null;
  await loadData();
  renderShell(); navigate(current);
}
window.__logiSignIn = signIn;
window.__logiSignOut = signOut;

function renderShell(){
  const app = document.getElementById('app');
  const u = state.user;
  const userChip = state.signedIn
    ? `<div class="flex items-center gap-2">
         <div class="w-8 h-8 rounded-full bg-brand-700 text-white grid place-items-center text-xs font-bold">${(u?.username||'U').slice(0,2).toUpperCase()}</div>
         <div class="hidden sm:block leading-tight"><div class="text-xs font-semibold text-slate-700">${u?.username||'Usuário'}</div><div class="text-[10px] text-slate-400">Sincronizado</div></div>
         <button onclick="__logiSignOut()" class="btn btn-ghost px-2.5 py-1.5 text-xs ml-1"><i data-lucide="log-out" class="w-3.5 h-3.5"></i></button>
       </div>`
    : `<button onclick="__logiSignIn()" class="btn btn-primary px-3.5 py-2 text-xs"><i data-lucide="log-in" class="w-3.5 h-3.5"></i> Entrar / Salvar na nuvem</button>`;

  app.innerHTML = `
  <div class="min-h-screen flex flex-col lg:flex-row">
    <!-- Sidebar -->
    <aside class="lg:w-72 lg:min-h-screen bg-white border-r border-slate-200 flex lg:flex-col shrink-0 lg:sticky lg:top-0 z-30">
      <div class="p-4 lg:p-5 flex items-center gap-3 border-b border-slate-100 w-full">
        <div class="w-10 h-10 rounded-xl bg-brand-700 grid place-items-center text-white shrink-0">
          <i data-lucide="package-open" class="w-5 h-5"></i>
        </div>
        <div class="leading-tight">
          <div class="font-bold text-slate-800 tracking-tight">LogiFlow</div>
          <div class="text-[11px] text-slate-400">Logística Integrada</div>
        </div>
        <button class="ml-auto lg:hidden btn btn-ghost p-2" onclick="document.getElementById('mnav').classList.toggle('hidden')"><i data-lucide="menu" class="w-5 h-5"></i></button>
      </div>
      <nav id="mnav" class="hidden lg:flex flex-col gap-1 p-3 flex-1 w-full">
        ${NAV.map(n=>`
          <button data-nav="${n.id}" class="nav-item ${n.id===current?'active':''} flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 text-left">
            <i data-lucide="${n.icon}" class="w-4.5 h-4.5 w-[18px] h-[18px] text-slate-400"></i>
            <span>${n.label}</span>
          </button>`).join('')}
        <div class="mt-auto pt-4 text-[10px] text-slate-400 px-3 leading-relaxed">
          Conectado ao módulo Financeiro • ISO 42001 • IA
        </div>
      </nav>
    </aside>

    <!-- Main -->
    <div class="flex-1 min-w-0 flex flex-col">
      <header class="h-16 bg-white/80 backdrop-blur border-b border-slate-200 flex items-center gap-3 px-4 lg:px-8 sticky top-0 z-20">
        <div class="min-w-0">
          <h1 id="page-title" class="font-bold text-slate-800 truncate">Painel</h1>
          <p id="page-sub" class="text-[11px] text-slate-400 truncate">Visão geral da operação logística</p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          ${!state.signedIn?'<span class="badge bg-amber-100 text-amber-700 hidden md:inline">Modo demonstração</span>':''}
          ${userChip}
        </div>
      </header>
      <main id="view" class="flex-1 p-4 lg:p-8 max-w-[1400px] w-full mx-auto"></main>
    </div>
  </div>`;

  app.querySelectorAll('[data-nav]').forEach(b=> b.addEventListener('click', ()=>{
    navigate(b.dataset.nav);
    document.getElementById('mnav').classList.add('lg:flex');
    if(window.innerWidth<1024) document.getElementById('mnav').classList.add('hidden');
  }));
  refreshIcons();
}

function navigate(id){
  current = id;
  const item = NAV.find(n=>n.id===id) || NAV[0];
  document.querySelectorAll('[data-nav]').forEach(b=> b.classList.toggle('active', b.dataset.nav===id));
  const titles = {
    dashboard:['Painel','Visão geral da operação logística'],
    inventory:['Estoque','Gestão de lotes com FIFO, FEFO e LIFO'],
    transport:['Modais & Rotas','Transporte multimodal e mapa de rotas'],
    codes:['Códigos','Geração de EAN-13 e QR Code'],
    ai:['IA & ISO 42001','Análise inteligente de fraudes e conformidade'],
  };
  const [t,s] = titles[id]||['LogiFlow',''];
  document.getElementById('page-title').textContent = t;
  document.getElementById('page-sub').textContent = s;
  const view = document.getElementById('view');
  view.innerHTML = `<div class="view">${item.render()}</div>`;
  refreshIcons();
  // post-render hooks
  const evt = new CustomEvent('view:'+id);
  document.dispatchEvent(evt);
}
window.__navigate = navigate;

(async function boot(){
  await initAuth();
  await loadData();
  renderShell();
  navigate('dashboard');
})();
