// Selector de encuadre ("Elegir qué parte se ve"): marco real, arrastrar, pellizcar, acercar, centrar y vista previa en vivo.
import { h } from './dom.js';
import { t } from './i18n.js';
import { icon } from './icons.js';
import { modal } from './fx.js';
import { makeCompare, applyFrame } from './compare.js';
import { SHAPES, DEFAULT_FOCUS, normFocus, normZoom, recommendShape, dragFocus, pinchZoom, stepZoom, isCentered, clamp } from './lib/framing.js';

const SHAPE_LABEL = () => ({ wide: t('fmWide'), tall: t('fmTall'), square: t('fmSquare') });

function loadDims(url) {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight });
    i.onerror = () => res(null);
    i.src = url;
  });
}

// mode 'ba': { before, after } urls y valores iniciales {focusBefore, focusAfter, zoomBefore, zoomAfter, shape}.
// mode 'photo': { photo } url y {focus}. onSave recibe los campos nuevos.
export function openFraming({ mode, urls, initial = {}, onSave }) {
  const ba = mode === 'ba';
  const d = {
    which: ba ? 'before' : 'photo',
    shape: ba ? (initial.shape || '') : 'wide',
    focus: { before: normFocus(initial.focusBefore), after: normFocus(initial.focusAfter), photo: normFocus(initial.focus) },
    zoom: { before: normZoom(initial.zoomBefore), after: normZoom(initial.zoomAfter), photo: 1 },
  };
  const dims = { before: null, after: null, photo: null };
  let recommended = 'wide';

  const img = h('img', { class: 'fm-img', alt: '', draggable: 'false' });
  const grid = h('div', { class: 'fm-grid', 'aria-hidden': 'true' });
  const frame = h('div', { class: 'fm-frame', tabindex: '0', role: 'application', 'aria-label': t('fmFrameLabel'), 'data-shape': d.shape || 'wide' }, img, grid);
  const zoomIn = h('input', { type: 'range', min: '1', max: '3', step: '0.05', id: 'fm-zoom', 'aria-label': t('fmZoom') });
  const minus = h('button', { class: 'btn btn-secondary btn-small fm-step', type: 'button', 'aria-label': t('fmZoomOut') }, '−');
  const plus = h('button', { class: 'btn btn-secondary btn-small fm-step', type: 'button', 'aria-label': t('fmZoomIn') }, '+');
  const center = h('button', { class: 'btn btn-secondary btn-small', type: 'button' }, icon('crop', { size: 20 }), t('fmCenter'));
  const recChip = h('p', { class: 'tag fm-rec', hidden: true });
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });

  const shapeBtns = SHAPES.map((sh) => h('button', { class: 'btn btn-secondary btn-small fm-shape', type: 'button', 'data-shape': sh, role: 'radio', onclick: () => { d.shape = sh; refresh(); } }, SHAPE_LABEL()[sh]));
  const shapeRow = ba ? h('div', { class: 'fm-row', role: 'radiogroup', 'aria-label': t('fmShape') }, shapeBtns) : null;
  const tabs = ba ? ['before', 'after'].map((k) => h('button', { class: 'btn btn-secondary btn-small fm-tab', type: 'button', 'data-which': k, onclick: () => { d.which = k; refresh(true); } }, k === 'before' ? t('baBefore') : t('baAfter'))) : [];

  const item = () => ba ? { before: urls.before, after: urls.after, focusBefore: d.focus.before, focusAfter: d.focus.after, zoomBefore: d.zoom.before, zoomAfter: d.zoom.after, shape: d.shape || recommended }
    : { focus: d.focus.photo };
  const prevWrap = h('div', { class: 'fm-prev' });
  let cmp = null, tile = null;
  if (ba) { cmp = makeCompare(item(), { before: urls.before, after: urls.after }); prevWrap.append(cmp.el); }
  else { tile = h('img', { class: 'thumb loaded', src: urls.photo, alt: '' }); prevWrap.append(tile); }

  function refresh(swap = false) {
    const k = d.which;
    if (swap) img.src = urls[k];
    applyFrame(img, d.focus[k], d.zoom[k]);
    frame.dataset.shape = (ba ? (d.shape || recommended) : 'wide');
    zoomIn.value = String(d.zoom[k]);
    for (const b of shapeBtns) { const on = b.dataset.shape === (d.shape || recommended); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.classList.toggle('on', on); }
    for (const b of tabs) b.setAttribute('aria-pressed', b.dataset.which === k ? 'true' : 'false');
    for (const b of tabs) b.classList.toggle('on', b.dataset.which === k);
    center.disabled = isCentered(d.focus[k], d.zoom[k]);
    frame.dataset.fx = String(d.focus[k].x); frame.dataset.fy = String(d.focus[k].y); frame.dataset.zoom = String(d.zoom[k]);
    if (cmp) cmp.set(item()); else if (tile) tile.style.objectPosition = `${d.focus.photo.x}% ${d.focus.photo.y}%`;
    live.textContent = `${d.focus[k].x}% ${d.focus[k].y}%`;
  }

  // ---- gestos ----
  const ptrs = new Map();
  let pinch = null;
  const dist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  frame.addEventListener('pointerdown', (e) => {
    try { frame.setPointerCapture(e.pointerId); } catch { /* nada */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    frame.classList.add('dragging');
    if (ptrs.size === 2) pinch = { d: dist(), z: d.zoom[d.which] };
  });
  frame.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const k = d.which;
    if (ptrs.size === 1) {
      const r = frame.getBoundingClientRect();
      d.focus[k] = dragFocus({ focus: d.focus[k], dx: e.clientX - p.x, dy: e.clientY - p.y, frame: { w: r.width, h: r.height }, img: dims[k], zoom: d.zoom[k] });
    }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2 && pinch && ba) { d.zoom[k] = pinchZoom(pinch.z, pinch.d, dist()); }
    refresh();
  });
  const end = (e) => { ptrs.delete(e.pointerId); pinch = null; if (!ptrs.size) frame.classList.remove('dragging'); };
  frame.addEventListener('pointerup', end); frame.addEventListener('pointercancel', end);
  frame.addEventListener('wheel', (e) => { if (!ba) return; e.preventDefault(); const k = d.which; d.zoom[k] = stepZoom(d.zoom[k], e.deltaY < 0 ? 0.1 : -0.1); refresh(); }, { passive: false });
  frame.addEventListener('keydown', (e) => {
    const k = d.which, step = e.shiftKey ? 10 : 2;
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (mv) { d.focus[k] = { x: clamp(d.focus[k].x + mv[0], 0, 100), y: clamp(d.focus[k].y + mv[1], 0, 100) }; e.preventDefault(); refresh(); return; }
    if (ba && (e.key === '+' || e.key === '=')) { d.zoom[k] = stepZoom(d.zoom[k], 0.1); e.preventDefault(); refresh(); }
    if (ba && (e.key === '-' || e.key === '_')) { d.zoom[k] = stepZoom(d.zoom[k], -0.1); e.preventDefault(); refresh(); }
    if (e.key === '0') { d.focus[k] = { ...DEFAULT_FOCUS }; d.zoom[k] = 1; e.preventDefault(); refresh(); }
  });
  zoomIn.addEventListener('input', () => { d.zoom[d.which] = normZoom(Number(zoomIn.value)); refresh(); });
  plus.addEventListener('click', () => { d.zoom[d.which] = stepZoom(d.zoom[d.which], 0.2); refresh(); });
  minus.addEventListener('click', () => { d.zoom[d.which] = stepZoom(d.zoom[d.which], -0.2); refresh(); });
  center.addEventListener('click', () => { d.focus[d.which] = { ...DEFAULT_FOCUS }; d.zoom[d.which] = 1; refresh(); });

  const zoomRow = ba ? h('div', { class: 'fm-zoom' }, h('label', { for: 'fm-zoom' }, t('fmZoom')), h('div', { class: 'fm-zrow' }, minus, zoomIn, plus)) : null;
  let box;
  const done = h('button', { class: 'btn btn-primary btn-big', type: 'button', id: 'fm-done' }, icon('check', { size: 22 }), t('fmDone'));
  const cancel = h('button', { class: 'btn btn-secondary btn-big', type: 'button', id: 'fm-cancel' }, t('cancel'));
  const node = h('div', { class: 'fm' },
    h('h2', { class: 'sheet-title' }, t('fmTitle')),
    h('p', { class: 'help' }, t('fmHint')),
    ba ? h('div', null, h('p', { class: 'label' }, t('fmShape')), shapeRow, recChip) : null,
    ba ? h('div', { class: 'fm-row fm-tabs', role: 'group', 'aria-label': t('fmWhich') }, tabs) : null,
    h('div', { class: 'fm-stage' }, frame),
    zoomRow,
    h('div', { class: 'fm-row' }, center),
    h('h3', null, t('fmPreview')), prevWrap, live,
    h('div', { class: 'stack fm-actions' }, done, cancel));
  box = modal({ label: t('fmTitle'), node });
  done.addEventListener('click', () => {
    box.close();
    if (ba) onSave({ focusBefore: d.focus.before, focusAfter: d.focus.after, zoomBefore: d.zoom.before, zoomAfter: d.zoom.after, shape: d.shape || recommended });
    else onSave({ focus: d.focus.photo });
  });
  cancel.addEventListener('click', () => box.close());
  img.src = urls[d.which];
  img.addEventListener('load', () => { frame.classList.add('ready'); });
  refresh();
  img.addEventListener('error', () => { frame.classList.add('bad'); frame.append(h('p', { class: 'fm-bad' }, t('fmLoadError'))); });
  // medidas reales para el arrastre y la recomendación
  const keys = ba ? ['before', 'after'] : ['photo'];
  Promise.all(keys.map((k) => loadDims(urls[k]))).then((r) => {
    keys.forEach((k, i) => { dims[k] = r[i]; });
    if (ba) {
      recommended = recommendShape([dims.before, dims.after]);
      if (!d.shape) d.shape = recommended;
      recChip.hidden = recommended === 'wide' && !!initial.shape;
      recChip.textContent = t('fmRecommended', { shape: SHAPE_LABEL()[recommended] });
      recChip.hidden = false;
    }
    refresh();
  });
  return box;
}
