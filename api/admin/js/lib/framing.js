// Encuadre de fotos: punto focal, acercamiento y forma del marco. Funciones puras.
// frameStyle() da EXACTAMENTE los valores CSS que aplica el sitio (web/assets/js/content.js).
export const SHAPES = ['wide', 'tall', 'square'];
export const ASPECT = { wide: 4 / 3, tall: 3 / 4, square: 1 };
export const DEFAULT_FOCUS = { x: 50, y: 50 };
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export function normFocus(f) {
  if (!f || typeof f.x !== 'number' || typeof f.y !== 'number' || !Number.isFinite(f.x) || !Number.isFinite(f.y)) return { ...DEFAULT_FOCUS };
  return { x: clamp(Math.round(f.x), 0, 100), y: clamp(Math.round(f.y), 0, 100) };
}
export function normZoom(z) { return typeof z === 'number' && Number.isFinite(z) ? Math.round(clamp(z, ZOOM_MIN, ZOOM_MAX) * 100) / 100 : 1; }

export function frameStyle(focus, zoom) {
  const f = normFocus(focus), z = typeof zoom === 'number' && zoom >= ZOOM_MIN && zoom <= ZOOM_MAX ? normZoom(zoom) : 1, p = `${f.x}% ${f.y}%`;
  return { objectPosition: p, transformOrigin: p, transform: z === 1 ? 'none' : `scale(${z})` };
}

const portrait = (d) => d && d.h > d.w * 1.1;
const squarish = (d) => d && Math.abs(d.w / d.h - 1) <= 0.1;
// dims: medidas reales de las fotos. Las dos verticales -> 'tall'; las dos casi cuadradas -> 'square'; si no 'wide'.
export function recommendShape(dims) {
  const l = (dims || []).filter(Boolean);
  if (!l.length) return 'wide';
  if (l.every(portrait)) return 'tall';
  if (l.every(squarish)) return 'square';
  return 'wide';
}

// Arrastrar: la foto sigue al dedo (mover a la derecha baja x). frame e img en píxeles / medidas reales.
export function dragFocus({ focus, dx, dy, frame, img, zoom = 1 }) {
  const f = normFocus(focus), z = normZoom(zoom);
  const nw = img && img.w > 0 ? img.w : frame.w, nh = img && img.h > 0 ? img.h : frame.h;
  const s = Math.max(frame.w / nw, frame.h / nh);
  const ovX = Math.max(0, nw * s - frame.w) + (z - 1) * frame.w;
  const ovY = Math.max(0, nh * s - frame.h) + (z - 1) * frame.h;
  return {
    x: ovX > 1 ? clamp(Math.round(f.x - (dx / ovX) * 100), 0, 100) : f.x,
    y: ovY > 1 ? clamp(Math.round(f.y - (dy / ovY) * 100), 0, 100) : f.y,
  };
}
export const pinchZoom = (startZoom, startDist, dist) => (startDist > 0 ? normZoom(startZoom * (dist / startDist)) : normZoom(startZoom));
export const stepZoom = (z, d) => normZoom(Math.round((normZoom(z) + d) * 100) / 100);
export const isCentered = (f, z) => { const n = normFocus(f); return n.x === 50 && n.y === 50 && normZoom(z) === 1; };

// Campos de encuadre de un par, solo los que tienen valor.
export function framingFields(o) {
  const out = {};
  for (const k of ['focusBefore', 'focusAfter']) if (o && o[k]) out[k] = normFocus(o[k]);
  for (const k of ['zoomBefore', 'zoomAfter']) if (o && typeof o[k] === 'number') out[k] = normZoom(o[k]);
  if (o && SHAPES.includes(o.shape)) out.shape = o.shape;
  return out;
}
