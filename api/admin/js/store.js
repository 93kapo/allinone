// Estado de trabajo (borrador), comparación con lo publicado y respaldo en IndexedDB.
const SOCIALS = ['facebook', 'instagram', 'google', 'youtube', 'tiktok'];
const pair = (p) => ({ es: (p && typeof p.es === 'string' ? p.es : ''), en: (p && typeof p.en === 'string' ? p.en : '') });

function normItem(it) {
  const o = { id: it.id, type: it.type, category: it.category || '', caption: pair(it.caption), alt: pair(it.alt), hidden: it.hidden === true };
  for (const k of ['src', 'youtubeId', 'poster']) if (typeof it[k] === 'string' && it[k]) o[k] = it[k];
  for (const k of ['w', 'h']) if (Number.isInteger(it[k])) o[k] = it[k];
  return o;
}

export function normalize(c) {
  const s = (c && c.settings) || {};
  const social = {};
  for (const n of SOCIALS) social[n] = (s.social && typeof s.social[n] === 'string') ? s.social[n] : '';
  return {
    settings: { email: typeof s.email === 'string' ? s.email : '', social, showLicensed: s.showLicensed === true, licenseNumber: typeof s.licenseNumber === 'string' ? s.licenseNumber : '' },
    gallery: ((c && c.gallery) || []).map(normItem),
    beforeAfter: ((c && c.beforeAfter) || []).map((b) => ({ id: b.id, before: b.before || '', after: b.after || '', caption: pair(b.caption), alt: pair(b.alt), hidden: b.hidden === true })),
    reviews: ((c && c.reviews) || []).map((r) => ({ id: r.id, name: r.name || '', text: pair(r.text), source: r.source || '', date: r.date || '', hidden: r.hidden === true })),
  };
}

const clone = (o) => JSON.parse(JSON.stringify(o));

export const S = { email: '', baseVersion: 'none', isFirst: false, base: null, state: null, listeners: new Set() };

// Carga lo publicado (o el contenido inicial) como base y como borrador.
export function setBase(content, { first = false, version } = {}) {
  S.base = normalize(content);
  S.state = clone(S.base);
  S.isFirst = first;
  S.baseVersion = first ? 'none' : (version || content.version || 'none');
  notify();
}
export function useDraft(state, baseVersion) { S.state = normalize(state); S.baseVersion = baseVersion; notify(); }
export function rebaseDraft(version) { S.baseVersion = version; S.isFirst = false; notify(); }

export const isDirty = () => !!S.state && JSON.stringify(S.state) !== JSON.stringify(S.base);
export function notify() { for (const f of S.listeners) { try { f(); } catch { /* nada */ } } }
export function set(section, value) { S.state[section] = value; touch(); }
let timer = 0;
export function touch() {
  notify();
  clearTimeout(timer);
  timer = setTimeout(saveNow, 400);
}
export function saveNow() { clearTimeout(timer); return isDirty() ? saveDraft() : clearDraft(); }

// ---- IndexedDB (todo en try/catch: si falla, el panel sigue funcionando sin respaldo) ----
const DB = 'allin1-panel', STORE = 'kv', KEY = 'draft';
function open() {
  return new Promise((resolve) => {
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => { try { rq.result.createObjectStore(STORE); } catch { /* nada */ } };
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => resolve(null);
      rq.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function run(mode, fn) {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const rq = fn(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(rq && 'result' in rq ? rq.result : true); };
      tx.onerror = tx.onabort = () => { try { db.close(); } catch { /* nada */ } resolve(null); };
    } catch { try { db.close(); } catch { /* nada */ } resolve(null); }
  });
}
export async function saveDraft() {
  if (!S.state) return false;
  const rec = { email: S.email, baseVersion: S.baseVersion, savedAt: Date.now(), state: S.state };
  return !!(await run('readwrite', (st) => st.put(rec, KEY)));
}
export async function loadDraft() {
  const r = await run('readonly', (st) => st.get(KEY));
  if (!r || typeof r !== 'object' || !r.state || r.email !== S.email) return null;
  return r;
}
export async function clearDraft() { return !!(await run('readwrite', (st) => st.delete(KEY))); }
