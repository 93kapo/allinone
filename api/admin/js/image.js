// Prepara una foto en el teléfono: corrige la orientación, la achica y la guarda como JPEG nuevo
// (al redibujarla se pierden los datos EXIF/GPS).
import { PHOTO_MAX, THUMB_MAX, JPEG_QUALITY, fitWithin } from './lib/imagesize.js';

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
export { PhotoError };
