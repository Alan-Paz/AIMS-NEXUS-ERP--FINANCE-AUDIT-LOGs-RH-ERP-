// Global state + persistence via Puter KV (per-user) with localStorage fallback
export const state = {
  user: null,
  signedIn: false,
  view: 'dashboard',
  sheet: null,        // current spreadsheet { name, cols, rows:[[...]], meta }
  audits: [],         // saved audit records
  activeAudit: null,  // audit result currently displayed
  analyzing: false,
};

const KV_AUDITS = 'auditia:audits:v1';

export async function loadAudits() {
  try {
    if (state.signedIn && window.puter) {
      const raw = await puter.kv.get(KV_AUDITS);
      state.audits = raw ? JSON.parse(raw) : [];
    } else {
      const raw = localStorage.getItem(KV_AUDITS);
      state.audits = raw ? JSON.parse(raw) : [];
    }
  } catch (e) {
    state.audits = [];
  }
  return state.audits;
}

export async function saveAudits() {
  const data = JSON.stringify(state.audits);
  try {
    if (state.signedIn && window.puter) {
      await puter.kv.set(KV_AUDITS, data);
    }
  } catch (e) { /* ignore */ }
  try { localStorage.setItem(KV_AUDITS, data); } catch (e) {}
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
