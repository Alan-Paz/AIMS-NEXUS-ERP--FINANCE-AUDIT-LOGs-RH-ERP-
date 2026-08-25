import { state } from '../store.js';
import { BRL, NUM, fmtDate, uid, toast, escapeHTML, todayISO } from '../utils.js';

const MODES = {
  'Rodoviário': { icon:'truck', color:'#0d9488', costKm:2.8, speed:60, co2:0.10 },
  'Ferroviário': { icon:'train-front', color:'#6366f1', costKm:1.4, speed:45, co2:0.03 },
  'Aéreo': { icon:'plane', color:'#f43f5e', costKm:6.5, speed:700, co2:0.55 },
  'Marítimo': { icon:'ship', color:'#0ea5e9', costKm:0.9, speed:35, co2:0.015 },
  'Dutoviário': { icon:'git-commit-horizontal', color:'#f59e0b', costKm:0.5, speed:8, co2:0.005 },
};

const CITIES = {
  'Guarulhos-SP':[-23.4543,-46.5337],'São Paulo-SP':[-23.5505,-46.6333],'Rio de Janeiro-RJ':[-22.9068,-43.1729],
  'Belo Horizonte-MG':[-19.9167,-43.9345],'Curitiba-PR':[-25.4284,-49.2733],'Porto Alegre-RS':[-30.0346,-51.2177],
  'Salvador-BA':[-12.9777,-38.5016],'Recife-PE':[-8.0476,-34.877],'Fortaleza-CE':[-3.7319,-38.5267],
  'Manaus-AM':[-3.119,-60.0217],'Brasília-DF':[-15.7939,-47.8828],'Santos-SP':[-23.9608,-46.3336],
  'Extrema-MG':[-22.8547,-46.3182],'Goiânia-GO':[-16.6869,-49.2648],'Belém-PA':[-1.4558,-48.5039],
};

let mapInstance = null;
let focused = null;

function haversine(a,b){
  const R=6371, dLat=(b[0]-a[0])*Math.PI/180, dLng=(b[1]-a[1])*Math.PI/180;
  const s = Math.sin(dLat/2)**2 + Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLng/2)**2;
  return Math.round(2*R*Math.asin(Math.sqrt(s)));
}

