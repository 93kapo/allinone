// Cuotas por usuario y día (UTC), guardadas como objetos content/quota/<hash-correo>/<fecha>.json.
import { KEYS, casUpdate, getJSON, sha256Hex } from './r2.js';

const MB = 1024 * 1024;

export function limitsFrom(env) {
  const files = Number(env.QUOTA_FILES_PER_DAY) > 0 ? Number(env.QUOTA_FILES_PER_DAY) : 40;
  const mb = Number(env.QUOTA_MB_PER_DAY) > 0 ? Number(env.QUOTA_MB_PER_DAY) : 80;
  const videos = Number(env.QUOTA_VIDEOS_PER_DAY) > 0 ? Number(env.QUOTA_VIDEOS_PER_DAY) : 5;
  const vmb = Number(env.QUOTA_VIDEO_MB_PER_DAY) > 0 ? Number(env.QUOTA_VIDEO_MB_PER_DAY) : 500;
  return { files, bytes: mb * MB, mb, videos, vbytes: vmb * MB, vmb };
}

export const dayKey = (now) => now.toISOString().slice(0, 10);

async function keyFor(email, now) {
  return KEYS.quota((await sha256Hex(email)).slice(0, 32), dayKey(now));
}

export async function getUsage(env, email, now) {
  const { data } = await getJSON(env.MEDIA, await keyFor(email, now));
  return { files: data?.files | 0, bytes: data?.bytes | 0, videos: data?.videos | 0, vbytes: data?.vbytes | 0 };
}

export async function remaining(env, email, now) {
  const lim = limitsFrom(env);
  const u = await getUsage(env, email, now);
  return {
    fecha: dayKey(now),
    archivosPorDia: lim.files,
    mbPorDia: lim.mb,
    archivosRestantes: Math.max(0, lim.files - u.files),
    bytesRestantes: Math.max(0, lim.bytes - u.bytes),
    videosPorDia: lim.videos,
    videosRestantes: Math.max(0, lim.videos - u.videos),
    bytesVideoRestantes: Math.max(0, lim.vbytes - u.vbytes),
  };
}

// Reserva atómica. Devuelve { ok:true } o { ok:false, motivo:'archivos'|'espacio' }.
export async function reserve(env, email, size, now) {
  const lim = limitsFrom(env);
  const key = await keyFor(email, now);
  const r = await casUpdate(env.MEDIA, key, (cur) => {
    const u = { files: cur?.files | 0, bytes: cur?.bytes | 0 };
    if (u.files + 1 > lim.files) return { abort: 'archivos' };
    if (u.bytes + size > lim.bytes) return { abort: 'espacio' };
    return { write: { ...(cur || {}), files: u.files + 1, bytes: u.bytes + size }, result: true };
  });
  return r.aborted ? { ok: false, motivo: r.value } : { ok: true };
}

// Cuota aparte para videos (no gasta la de fotos). `size` = bytes declarados.
export async function reserveVideo(env, email, size, now) {
  const lim = limitsFrom(env);
  const key = await keyFor(email, now);
  const r = await casUpdate(env.MEDIA, key, (cur) => {
    const u = { ...(cur || {}), videos: cur?.videos | 0, vbytes: cur?.vbytes | 0 };
    if (u.videos + 1 > lim.videos) return { abort: 'videos' };
    if (u.vbytes + size > lim.vbytes) return { abort: 'espacio-video' };
    return { write: { ...u, videos: u.videos + 1, vbytes: u.vbytes + size }, result: true };
  });
  return r.aborted ? { ok: false, motivo: r.value } : { ok: true };
}

// Devuelve la reserva si la subida falló.
export async function refundVideo(env, email, size, now) {
  const key = await keyFor(email, now);
  await casUpdate(env.MEDIA, key, (cur) => (cur ? { write: { ...cur, videos: Math.max(0, (cur.videos | 0) - 1), vbytes: Math.max(0, (cur.vbytes | 0) - size) }, result: true } : { abort: 'nada' }));
}

export function quotaMessage(motivo, env) {
  const lim = limitsFrom(env);
  if (motivo === 'videos') return `Llegaste al límite de ${lim.videos} videos por hoy. Intenta mañana.`;
  if (motivo === 'espacio-video') return `Llegaste al límite de ${lim.vmb} MB de video por hoy. Intenta mañana.`;
  return motivo === 'archivos'
    ? `Llegaste al límite de ${lim.files} archivos por hoy. Intenta mañana.`
    : `Llegaste al límite de ${lim.mb} MB por hoy. Intenta mañana.`;
}
