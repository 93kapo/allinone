// Núcleo de la interfaz: pantalla actual, transiciones, barra de publicar, campos con errores y controles comunes.
import { h, $, clear } from './dom.js';
import { t } from './i18n.js';
import { S, isDirty, touch, set } from './store.js';
import { validateState } from './lib/validate.js';
import { moveUp, moveDown, toggleHidden } from './lib/listops.js';
import { countChanges } from './lib/changes.js';
import { mediaUrl } from './lib/media-url.js';
import { SITE_IMG_BASE } from './config.js';
import { icon } from './icons.js';
import { dialog, closeDialog, toast, snapshot, playFlip, anim, reduced } from './fx.js';

export const app = {
  auth: null, api: null, mediaBase: '', screen: '', params: {}, screens: {},
  blobUrls: new Map(), // key -> blob: URL de fotos subidas en esta sesión
  ui: { touched: new Set(), attempted: false, editing: new Set(), quota: null },
};
const NO_BAR = new Set(['login', 'confirm', 'loading', 'draft', 'preview', 'done', 'fatal']);

export function register(name, fn) { app.screens[name] = fn; }

export function announce(msg) {
  const el = $('#live');
  if (!el) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = msg; }, 30);
}

// Cambia de pantalla con transición (View Transitions si existe; si no, animación CSS de entrada).
export function go(name, params = {}) {
  app.screen = name; app.params = params;
  closeDialog();
  const doit = () => { render({ focus: true }); window.scrollTo(0, 0); };
  if (document.startViewTransition && !reduced() && document.body.dataset.screen && document.body.dataset.screen !== 'loading') {
    try { const vt = document.startViewTransition(doit); for (const k of ['ready', 'finished', 'updateCallbackDone']) vt[k].catch(() => { /* transición reemplazada: normal */ }); return; } catch { /* respaldo */ }
  }
  doit();
}

export function render({ focus = false } = {}) {
  const main = $('#app');
  const y = window.scrollY;
  document.body.dataset.screen = app.screen;
  main.classList.toggle('enter', !!focus);
  clear(main);
  const fn = app.screens[app.screen];
  const node = fn ? fn(app.params) : h('p', null, t('errGeneric'));
  let i = 0;
  for (const el of node.querySelectorAll('.tiles > *, .cards > *, .shortcuts > *')) el.style.setProperty('--i', String(i++ % 8));
  main.append(node);
  updateBar();
  if (focus) { const hd = main.querySelector('h1'); if (hd) { hd.setAttribute('tabindex', '-1'); hd.focus({ preventScroll: true }); } }
  else window.scrollTo(0, y);
  refreshErrors();
}

// ---- Barra "Publicar cambios" (hoja flotante): aparece cuando hay algo que publicar ----
export const pendingCount = () => (S.state && S.base ? countChanges(S.base, S.state) : 0);
export function updateBar() {
  const bar = $('#bar');
  const n = pendingCount();
  const show = !!S.state && !NO_BAR.has(app.screen) && (isDirty() || S.isFirst);
  if (bar.hidden !== !show) bar.hidden = !show;
  const hint = $('#bar-hint');
  const text = S.isFirst && !n ? t('barFirst') : n === 1 ? t('barPending1') : t('barPendingN');
  hint.replaceChildren(...(n ? [h('span', { class: 'badge', 'aria-hidden': 'true' }, String(n))] : []), text);
}

// ---- Errores por campo ----
const aliasField = (section, field) => {
  if ((section === 'beforeAfter' || section === 'gallery') && field === 'alt.es') return 'caption.es';
  if ((section === 'beforeAfter' || section === 'gallery') && field === 'alt.en') return 'caption.en';
  return field;
};
export const errKey = (section, id, field) => `${section}:${id || ''}:${field}`;

