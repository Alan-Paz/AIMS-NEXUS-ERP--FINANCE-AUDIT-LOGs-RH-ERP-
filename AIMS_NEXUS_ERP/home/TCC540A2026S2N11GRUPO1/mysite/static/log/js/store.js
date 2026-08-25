import { uid, generateEAN13, todayISO } from './utils.js';

// Central data store. Backed by Puter KV when signed in, else in-memory (demo).
const KEY = 'logiflow_data_v1';

export const state = {
  signedIn: false,
  user: null,
  data: null,
};

function seed(){
  const now = todayISO();
  const d = (offset)=> { const t=new Date(); t.setDate(t.getDate()+offset); return t.toISOString().slice(0,10); };
  return {
    products: [
      { id:uid(), sku:'FRM-AMOX-500', name:'Amoxicilina 500mg (cx 24)', category:'Farmacêutico', unit:'cx', ean:generateEAN13(), unitCost:38.90, perishable:true },
      { id:uid(), sku:'ALM-ARROZ-5', name:'Arroz Tipo 1 5kg', category:'Alimentos', unit:'fardo', ean:generateEAN13(), unitCost:24.50, perishable:true },
      { id:uid(), sku:'ELE-SSD-1TB', name:'SSD NVMe 1TB', category:'Eletrônicos', unit:'un', ean:generateEAN13(), unitCost:410.00, perishable:false },
      { id:uid(), sku:'BEB-VINHO-750', name:'Vinho Tinto Reserva 750ml', category:'Bebidas', unit:'cx', ean:generateEAN13(), unitCost:89.00, perishable:true },
    ],
    warehouses:[
      { id:uid(), name:'CD Guarulhos', city:'Guarulhos-SP', lat:-23.4543, lng:-46.5337 },
      { id:uid(), name:'CD Extrema', city:'Extrema-MG', lat:-22.8547, lng:-46.3182 },
    ],
    // lots feed inventory movements
    lots: [],
    movements: [], // {id, productId, type:'in'|'out', qty, unitCost, date, expiry, lotId, warehouseId, ref}
    shipments: [], // {id, code, mode, origin, dest, originCoord, destCoord, carrier, status, cost, weightKg, distanceKm, etaDays, dispatchDate}
    audits: [], // saved AI ISO42001 analyses
  };
}

export async function loadData(){
  if(state.signedIn){
    try{
      const raw = await puter.kv.get(KEY);
      if(raw){ state.data = JSON.parse(raw); ensureShape(); return; }
    }catch(e){ console.warn('kv load failed', e); }
    state.data = withSampleLots(seed());
    await saveData();
  } else {
    state.data = withSampleLots(seed());
  }
}

function ensureShape(){
  const d = state.data;
  ['products','warehouses','lots','movements','shipments','audits'].forEach(k=>{ if(!Array.isArray(d[k])) d[k]=[]; });
}

function withSampleLots(d){
  const w0 = d.warehouses[0].id, w1 = d.warehouses[1].id;
  const day = (o)=>{ const t=new Date(); t.setDate(t.getDate()+o); return t.toISOString().slice(0,10); };
  const add = (productId, qty, unitCost, dateOff, expiryOff, wh)=>{
    const lotId = uid();
    d.lots.push({ id:lotId, productId, qtyInitial:qty, unitCost, date:day(dateOff), expiry: expiryOff!=null? day(expiryOff):null, warehouseId:wh });
    d.movements.push({ id:uid(), productId, type:'in', qty, unitCost, date:day(dateOff), expiry: expiryOff!=null? day(expiryOff):null, lotId, warehouseId:wh, ref:'Compra inicial' });
  };
  const P = d.products;
  add(P[0].id, 120, 38.90, -40, 25, w0);
  add(P[0].id, 90, 40.10, -12, 8, w0);   // near expiry -> FEFO priority
  add(P[1].id, 300, 24.50, -30, 60, w1);
  add(P[1].id, 200, 23.80, -5, 120, w1);
  add(P[2].id, 60, 410.00, -20, null, w0);
  add(P[2].id, 40, 398.00, -3, null, w0);
  add(P[3].id, 80, 89.00, -60, 400, w1);
  // a couple of outs
  d.movements.push({ id:uid(), productId:P[2].id, type:'out', qty:15, date:day(-1), warehouseId:w0, ref:'Pedido #1042', method:'FIFO' });
  d.movements.push({ id:uid(), productId:P[0].id, type:'out', qty:30, date:day(-2), warehouseId:w0, ref:'Pedido #1039', method:'FEFO' });

  d.shipments.push({ id:uid(), code:'SHP-1001', mode:'Rodoviário', carrier:'TransRápido', origin:'Guarulhos-SP', dest:'Rio de Janeiro-RJ', originCoord:[-23.4543,-46.5337], destCoord:[-22.9068,-43.1729], status:'Em trânsito', cost:2450, weightKg:1200, distanceKm:440, etaDays:1, dispatchDate:day(-1) });
  d.shipments.push({ id:uid(), code:'SHP-1002', mode:'Aéreo', carrier:'AeroCargo', origin:'Guarulhos-SP', dest:'Manaus-AM', originCoord:[-23.4356,-46.4731], destCoord:[-3.0386,-60.0497], status:'Entregue', cost:9800, weightKg:320, distanceKm:2680, etaDays:1, dispatchDate:day(-6) });
  d.shipments.push({ id:uid(), code:'SHP-1003', mode:'Ferroviário', carrier:'RailBR', origin:'Extrema-MG', dest:'Santos-SP', originCoord:[-22.8547,-46.3182], destCoord:[-23.9608,-46.3336], status:'Aguardando coleta', cost:1780, weightKg:5400, distanceKm:210, etaDays:2, dispatchDate:day(1) });
  return d;
}

