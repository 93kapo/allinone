// Fotos y videos + Agregar video de YouTube.
import { h } from './dom.js';
import { t } from './i18n.js';
import { app, register, go, render, field, selectField, itemError, thumbEl, imgUrl, controls, backButton, msg, announce } from './app.js';
import { S, set } from './store.js';
import { setCaption, addItem, makeId, updateItem } from './lib/listops.js';
import { parseYouTubeId, youtubeThumb } from './lib/youtube.js';
import { Q, enqueue, retry, drop } from './uploads.js';
import { apiErrorMessage } from './lib/errors.js';

const CATS = () => [['interior', t('catInterior')], ['exterior', t('catExterior')], ['remodeling', t('catRemodeling')]];

let picker = null;
function filePicker() {
  if (picker) return picker;
  picker = document.createElement('input');
  picker.type = 'file'; picker.accept = 'image/*'; picker.multiple = true; picker.hidden = true;
  picker.setAttribute('aria-hidden', 'true'); picker.tabIndex = -1;
  picker.addEventListener('change', () => { const files = [...picker.files]; picker.value = ''; if (files.length) enqueue(files); });
  document.body.append(picker);
  return picker;
}

// Dibuja solo el panel de subida (no toca los campos que la persona está escribiendo).
function uploadPanel() {
  const jobs = Q.jobs;
  const box = h('div', { id: 'upload-panel', 'aria-live': 'polite' });
  if (!jobs.length) return box;
  const active = jobs.find((j) => j.status === 'prep' || j.status === 'up');
  const n = Q.total, i = Math.min(n, Q.finished + 1);
  if (active) {
    const pct = active.status === 'prep' ? 0 : Math.round(active.progress * 100);
    const bar = h('div'); bar.style.width = `${pct}%`;
    box.append(h('div', { class: 'msg' },
      h('p', null, active.status === 'prep' ? t('preparing', { i, n }) : `${t('uploading', { i, n })} ${pct}%`),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) }, bar)));
  }
  for (const j of jobs.filter((x) => x.status === 'error')) {
    box.append(h('div', { class: 'msg msg-error', role: 'alert' }, h('p', null, j.error),
      h('div', { class: 'row' },
        j.stop ? h('button', { class: 'btn btn-primary', type: 'button', onclick: () => retry(j) }, t('uploadRetry')) : null,
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => drop(j) }, t('uploadSkip')))));
  }
  return box;
}

function refreshUploadPanel() {
  const old = document.getElementById('upload-panel');
  if (old) old.replaceWith(uploadPanel());
}
Q.onChange = refreshUploadPanel;
Q.onItem = () => {
  app.ui.quota = null;
  if (app.screen !== 'gallery') return;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { a.addEventListener('blur', () => setTimeout(() => app.screen === 'gallery' && render(), 50), { once: true }); return; }
  render();
  if (!Q.jobs.length) announce(t('uploadDone', { n: Q.finished }));
};

function galleryCard(it, idx, list) {
  if (it.type === 'video') {
    return h('article', { class: 'card' },
      h('div', { class: 'card-head' }, thumbEl(imgUrl(it.poster)),
        h('div', { class: 'card-body' }, h('span', { class: 'tag' }, t('legacyVideo').split('.')[0]), h('p', null, it.caption.es || it.caption.en || t('noTitle')), msg('warn', t('legacyDropWarn', { name: it.caption.es || it.caption.en || t('noTitle') })))));
  }
  const url = it.type === 'youtube' ? youtubeThumb(it.youtubeId) : imgUrl(it.poster || it.src);
  const upd = (patch) => { set('gallery', updateItem(S.state.gallery, it.id, patch)); };
  const live = () => S.state.gallery.find((x) => x.id === it.id);
  const titleOf = it.caption.es || t('noTitle');
  return h('article', { class: `card${it.hidden ? ' is-hidden' : ''}` },
    h('div', { class: 'card-head' }, thumbEl(url),
      h('div', { class: 'card-body' },
        h('span', { class: 'tag' }, it.type === 'youtube' ? t('youtubeVideo') : t('photoItem')),
        it.hidden ? h('span', { class: 'tag tag-hidden' }, t('hiddenTag')) : null,
        selectField({ label: t('category'), value: it.category, options: CATS(), placeholder: t('chooseCategory'), section: 'gallery', id: it.id, name: 'category', onChange: (v) => upd({ category: v }) }),
        field({ label: t('titleEs'), value: it.caption.es, max: 80, section: 'gallery', id: it.id, name: 'caption.es', onInput: (v) => { set('gallery', S.state.gallery.map((x) => (x.id === it.id ? setCaption(x, 'es', v) : x))); } }),
        field({ label: t('titleEn'), value: it.caption.en, max: 80, section: 'gallery', id: it.id, name: 'caption.en', onInput: (v) => { set('gallery', S.state.gallery.map((x) => (x.id === it.id ? setCaption(x, 'en', v) : x))); } }))),
    itemError('gallery', it.id),
    controls('gallery', it, idx, list, { confirmText: t('confirmRemove', { name: titleOf }) }));
}

