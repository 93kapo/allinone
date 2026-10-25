// Versiones del contenido: guardar (con control de concurrencia), listar, resumir y podar.
import { KEYS, VERSION_RE, getJSON, putJSON, randomSuffix } from './r2.js';
import { collectMediaKeys } from './schema.js';
import { markUsed } from './media.js';

export const KEEP_VERSIONS = 50;
const SECTIONS = ['gallery', 'beforeAfter', 'reviews'];

export function newVersion(now) {
  return `${now.toISOString()}-${randomSuffix(6)}`;
}

// Conteos de añadidos / quitados / modificados por sección (por id).
export function summarize(prev, next) {
  const out = { settings: prev ? JSON.stringify(prev.settings) !== JSON.stringify(next.settings) : true };
  for (const s of SECTIONS) {
    const a = new Map(((prev && prev[s]) || []).map((x) => [x.id, JSON.stringify(x)]));
    const b = new Map((next[s] || []).map((x) => [x.id, JSON.stringify(x)]));
    let added = 0, removed = 0, modified = 0;
    for (const [id, v] of b) { if (!a.has(id)) added++; else if (a.get(id) !== v) modified++; }
    for (const id of a.keys()) if (!b.has(id)) removed++;
    const common = [...b.keys()].filter((id) => a.has(id));
    const reordered = common.join() !== [...a.keys()].filter((id) => b.has(id)).join();
    out[s] = { added, removed, modified, reordered };
  }
  return out;
}

async function listAllVersions(bucket) {
  const objects = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix: KEYS.versionPrefix, cursor, include: ['customMetadata'] });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects
    .map((o) => ({ ...o, version: o.key.slice(KEYS.versionPrefix.length, -'.json'.length) }))
    .filter((o) => VERSION_RE.test(o.version))
    .sort((x, y) => (x.version < y.version ? 1 : -1)); // más recientes primero
}

export async function listHistory(env) {
  const [all, { data: cur }] = await Promise.all([listAllVersions(env.MEDIA), getJSON(env.MEDIA, KEYS.current)]);
  return all.map((o) => {
    const m = o.customMetadata || {};
    let resumen = null;
    try { resumen = m.summary ? JSON.parse(m.summary) : null; } catch { resumen = null; }
    const e = { version: o.version, updatedAt: m.updatedAt || null, updatedBy: m.updatedBy || null, resumen, actual: !!cur && cur.version === o.version };
    if (m.restoredFrom) e.restauradaDe = m.restoredFrom;
    return e;
  });
}

async function prune(bucket) {
  const all = await listAllVersions(bucket);
  const old = all.slice(KEEP_VERSIONS);
  if (old.length) await bucket.delete(old.map((o) => o.key));
}

// Guarda una versión NUEVA. ifMatch: versión esperada, 'none', o null (restaurar: sin condición).
// Devuelve { ok:true, content } o { conflict:true, current }.
export async function commitContent(env, body, { email, now, ifMatch = null, restoredFrom = null }) {
  const bucket = env.MEDIA;
  for (let attempt = 0; attempt < 6; attempt++) {
    const cur = await bucket.get(KEYS.current);
    const prev = cur ? await cur.json() : null;
    const curVersion = prev && prev.version ? prev.version : 'none';
    if (ifMatch !== null && ifMatch !== curVersion) return { conflict: true, current: curVersion };

    const version = newVersion(now);
    const content = {
      schemaVersion: 1,
      version,
      updatedAt: now.toISOString(),
      updatedBy: email,
      settings: body.settings,
      gallery: body.gallery,
      beforeAfter: body.beforeAfter,
      reviews: body.reviews,
    };
    const meta = { updatedAt: content.updatedAt, updatedBy: email, summary: JSON.stringify(summarize(prev, content)) };
    if (restoredFrom) meta.restoredFrom = restoredFrom;

    await putJSON(bucket, KEYS.version(version), content, { customMetadata: meta });
    const ok = await putJSON(bucket, KEYS.current, content, {
      onlyIf: cur ? { etagMatches: cur.etag } : { etagDoesNotMatch: '*' },
    });
    if (!ok) { await bucket.delete(KEYS.version(version)); continue; } // alguien se adelantó: reintenta/compara

    try { await markUsed(env, collectMediaKeys(content)); } catch { /* mejor esfuerzo */ }
    try { await prune(bucket); } catch { /* la poda se reintenta en el siguiente guardado */ }
    return { ok: true, content };
  }
  throw new Error('commit-agotado');
}