let saveTimer=null;
export function saveData(){
  return new Promise((resolve)=>{
    if(!state.signedIn){ resolve(); return; }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async ()=>{
      try{ await puter.kv.set(KEY, JSON.stringify(state.data)); }
      catch(e){ console.warn('save failed', e); }
      resolve();
    }, 300);
  });
}

// ===== Inventory engine (FIFO / FEFO / LIFO) =====
export function lotsForProduct(productId, warehouseId=null){
  return state.data.lots
    .filter(l=> l.productId===productId && (warehouseId? l.warehouseId===warehouseId : true))
    .map(l=> ({ ...l, remaining: remainingOfLot(l) }))
    .filter(l=> l.remaining > 0.0001);
}

export function remainingOfLot(lot){
  const outs = state.data.movements
    .filter(m=> m.type==='out' && m.consumed && m.consumed.some(c=>c.lotId===lot.id))
    .reduce((s,m)=> s + m.consumed.filter(c=>c.lotId===lot.id).reduce((a,c)=>a+c.qty,0), 0);
  return lot.qtyInitial - outs;
}

export function orderLots(lots, method){
  const arr = [...lots];
  if(method==='FIFO') arr.sort((a,b)=> a.date.localeCompare(b.date));
  else if(method==='LIFO') arr.sort((a,b)=> b.date.localeCompare(a.date));
  else if(method==='FEFO') arr.sort((a,b)=>{
    if(a.expiry && b.expiry) return a.expiry.localeCompare(b.expiry);
    if(a.expiry) return -1; if(b.expiry) return 1;
    return a.date.localeCompare(b.date);
  });
  return arr;
}

// simulate a picking without committing; returns {consumed:[{lotId,qty,unitCost}], totalCost, shortfall}
export function simulatePick(productId, qty, method, warehouseId=null){
  const lots = orderLots(lotsForProduct(productId, warehouseId), method);
  let need = qty; const consumed=[]; let totalCost=0;
  for(const lot of lots){
    if(need<=0.0001) break;
    const take = Math.min(lot.remaining, need);
    consumed.push({ lotId:lot.id, qty:take, unitCost:lot.unitCost, date:lot.date, expiry:lot.expiry });
    totalCost += take*lot.unitCost; need -= take;
  }
  return { consumed, totalCost, shortfall: Math.max(0,need) };
}

export function stockLevel(productId, warehouseId=null){
  return lotsForProduct(productId, warehouseId).reduce((s,l)=> s + l.remaining, 0);
}
export function stockValue(productId, warehouseId=null){
  return lotsForProduct(productId, warehouseId).reduce((s,l)=> s + l.remaining*l.unitCost, 0);
}

export function addStock({ productId, qty, unitCost, date, expiry, warehouseId, ref }){
  const lotId = uid();
  state.data.lots.push({ id:lotId, productId, qtyInitial:+qty, unitCost:+unitCost, date, expiry:expiry||null, warehouseId });
  state.data.movements.push({ id:uid(), productId, type:'in', qty:+qty, unitCost:+unitCost, date, expiry:expiry||null, lotId, warehouseId, ref:ref||'Entrada' });
  saveData();
  return lotId;
}

export function removeStock({ productId, qty, method, warehouseId, ref }){
  const sim = simulatePick(productId, +qty, method, warehouseId);
  if(sim.shortfall>0) return { ok:false, shortfall:sim.shortfall };
  state.data.movements.push({ id:uid(), productId, type:'out', qty:+qty, date:todayISO(), warehouseId, ref:ref||'Saída', method, consumed:sim.consumed, totalCost:sim.totalCost });
  saveData();
  return { ok:true, ...sim };
}

export function productById(id){ return state.data.products.find(p=>p.id===id); }
export function warehouseById(id){ return state.data.warehouses.find(w=>w.id===id); }
