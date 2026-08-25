// Estado global + persistência (Puter KV com fallback local)
import { seedProdutos, seedMovimentos, seedFinanceiro, seedNotas, seedNotas as _n, EMPRESA_DEFAULT } from './data.js';

const KEY = 'nexuserp_state_v1';
let puterReady = false;
try { puterReady = typeof puter !== 'undefined'; } catch(e){ puterReady = false; }

const listeners = new Set();
export function subscribe(fn){ listeners.add(fn); return ()=>listeners.delete(fn); }
function emit(){ listeners.forEach(fn=>fn(state)); }

export let state = defaultState();

function defaultState(){
  return {
    empresa: { ...EMPRESA_DEFAULT },
    produtos: seedProdutos(),
    movimentos: seedMovimentos(),
    financeiro: seedFinanceiro(),
    notas: seedNotas(),
    aiHistory: [],
    modalConfig: { origem:'São Paulo - SP', destino:'Rio de Janeiro - RJ', distancia:430, peso:1200 }
  };
}

export async function loadState(){
  // Local first (fast)
  try {
    const raw = localStorage.getItem(KEY);
    if(raw){ state = { ...defaultState(), ...JSON.parse(raw) }; }
  } catch(e){}
  // Puter KV (if signed in)
  try {
    if(puterReady && puter.auth && await puter.auth.isSignedIn()){
      const remote = await puter.kv.get(KEY);
      if(remote){ state = { ...defaultState(), ...(typeof remote==='string'? JSON.parse(remote):remote) }; }
    }
  } catch(e){}
  emit();
  return state;
}

let saveTimer;
export function persist(){
  emit();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e){}
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async ()=>{
    try {
      if(puterReady && puter.auth && await puter.auth.isSignedIn()){
        await puter.kv.set(KEY, JSON.stringify(state));
      }
    } catch(e){}
  }, 600);
}

export function setState(mutator){
  mutator(state);
  persist();
}

export function resetState(){
  state = defaultState();
  persist();
}
