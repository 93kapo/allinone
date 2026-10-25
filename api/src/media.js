// Subidas: detección por firma, manifiesto de medios y limpieza de huérfanos (función pura, v2).
import { KEYS, casUpdate, getJSON } from './r2.js';

// El plan gratis de Cloudflare limita el cuerpo de una petición a 100 MB: el video queda un poco debajo.
export const MAX_BYTES = { photo: 8 * 1024 * 1024, thumb: 1024 * 1024, poster: 2 * 1024 * 1024, video: 95 * 1024 * 1024 };
export const VIDEO_KINDS = new Set(['video']);
export const IMAGE_KINDS = new Set(['photo', 'thumb', 'poster']);

const startsWith = (b, sig, off = 0) => sig.every((v, i) => b[off + i] === v);

// Solo JPEG, PNG y WebP, por los primeros bytes. El Content-Type que diga el cliente se ignora.
export function sniffImage(b) {
  if (b.length >= 3 && startsWith(b, [0xff, 0xd8, 0xff])) return { ext: 'jpg', type: 'image/jpeg' };
  if (b.length >= 8 && startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: 'png', type: 'image/png' };
  if (b.length >= 12 && startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return { ext: 'webp', type: 'image/webp' };
  return null;
}

// Video MP4/MOV (caja 'ftyp' en los bytes 4-8 con una marca conocida) o WebM (cabecera EBML).
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'iso7', 'iso8', 'iso9', 'mp41', 'mp42', 'avc1', 'M4V ', 'M4VH', 'M4VP', 'hvc1', 'hev1', 'dash', 'MSNV', 'f4v ']);
export function sniffVideo(b) {
  if (b.length >= 12 && startsWith(b, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === 'qt  ') return { ext: 'mov', type: 'video/quicktime' };
    if (MP4_BRANDS.has(brand)) return { ext: 'mp4', type: 'video/mp4' };
    return null;
  }
  if (b.length >= 4 && startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return { ext: 'webm', type: 'video/webm' };
  return null;
}

export const mediaKeyFor = (uuid, kind, ext) => (kind === 'thumb' ? `media/${uuid}-t.${ext}` : kind === 'poster' ? `media/${uuid}-p.${ext}` : `media/${uuid}.${ext}`);

export async function loadManifest(env) {
  const { data } = await getJSON(env.MEDIA, KEYS.manifest);
  return data && Array.isArray(data.items) ? data.items : [];
}

export async function mediaKeySet(env) {
  return new Set((await loadManifest(env)).map((i) => i.key));
}

export function maxBucketBytes(env) {
  const mb = Number(env.MAX_BUCKET_MB) > 0 ? Number(env.MAX_BUCKET_MB) : 8000;
  return mb * 1024 * 1024;
}

export async function manifestTotal(env) {
  return (await loadManifest(env)).reduce((n, i) => n + (i.size | 0), 0);
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