export function renderTransport(){
  const d = state.data;
  const statusColor = { 'Entregue':'bg-emerald-100 text-emerald-700','Em trânsito':'bg-blue-100 text-blue-700','Aguardando coleta':'bg-amber-100 text-amber-700','Atrasado':'bg-rose-100 text-rose-700' };

  const totalCost = d.shipments.reduce((s,x)=>s+(x.cost||0),0);
  const totalKm = d.shipments.reduce((s,x)=>s+(x.distanceKm||0),0);
  const totalCo2 = d.shipments.reduce((s,x)=>{ const m=MODES[x.mode]; return s + (m? m.co2*(x.weightKg/1000)*(x.distanceKm||0):0); },0);

  const html = `
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
    <div class="card p-4"><div class="text-[11px] font-semibold text-slate-400 uppercase">Embarques</div><div class="text-2xl font-bold text-slate-800 mt-1">${d.shipments.length}</div></div>
    <div class="card p-4"><div class="text-[11px] font-semibold text-slate-400 uppercase">Frete total</div><div class="text-2xl font-bold text-slate-800 mt-1">${BRL(totalCost)}</div></div>
    <div class="card p-4"><div class="text-[11px] font-semibold text-slate-400 uppercase">Distância</div><div class="text-2xl font-bold text-slate-800 mt-1">${NUM(totalKm)}<span class="text-sm text-slate-400"> km</span></div></div>
    <div class="card p-4"><div class="text-[11px] font-semibold text-slate-400 uppercase">Emissão CO₂</div><div class="text-2xl font-bold text-slate-800 mt-1">${NUM(Math.round(totalCo2))}<span class="text-sm text-slate-400"> kg</span></div></div>
  </div>

  <div class="grid lg:grid-cols-5 gap-5">
    <div class="lg:col-span-3 space-y-5">
      <div class="card p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold text-slate-800">Mapa de rotas</h3>
          <span class="text-[11px] text-slate-400">Clique em um embarque para focar</span>
        </div>
        <div id="map" style="height:400px" class="w-full bg-slate-100"></div>
        <div class="flex flex-wrap gap-3 mt-3">
          ${Object.entries(MODES).map(([k,v])=>`<span class="flex items-center gap-1.5 text-[11px] text-slate-500"><span class="dot" style="background:${v.color}"></span>${k}</span>`).join('')}
        </div>
      </div>

      <div class="card p-5">
        <h3 class="font-bold text-slate-800 mb-3">Comparador de modais</h3>
        <p class="text-xs text-slate-400 mb-3">Estime custo, prazo e emissão para uma mesma rota.</p>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div><label class="text-xs font-semibold text-slate-500">Distância (km)</label><input id="cmp-km" type="number" class="field mt-1" value="440"></div>
          <div><label class="text-xs font-semibold text-slate-500">Peso (kg)</label><input id="cmp-kg" type="number" class="field mt-1" value="1200"></div>
        </div>
        <div id="cmp-out" class="space-y-2"></div>
      </div>
    </div>

    <div class="lg:col-span-2 space-y-4">
      <button id="btn-newship" class="btn btn-primary w-full py-2.5 text-sm"><i data-lucide="plus" class="w-4 h-4"></i> Novo embarque</button>
      <div class="space-y-3 max-h-[640px] overflow-auto pr-1">
        ${d.shipments.map(s=>{
          const m = MODES[s.mode]||MODES['Rodoviário'];
          return `<div data-ship="${s.id}" class="card p-4 cursor-pointer hover:border-brand-300 transition ${focused===s.id?'border-brand-500':''}">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg grid place-items-center text-white" style="background:${m.color}"><i data-lucide="${m.icon}" class="w-4 h-4"></i></div>
                <div><div class="font-bold text-slate-800 text-sm">${s.code}</div><div class="text-[11px] text-slate-400">${s.mode} · ${s.carrier}</div></div>
              </div>
              <span class="badge ${statusColor[s.status]||'bg-slate-100 text-slate-600'}">${s.status}</span>
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-600 mb-2">
              <span class="font-medium">${s.origin}</span>
              <i data-lucide="move-right" class="w-3.5 h-3.5 text-slate-300"></i>
              <span class="font-medium">${s.dest}</span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center">
              <div class="bg-slate-50 rounded-lg py-1.5"><div class="text-[10px] text-slate-400">Frete</div><div class="text-xs font-bold text-slate-700">${BRL(s.cost)}</div></div>
              <div class="bg-slate-50 rounded-lg py-1.5"><div class="text-[10px] text-slate-400">Distância</div><div class="text-xs font-bold text-slate-700">${NUM(s.distanceKm)} km</div></div>
              <div class="bg-slate-50 rounded-lg py-1.5"><div class="text-[10px] text-slate-400">Peso</div><div class="text-xs font-bold text-slate-700">${NUM(s.weightKg)} kg</div></div>
            </div>
            <div class="flex items-center justify-between mt-2 text-[11px] text-slate-400">
              <span>Despacho ${fmtDate(s.dispatchDate)}</span>
              <button data-del="${s.id}" class="text-rose-500 hover:text-rose-600 flex items-center gap-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>
  <div id="modal-root2"></div>`;

  setTimeout(()=>{ initMap(); bindTransport(); computeCompare(); }, 30);
  return html;
}

function initMap(){
  const el = document.getElementById('map');
  if(!el || !window.L) return;
  if(mapInstance){ mapInstance.remove(); mapInstance=null; }
  mapInstance = L.map(el, { scrollWheelZoom:false }).setView([-15.6,-47.9], 4);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution:'© OpenStreetMap © CARTO', maxZoom:18 }).addTo(mapInstance);
  const bounds = [];
  state.data.shipments.forEach(s=>{
    const m = MODES[s.mode]||MODES['Rodoviário'];
    if(!s.originCoord||!s.destCoord) return;
    L.circleMarker(s.originCoord, { radius:5, color:m.color, fillColor:m.color, fillOpacity:1, weight:2 }).addTo(mapInstance).bindTooltip(`${s.origin}`);
    L.circleMarker(s.destCoord, { radius:6, color:'#fff', fillColor:m.color, fillOpacity:1, weight:3 }).addTo(mapInstance).bindTooltip(`${s.dest} · ${s.code}`);
    const line = L.polyline([s.originCoord, s.destCoord], { color:m.color, weight: focused===s.id?4:2.5, opacity: focused&&focused!==s.id?0.25:0.8, dashArray: s.status==='Entregue'?null:'6 6' }).addTo(mapInstance);
    line.bindTooltip(`${s.code} · ${s.mode} · ${BRL(s.cost)}`);
    bounds.push(s.originCoord, s.destCoord);
  });
  if(focused){
    const s = state.data.shipments.find(x=>x.id===focused);
    if(s&&s.originCoord) mapInstance.fitBounds([s.originCoord,s.destCoord], { padding:[50,50] });
  } else if(bounds.length){ mapInstance.fitBounds(bounds, { padding:[30,30] }); }
}

function bindTransport(){
  document.querySelectorAll('[data-ship]').forEach(c=> c.addEventListener('click', ()=>{ focused = focused===c.dataset.ship? null : c.dataset.ship; initMap(); document.querySelectorAll('[data-ship]').forEach(x=> x.classList.toggle('border-brand-500', x.dataset.ship===focused)); }));
  document.querySelectorAll('[data-del]').forEach(b=> b.addEventListener('click', (e)=>{ e.stopPropagation(); state.data.shipments = state.data.shipments.filter(s=>s.id!==b.dataset.del); import('../store.js').then(m=>m.saveData()); window.__navigate('transport'); toast('Embarque removido'); }));
  document.getElementById('btn-newship')?.addEventListener('click', openNewShip);
  ['cmp-km','cmp-kg'].forEach(id=> document.getElementById(id)?.addEventListener('input', computeCompare));
}

function computeCompare(){
  const km = +document.getElementById('cmp-km')?.value||0;
  const kg = +document.getElementById('cmp-kg')?.value||0;
  const out = document.getElementById('cmp-out');
  if(!out) return;
  const rows = Object.entries(MODES).map(([name,m])=>{
    const cost = km*m.costKm*(1+ kg/20000);
    const days = Math.max(1, Math.ceil(km/(m.speed*10)));
    const co2 = m.co2*(kg/1000)*km;
    return { name, m, cost, days, co2 };
  });
  const minCost = Math.min(...rows.map(r=>r.cost));
  out.innerHTML = rows.map(r=>`
    <div class="flex items-center gap-3 p-2.5 rounded-xl ${r.cost===minCost?'bg-brand-50 border border-brand-200':'bg-slate-50'}">
      <div class="w-8 h-8 rounded-lg grid place-items-center text-white shrink-0" style="background:${r.m.color}"><i data-lucide="${r.m.icon}" class="w-4 h-4"></i></div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-semibold text-slate-700 flex items-center gap-2">${r.name} ${r.cost===minCost?'<span class="badge bg-brand-600 text-white">mais barato</span>':''}</div>
        <div class="text-[11px] text-slate-400">${r.days} dia(s) · ${NUM(Math.round(r.co2))} kg CO₂</div>
      </div>
      <div class="text-sm font-bold text-slate-800 shrink-0">${BRL(r.cost)}</div>
    </div>`).join('');
  window.__refreshIcons?.();
}

function openNewShip(){
  const root = document.getElementById('modal-root2');
  const cityOpts = Object.keys(CITIES).map(c=>`<option>${c}</option>`).join('');
  const modeOpts = Object.keys(MODES).map(m=>`<option>${m}</option>`).join('');
  root.innerHTML = `<div class="fixed inset-0 modal-bg z-50 flex items-center justify-center p-4" id="ov2">
    <div class="card w-full max-w-md p-5 max-h-[90vh] overflow-auto" onclick="event.stopPropagation()">
      <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2"><i data-lucide="truck" class="w-5 h-5 text-brand-700"></i> Novo embarque</h3>
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs font-semibold text-slate-500">Origem</label><select id="ns-o" class="field mt-1">${cityOpts}</select></div>
          <div><label class="text-xs font-semibold text-slate-500">Destino</label><select id="ns-d" class="field mt-1">${cityOpts}</select></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs font-semibold text-slate-500">Modal</label><select id="ns-m" class="field mt-1">${modeOpts}</select></div>
          <div><label class="text-xs font-semibold text-slate-500">Transportadora</label><input id="ns-c" class="field mt-1" value="TransRápido"></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs font-semibold text-slate-500">Peso (kg)</label><input id="ns-w" type="number" class="field mt-1" value="800"></div>
          <div><label class="text-xs font-semibold text-slate-500">Status</label><select id="ns-s" class="field mt-1"><option>Aguardando coleta</option><option>Em trânsito</option><option>Entregue</option><option>Atrasado</option></select></div>
        </div>
        <div id="ns-est" class="bg-slate-50 rounded-xl p-3 text-sm"></div>
      </div>
      <div class="flex gap-2 mt-5">
        <button onclick="document.getElementById('modal-root2').innerHTML=''" class="btn btn-ghost flex-1 py-2.5 text-sm">Cancelar</button>
        <button id="ns-save" class="btn btn-primary flex-1 py-2.5 text-sm">Criar embarque</button>
      </div>
    </div></div>`;
  document.getElementById('ov2').addEventListener('click', ()=> root.innerHTML='');
  const est = ()=>{
    const o=document.getElementById('ns-o').value, dd=document.getElementById('ns-d').value, mode=document.getElementById('ns-m').value, w=+document.getElementById('ns-w').value||0;
    const m=MODES[mode]; const km = haversine(CITIES[o], CITIES[dd]);
    const cost = km*m.costKm*(1+w/20000); const days=Math.max(1,Math.ceil(km/(m.speed*10)));
    document.getElementById('ns-est').innerHTML = `<div class="flex justify-between"><span class="text-slate-500">Distância</span><span class="font-semibold">${NUM(km)} km</span></div><div class="flex justify-between"><span class="text-slate-500">Frete estimado</span><span class="font-semibold text-brand-700">${BRL(cost)}</span></div><div class="flex justify-between"><span class="text-slate-500">Prazo</span><span class="font-semibold">${days} dia(s)</span></div>`;
    return { km, cost, days };
  };
  ['ns-o','ns-d','ns-m','ns-w'].forEach(id=> document.getElementById(id).addEventListener('input', est));
  document.getElementById('ns-d').selectedIndex=2; est();
  document.getElementById('ns-save').addEventListener('click', ()=>{
    const o=document.getElementById('ns-o').value, dd=document.getElementById('ns-d').value;
    if(o===dd){ toast('Origem e destino iguais','warn'); return; }
    const e=est(); const n = state.data.shipments.length+1;
    state.data.shipments.push({ id:uid(), code:'SHP-'+(1000+n), mode:document.getElementById('ns-m').value, carrier:document.getElementById('ns-c').value.trim()||'—', origin:o, dest:dd, originCoord:CITIES[o], destCoord:CITIES[dd], status:document.getElementById('ns-s').value, cost:Math.round(e.cost), weightKg:+document.getElementById('ns-w').value||0, distanceKm:e.km, etaDays:e.days, dispatchDate:todayISO() });
    import('../store.js').then(m=>m.saveData());
    root.innerHTML=''; window.__navigate('transport'); toast('Embarque criado');
  });
  window.__refreshIcons?.();
}
