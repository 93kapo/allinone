// Prepara una foto en el teléfono: corrige la orientación, la achica y la guarda como JPEG nuevo
// (al redibujarla se pierden los datos EXIF/GPS).
import { PHOTO_MAX, THUMB_MAX, JPEG_QUALITY, fitWithin } from './lib/imagesize.js';
import { POSTER_MAX } from './lib/video.js';

class PhotoError extends Error { constructor(code) { super(code); this.code = code; } }

async function decode(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { src: bmp, w: bmp.width, h: bmp.height, done: () => { try { bmp.close(); } catch { /* nada */ } } };
  } catch { /* respaldo con <img> */ }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    const heic = /hei[cf]/i.test(file.type || '') || /\.hei[cf]$/i.test(file.name || '');
    throw new PhotoError(heic ? 'heic' : 'decode');
  }
}

function toJpeg(src, w, h) {
  return new Promise((resolve, reject) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (!g) { reject(new PhotoError('jpeg')); return; }
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); // fondo blanco por si la foto tiene transparencia
    g.drawImage(src, 0, 0, w, h);
    c.toBlob((b) => {
      c.width = c.height = 0;
      if (b && b.type === 'image/jpeg') resolve(b); else reject(new PhotoError('jpeg'));
    }, 'image/jpeg', JPEG_QUALITY);
  });
}

// -> { main:{blob,w,h}, thumb:{blob}|null }
export async function prepareImage(file, { withThumb = true } = {}) {
  const d = await decode(file);
  try {
    if (!(d.w >= 1 && d.h >= 1)) throw new PhotoError('decode');
    const m = fitWithin(d.w, d.h, PHOTO_MAX);
    const main = { blob: await toJpeg(d.src, m.w, m.h), w: m.w, h: m.h };
    let thumb = null;
    if (withThumb) { const s = fitWithin(d.w, d.h, THUMB_MAX); thumb = { blob: await toJpeg(d.src, s.w, s.h) }; }
    return { main, thumb };
  } finally { d.done(); }
}

// Cartel (poster) de un video: un fotograma como JPEG de 1280 px. El video se lee directo del archivo (no se carga entero).
// -> { blob, w, h, vw, vh } con vw/vh = medidas del video (para el item). Lanza PhotoError('poster') si el navegador no puede.
export async function videoPoster(file) {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
  const once = (ev, ms) => new Promise((res, rej) => {
    const to = setTimeout(() => { cleanup(); rej(new PhotoError('poster')); }, ms);
    const ok = () => { cleanup(); res(); };
    const bad = () => { cleanup(); rej(new PhotoError('poster')); };
    const cleanup = () => { clearTimeout(to); v.removeEventListener(ev, ok); v.removeEventListener('error', bad); };
    v.addEventListener(ev, ok); v.addEventListener('error', bad);
  });
  try {
    v.src = url;
    await once('loadeddata', 20000);
    if (!(v.videoWidth >= 1 && v.videoHeight >= 1)) throw new PhotoError('poster');
    const at = Number.isFinite(v.duration) && v.duration > 0 ? Math.min(1, v.duration / 2) : 0;
    if (at > 0) { const seeked = once('seeked', 20000); v.currentTime = at; await seeked; }
    const m = fitWithin(v.videoWidth, v.videoHeight, POSTER_MAX);
    const blob = await toJpeg(v, m.w, m.h);
    const full = fitWithin(v.videoWidth, v.videoHeight, 4000);
    return { blob, w: m.w, h: m.h, vw: full.w, vh: full.h };
  } catch (e) {
    throw e instanceof PhotoError ? e : new PhotoError('poster');
  } finally { v.removeAttribute('src'); try { v.load(); } catch { /* nada */ } URL.revokeObjectURL(url); }
}
export { PhotoError };
