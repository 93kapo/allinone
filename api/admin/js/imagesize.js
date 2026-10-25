// Tamaños para preparar las fotos en el teléfono.
export const PHOTO_MAX = 1600;
export const THUMB_MAX = 480;
export const JPEG_QUALITY = 0.82;

// Ajusta (w,h) para que el lado largo no pase de `max`. Nunca agranda. Enteros >= 1.
export function fitWithin(w, h, max) {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) throw new RangeError('tamaño inválido');
  const long = Math.max(w, h);
  if (long <= max) return { w: Math.round(w), h: Math.round(h) };
  const k = max / long;
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