export function refreshErrors() {
  if (!S.state) return;
  const nodes = document.querySelectorAll('[data-errkey]');
  if (!nodes.length) return;
  const res = validateState(S.state);
  app.ui.errors = res.errores;
  const have = new Set([...nodes].map((n) => n.dataset.errkey));
  const msgs = new Map();
  for (const e of res.errores) {
    let k = errKey(e.section, e.id, aliasField(e.section, e.field));
    if (!have.has(k)) k = errKey(e.section, e.id, '*');
    if (!msgs.has(k)) msgs.set(k, []);
    msgs.get(k).push(e.mensaje);
  }
  for (const n of nodes) {
    const k = n.dataset.errkey;
    const touched = app.ui.touched.has(k) && !k.endsWith(':*');
    const show = app.ui.attempted || touched;
    const text = (show ? (msgs.get(k) || []) : []).join(' ');
    if (n.textContent !== text) n.textContent = text;
    const inp = n.dataset.for ? document.getElementById(n.dataset.for) : null;
    if (inp) {
      if (text) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
      const f = inp.closest('.field');
      if (f) { const st = text ? 'bad' : (touched && inp.value.trim() ? 'ok' : ''); if (f.dataset.state !== st) f.dataset.state = st; }
    }
  }
}

let fid = 0;
// Campo de texto: etiqueta (flotante si es corta), ayuda, contador y mensaje de error con ícono de estado.
export function field({ label, value, onInput, section, id, name, type = 'text', max, help, autocomplete, multiline = false, upper = false, inputmode, float = false }) {
  const iid = `f${++fid}`, eid = `${iid}-e`;
  const key = errKey(section, id, name);
  const attrs = { id: iid, 'aria-describedby': eid + (help ? ` ${iid}-h` : ''), maxlength: max, autocomplete: autocomplete || 'off', autocapitalize: type === 'text' && !multiline ? undefined : 'none', spellcheck: type === 'url' || type === 'email' ? 'false' : undefined, inputmode, placeholder: float ? ' ' : undefined };
  const input = multiline ? h('textarea', attrs) : h('input', { ...attrs, type });
  input.value = value || '';
  const lab = h('label', { for: iid }, label);
  const count = max ? h('span', { class: 'count', 'aria-hidden': 'true' }) : null;
  const upd = () => { if (count) { const n = Array.from(input.value).length; count.textContent = `${n}/${max}`; count.classList.toggle('near', n >= max * 0.85); } };
  upd();
  input.addEventListener('input', () => {
    if (upper) { const p = input.selectionStart; input.value = input.value.toUpperCase(); try { input.setSelectionRange(p, p); } catch { /* nada */ } }
    onInput(input.value);
    upd();
    refreshErrors();
  });
  input.addEventListener('blur', () => { app.ui.touched.add(key); refreshErrors(); });
  return h('div', { class: `field${float ? ' float' : ''}${max && !float ? ' has-count' : ''}` },
    float ? null : lab,
    h('div', { class: 'control' }, input, float ? lab : null,
      multiline ? null : [icon('check', { size: 22, cls: 'vicon vicon-ok' }), icon('alert', { size: 22, cls: 'vicon vicon-bad' })]),
    help ? h('p', { class: 'help', id: `${iid}-h` }, help) : null,
    h('div', { class: 'field-foot' }, h('p', { class: 'err', id: eid, 'data-errkey': key, 'data-for': iid }), count));
}

export function selectField({ label, value, options, onChange, section, id, name, placeholder }) {
  const iid = `f${++fid}`, eid = `${iid}-e`;
  const key = errKey(section, id, name);
  const sel = h('select', { id: iid, 'aria-describedby': eid },
    placeholder ? h('option', { value: '' }, placeholder) : null,
    options.map(([v, text]) => h('option', { value: v }, text)));
  sel.value = value || '';
  sel.addEventListener('change', () => { onChange(sel.value); app.ui.touched.add(key); refreshErrors(); });
  return h('div', { class: 'field' }, h('label', { for: iid }, label),
    h('div', { class: 'control sel' }, sel, icon('alert', { size: 22, cls: 'vicon vicon-bad' })),
    h('div', { class: 'field-foot' }, h('p', { class: 'err', id: eid, 'data-errkey': key, 'data-for': iid })));
}

export const itemError = (section, id) => h('p', { class: 'err', 'data-errkey': errKey(section, id, '*') });

