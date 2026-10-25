// Subidas: detección por firma, manifiesto de medios y limpieza de huérfanos (función pura, v2).
import { KEYS, casUpdate, getJSON } from './r2.js';

export const MAX_BYTES = { photo: 8 * 1024 * 1024, thumb: 1024 * 1024 };

const startsWith = (b, sig, off = 0) => sig.every((v, i) => b[off + i] === v);

// Solo JPEG, PNG y WebP, por los primeros bytes. El Content-Type que diga el cliente se ignora.
export function sniffImage(b) {
  if (b.length >= 3 && startsWith(b, [0xff, 0xd8, 0xff])) return { ext: 'jpg', type: 'image/jpeg' };
  if (b.length >= 8 && startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: 'png', type: 'image/png' };
  if (b.length >= 12 && startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return { ext: 'webp', type: 'image/webp' };
  return null;
}

export const mediaKeyFor = (uuid, kind, ext) => (kind === 'thumb' ? `media/${uuid}-t.${ext}` : `media/${uuid}.${ext}`);

export async function loadManifest(env) {
  const { data } = await getJSON(env.MEDIA, KEYS.manifest);
  return data && Array.isArray(data.items) ? data.items : [];
}

export async function mediaKeySet(env) {
  return new Set((await loadManifest(env)).map((i) => i.key));
}

export function maxBucketBytes(env) {
  const mb = Number(env.MAX_BUCKET_MB) > 0 ? Number(env.MAX_BUCKET_MB) : 4000;
  return mb * 1024 * 1024;
}

// Agrega una entrada si cabe en el tope del bucket. { ok:false } si no cabe.
export async function addToManifest(env, entry) {
  const cap = maxBucketBytes(env);
  const r = await casUpdate(env.MEDIA, KEYS.manifest, (cur) => {
    const items = cur && Array.isArray(cur.items) ? cur.items : [];
    const total = items.reduce((s, i) => s + (i.size | 0), 0);
    if (total + entry.size > cap) return { abort: 'lleno' };
    return { write: { items: [...items, entry] }, result: true };
  });
  return { ok: !r.aborted };
}

// Marca como usadas (de forma permanente: también protege lo que está en el historial).
export async function markUsed(env, keys) {
  const want = new Set(keys);
  if (!want.size) return;
  await casUpdate(env.MEDIA, KEYS.manifest, (cur) => {
    const items = cur && Array.isArray(cur.items) ? cur.items : [];
    let changed = false;
    const next = items.map((i) => {
      if (want.has(i.key) && !i.used) { changed = true; return { ...i, used: true }; }
      return i;
    });
    return changed ? { write: { items: next }, result: true } : { abort: 'sin-cambios' };
  });
}

// v2 (NO se usa en v1, no hay endpoint de borrado): claves huérfanas = nunca usadas y con más de `days` días.
export function findOrphans(items, now, days = 30) {
  const limit = now.getTime() - days * 86_400_000;
  return items.filter((i) => i.used !== true && Date.parse(i.at) < limit).map((i) => i.key);
}
