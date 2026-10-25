// Núcleo de la interfaz: pantalla actual, avisos, barra de publicar, campos con errores y controles comunes.
import { h, $, clear } from './dom.js';
import { t } from './i18n.js';
import { S, isDirty, touch, set, notify } from './store.js';
import { validateState } from './lib/validate.js';
import { moveUp, moveDown, toggleHidden, removeItem } from './lib/listops.js';
import { mediaUrl } from './lib/media-url.js';
import { SITE_IMG_BASE } from './config.js';

export const app = {
  auth: null, api: null, mediaBase: '', screen: '', params: {}, screens: {},
  blobUrls: new Map(), // key -> blob: URL de fotos subidas en esta sesión
  ui: { touched: new Set(), attempted: false, confirming: null, editing: new Set(), quota: null },
};
const NO_BAR = new Set(['login', 'reset', 'verify', 'loading', 'draft', 'preview', 'done', 'fatal']);

export function register(name, fn) { app.screens[name] = fn; }

export function announce(msg) {
  const el = $('#live');
  if (!el) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = msg; }, 30);
}

export function go(name, params = {}) {
  app.screen = name; app.params = params; app.ui.confirming = null;
  render({ focus: true });
  window.scrollTo(0, 0);
}

export function render({ focus = false } = {}) {
  const main = $('#app');
  const y = window.scrollY;
  clear(main);
  const fn = app.screens[app.screen];
  main.append(fn ? fn(app.params) : h('p', null, t('errGeneric')));
  updateBar();
  if (focus) { const hd = main.querySelector('h1'); if (hd) { hd.setAttribute('tabindex', '-1'); hd.focus({ preventScroll: true }); } }
  else window.scrollTo(0, y);
  refreshErrors();
}

export function updateBar() {
  const bar = $('#bar');
  const show = !!S.state && !NO_BAR.has(app.screen);
  bar.hidden = !show;
  $('#bar-hint').textContent = isDirty() ? t('unpublished') : t('allSaved');
}

// ---- Errores por campo ----
const aliasField = (section, field) => {
  if (section === 'beforeAfter' && field === 'alt.es') return 'caption.es';
  if (section === 'beforeAfter' && field === 'alt.en') return 'caption.en';
  if (section === 'gallery' && field === 'alt.es') return 'caption.es';
  if (section === 'gallery' && field === 'alt.en') return 'caption.en';
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
    const show = app.ui.attempted || (app.ui.touched.has(k) && !k.endsWith(':*'));
    const list = show ? (msgs.get(k) || []) : [];
    const text = list.join(' ');
    if (n.textContent !== text) n.textContent = text;
    const inp = n.dataset.for ? document.getElementById(n.dataset.for) : null;
    if (inp) { if (text) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid'); }
  }
}

let fid = 0;
// Campo de texto con etiqueta, ayuda y mensaje de error.
export function field({ label, value, onInput, section, id, name, type = 'text', max, help, autocomplete, multiline = false, upper = false, inputmode }) {
  const iid = `f${++fid}`, eid = `${iid}-e`;
  const key = errKey(section, id, name);
  const attrs = { id: iid, 'aria-describedby': eid + (help ? ` ${iid}-h` : ''), maxlength: max, autocomplete: autocomplete || 'off', autocapitalize: type === 'text' && !multiline ? undefined : 'none', spellcheck: type === 'url' || type === 'email' ? 'false' : undefined, inputmode };
  const input = multiline ? h('textarea', attrs) : h('input', { ...attrs, type });
  input.value = value || '';
  input.addEventListener('input', () => {
    if (upper) { const p = input.selectionStart; input.value = input.value.toUpperCase(); try { input.setSelectionRange(p, p); } catch { /* nada */ } }
    onInput(input.value);
    refreshErrors();
  });
  input.addEventListener('blur', () => { app.ui.touched.add(key); refreshErrors(); });
  return h('div', { class: 'field' },
    h('label', { for: iid }, label), input,
    help ? h('p', { class: 'help', id: `${iid}-h` }, help) : null,
    h('p', { class: 'err', id: eid, 'data-errkey': key, 'data-for': iid }));
}

export function selectField({ label, value, options, onChange, section, id, name, placeholder }) {
  const iid = `f${++fid}`, eid = `${iid}-e`;
  const key = errKey(section, id, name);
  const sel = h('select', { id: iid, 'aria-describedby': eid },
    placeholder ? h('option', { value: '' }, placeholder) : null,
    options.map(([v, text]) => h('option', { value: v }, text)));
  sel.value = value || '';
  sel.addEventListener('change', () => { onChange(sel.value); app.ui.touched.add(key); refreshErrors(); });
  return h('div', { class: 'field' }, h('label', { for: iid }, label), sel, h('p', { class: 'err', id: eid, 'data-errkey': key, 'data-for': iid }));
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
  img.addEventListener('error', () => { const ph = h('div', { class: 'thumb-ph' }, t('noImg')); img.replaceWith(ph); });
  return img;
}

// ---- Controles comunes de una tarjeta (Subir/Bajar/Ocultar/Quitar con confirmación en la página) ----
export function mutate(section, list) { set(section, list); render(); }

export function controls(section, it, idx, list, { confirmText, noMove = false, extra = [] } = {}) {
  const box = h('div', { class: 'card-actions' });
  const row = h('div', { class: 'row' });
  if (!noMove) {
    row.append(
      h('button', { class: 'btn btn-secondary', type: 'button', disabled: idx === 0, onclick: () => { mutate(section, moveUp(S.state[section], it.id)); announce(t('up')); } }, t('up')),
      h('button', { class: 'btn btn-secondary', type: 'button', disabled: idx === list.length - 1, onclick: () => { mutate(section, moveDown(S.state[section], it.id)); announce(t('down')); } }, t('down')));
  }
  row.append(
    ...extra,
    h('button', { class: 'btn btn-secondary', type: 'button', 'aria-pressed': it.hidden ? 'true' : 'false', onclick: () => mutate(section, toggleHidden(S.state[section], it.id)) }, it.hidden ? t('show') : t('hide')),
    h('button', { class: 'btn btn-danger', type: 'button', onclick: () => { app.ui.confirming = it.id; render(); } }, t('remove')));
  box.append(row);
  if (app.ui.confirming === it.id) {
    box.append(h('div', { class: 'confirm', role: 'alertdialog', 'aria-label': confirmText },
      h('p', null, confirmText),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-danger-solid', type: 'button', onclick: () => { app.ui.confirming = null; mutate(section, removeItem(S.state[section], it.id)); announce(t('remove')); } }, t('yesRemove')),
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { app.ui.confirming = null; render(); } }, t('keep')))));
  }
  return box;
}

export const backButton = () => h('button', { class: 'btn btn-secondary btn-small', type: 'button', onclick: () => go('home') }, t('back'));
export const msg = (kind, text) => h('p', { class: `msg ${kind ? 'msg-' + kind : ''}`, role: kind === 'error' ? 'alert' : undefined }, text);
export { touch, notify };