// ---- Imágenes ----
export function imgUrl(ref) {
  if (app.blobUrls.has(ref)) return app.blobUrls.get(ref);
  return mediaUrl(ref, { mediaBase: app.mediaBase, siteBase: SITE_IMG_BASE });
}
export function thumbEl(url, alt = '') {
  if (!url) return h('div', { class: 'thumb-ph', role: 'img', 'aria-label': t('siteImg') }, t('siteImg'));
  const img = h('img', { class: 'thumb', src: url, alt, loading: 'lazy', decoding: 'async' });
  img.addEventListener('load', () => img.classList.add('loaded'));
  img.addEventListener('error', () => { img.replaceWith(h('div', { class: 'thumb-ph' }, t('noImg'))); });
  if (img.complete && img.naturalWidth) img.classList.add('loaded');
  return img;
}

// Vista previa de un video con controles (no descarga nada hasta que se toque: preload none).
export function videoEl(it) {
  const src = imgUrl(it.src);
  if (!src) return thumbEl(null);
  const v = h('video', { class: 'vprev', controls: true, playsinline: '', preload: 'none', 'aria-label': it.caption.es || t('videoItem') });
  const poster = imgUrl(it.poster);
  if (poster) v.setAttribute('poster', poster);
  v.setAttribute('src', src);
  return v;
}

// ---- Controles comunes de una tarjeta ----
// Cambia la lista y las tarjetas se deslizan a su nueva posición (FLIP).
export function mutate(section, list) {
  const first = snapshot();
  set(section, list);
  render();
  playFlip(first);
}

function removeWithUndo(section, it) {
  const list = S.state[section];
  const idx = list.findIndex((x) => x.id === it.id);
  const card = document.querySelector(`[data-id="${it.id}"]`);
  const finish = () => {
    const removed = list[idx];
    mutate(section, list.filter((x) => x.id !== it.id));
    announce(t('removedToast'));
    toast(t('removedToast'), { actionLabel: t('undoShort'), ms: 6000, onAction: () => {
      const cur = S.state[section].slice();
      cur.splice(Math.min(idx, cur.length), 0, removed);
      mutate(section, cur);
    } });
  };
  const a = card && !reduced() ? anim(card, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.94) translateY(8px)' }], { duration: 220 }) : null;
  if (a) a.onfinish = finish; else finish();
}

export function controls(section, it, idx, list, { confirmText, noMove = false, extra = [] } = {}) {
  const row = h('div', { class: 'row' });
  const btn = (cls, ico, label, onclick, extraAttrs = {}) => h('button', { class: `btn ${cls}`, type: 'button', onclick, ...extraAttrs }, icon(ico, { size: 20 }), label);
  if (!noMove) {
    row.append(
      btn('btn-secondary', 'up', t('up'), () => { mutate(section, moveUp(S.state[section], it.id)); announce(t('up')); }, { disabled: idx === 0 }),
      btn('btn-secondary', 'down', t('down'), () => { mutate(section, moveDown(S.state[section], it.id)); announce(t('down')); }, { disabled: idx === list.length - 1 }));
  }
  row.append(
    ...extra,
    btn('btn-secondary', it.hidden ? 'eye' : 'eyeoff', it.hidden ? t('show') : t('hide'), () => mutate(section, toggleHidden(S.state[section], it.id)), { 'aria-pressed': it.hidden ? 'true' : 'false' }),
    btn('btn-danger', 'trash', t('remove'), () => {
      dialog({ title: t('sureTitle'), text: confirmText, buttons: [
        { label: t('yesRemove'), cls: 'btn-danger-solid', onClick: () => removeWithUndo(section, it) },
        { label: t('keep'), cls: 'btn-secondary' },
      ] });
    }));
  return h('div', { class: 'card-actions' }, row);
}

export const backButton = () => h('button', { class: 'btn btn-secondary btn-small btn-back', type: 'button', onclick: () => go('home') }, h('span', { class: 'arr', 'aria-hidden': 'true' }, '←'), ' Inicio');
export const msg = (kind, text, ico) => h('div', { class: `msg ${kind ? 'msg-' + kind : ''}`, role: kind === 'error' ? 'alert' : undefined },
  ico ? icon(ico, { size: 22 }) : (kind === 'error' ? icon('alert', { size: 22 }) : kind === 'ok' ? icon('check', { size: 22 }) : null), h('p', null, text));
export { touch };