register('gallery', () => {
  const root = h('div');
  const list = S.state.gallery;
  root.append(backButton(), h('h1', null, t('photosTitle')), msg('warn', t('photoCare')));
  const q = app.ui.quota;
  if (q) root.append(h('p', { class: 'help' }, q.files <= 0 ? t('quotaNone') : t('quotaLeft', { n: Math.floor(q.files / 2) })));
  else if (q === null) {
    app.ui.quota = false;
    app.api.me().then((m) => { app.ui.quota = { files: m.cuotas.archivosRestantes }; if (app.screen === 'gallery') { const a = document.activeElement; if (!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) render(); } }).catch(() => { /* la cuota es solo una ayuda */ });
  }
  root.append(h('div', { class: 'stack' },
    h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: () => filePicker().click() }, t('addPhotos')),
    h('button', { class: 'btn btn-secondary btn-big', type: 'button', onclick: () => go('youtube') }, t('addYouTube'))));
  root.append(uploadPanel());
  if (!list.length) root.append(h('p', { class: 'msg' }, t('empty')));
  root.append(h('div', null, list.map((it, i) => galleryCard(it, i, list))));
  return root;
});

register('youtube', () => {
  const root = h('div');
  let found = null, bad = false;
  const preview = h('div');
  const addBtn = h('button', { class: 'btn btn-primary btn-big', type: 'button', disabled: true }, t('ytAdd'));
  const input = h('input', { id: 'yt-link', type: 'url', inputmode: 'url', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: t('ytPaste'), 'aria-describedby': 'yt-err' });
  const err = h('p', { class: 'err', id: 'yt-err', role: 'alert' });
  const draw = () => {
    preview.replaceChildren(); err.textContent = ''; addBtn.disabled = true; found = null;
    const v = input.value.trim();
    if (!v) return;
    const id = parseYouTubeId(v);
    if (!id) { err.textContent = t('ytBad'); return; }
    if (S.state.gallery.some((x) => x.type === 'youtube' && x.youtubeId === id)) { err.textContent = t('ytDup'); return; }
    const img = h('img', { class: 'yt-preview', src: youtubeThumb(id), alt: '' });
    img.addEventListener('load', () => { found = id; addBtn.disabled = false; });
    img.addEventListener('error', () => { preview.replaceChildren(); err.textContent = t('ytNoThumb'); });
    preview.append(h('p', { class: 'label' }, t('ytPreviewLabel')), img);
  };
  input.addEventListener('input', draw);
  addBtn.addEventListener('click', () => {
    if (!found) return;
    set('gallery', addItem(S.state.gallery, { id: makeId(new Set(S.state.gallery.map((x) => x.id))), type: 'youtube', category: '', youtubeId: found, w: 1280, h: 720, caption: { es: '', en: '' }, alt: { es: '', en: '' }, hidden: false }, { atStart: true }));
    go('gallery');
    announce(t('ytAdd'));
  });
  root.append(
    h('button', { class: 'btn btn-secondary btn-small', type: 'button', onclick: () => go('gallery') }, t('back').replace('Inicio', t('photosTitle'))),
    h('h1', null, t('ytTitle')),
    h('div', { class: 'card' }, h('h2', null, t('ytStepsTitle')),
      h('ol', { class: 'steps' }, [t('ytStep1'), t('ytStep2'), t('ytStep3'), t('ytStep4')].map((s) => h('li', null, s.replace(/^\d\.\s*/, ''))))),
    h('div', { class: 'field' }, h('label', { for: 'yt-link' }, t('ytLink')), input, err),
    preview, addBtn);
  return root;
});
