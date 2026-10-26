// Comparador antes/después del panel. Mismo marco y mismo CSS de encuadre que el sitio.
import { h } from './dom.js';
import { t } from './i18n.js';
import { frameStyle } from './lib/framing.js';
import { anim, reduced } from './fx.js';

function applyFrame(img, focus, zoom) {
  const f = frameStyle(focus, zoom);
  img.style.objectPosition = f.objectPosition; img.style.transformOrigin = f.transformOrigin; img.style.transform = f.transform;
}
export { applyFrame };

// item: { before, after, focusBefore, focusAfter, zoomBefore, zoomAfter, shape }; urls: { before, after }
export function makeCompare(item, urls, { demo = false } = {}) {
  const imgB = h('img', { src: urls.before, alt: '', draggable: 'false' });
  const imgA = h('img', { src: urls.after, alt: '', draggable: 'false' });
  const layerA = h('div', { class: 'cmp-layer' }, imgA);
  const knob = h('div', { class: 'knob2', role: 'slider', tabindex: '0', 'aria-label': t('sliderLabel'), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '50' }, '↔');
  const handle = h('div', { class: 'handle' });
  const el = h('div', { class: 'cmp', 'data-shape': 'wide' }, h('div', { class: 'cmp-layer' }, imgB), layerA, handle, knob,
    h('span', { class: 'lbl l' }, t('baBeforeTag')), h('span', { class: 'lbl r' }, t('baAfterTag')));
  let pos = 50, cur = item;
  const setPos = (v) => {
    pos = Math.max(0, Math.min(100, v));
    layerA.style.clipPath = `inset(0 0 0 ${pos}%)`;
    handle.style.left = `${pos}%`; knob.style.left = `${pos}%`;
    knob.setAttribute('aria-valuenow', String(Math.round(pos)));
  };
  const auto = () => {
    if (cur.shape || !imgB.naturalWidth || !imgA.naturalWidth) return;
    el.dataset.shape = [imgB, imgA].every((i) => i.naturalHeight > i.naturalWidth * 1.1) ? 'tall' : 'wide';
  };
  const set = (it) => {
    cur = it;
    el.dataset.shape = it.shape || 'wide';
    applyFrame(imgB, it.focusBefore, it.zoomBefore); applyFrame(imgA, it.focusAfter, it.zoomAfter);
    auto();
  };
  imgB.addEventListener('load', auto); imgA.addEventListener('load', auto);
  set(item); setPos(50);
  const fromEvent = (e) => { const r = el.getBoundingClientRect(); setPos(((e.clientX - r.left) / r.width) * 100); };
  let drag = false;
  el.addEventListener('pointerdown', (e) => { drag = true; try { el.setPointerCapture(e.pointerId); } catch { /* nada */ } fromEvent(e); });
  el.addEventListener('pointermove', (e) => { if (drag) fromEvent(e); });
  el.addEventListener('pointerup', () => { drag = false; });
  el.addEventListener('pointercancel', () => { drag = false; });
  knob.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { setPos(pos - 5); e.preventDefault(); } if (e.key === 'ArrowRight') { setPos(pos + 5); e.preventDefault(); } });
  if (demo && !reduced()) {
    setTimeout(() => {
      if (!el.isConnected || !anim(el, [{ opacity: 1 }], { duration: 1 })) return;
      let t0;
      const step = (ts) => { t0 ||= ts; const k = Math.min(1, (ts - t0) / 900); setPos(50 + Math.sin(k * Math.PI * 2) * 18 * (1 - k)); if (k < 1 && el.isConnected && !drag) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }, 500);
  }
  return { el, set };
}
