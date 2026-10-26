// Fotos y videos + Agregar video de YouTube.
import { h, s as svg } from './dom.js';
import { icon } from './icons.js';
import { toast, confetti } from './fx.js';
import { t } from './i18n.js';
import { app, register, go, render, field, selectField, itemError, thumbEl, imgUrl, controls, backButton, msg, announce, videoEl } from './app.js';
import { S, set } from './store.js';
import { setCaption, addItem, makeId, updateItem } from './lib/listops.js';
import { parseYouTubeId, youtubeThumb } from './lib/youtube.js';
import { Q, enqueue, enqueueVideo, retry, drop } from './uploads.js';
import { apiErrorMessage } from './lib/errors.js';
import { formatSize } from './lib/video.js';

const CATS = () => [['interior', t('catInterior')], ['exterior', t('catExterior')], ['remodeling', t('catRemodeling')]];

let vpicker = null;
function videoPicker() {
  if (vpicker) return vpicker;
  vpicker = document.createElement('input');
  vpicker.type = 'file'; vpicker.accept = 'video/*'; vpicker.hidden = true; vpicker.id = 'video-picker';
  vpicker.setAttribute('aria-hidden', 'true'); vpicker.tabIndex = -1;
  vpicker.addEventListener('change', () => { const f = vpicker.files[0]; vpicker.value = ''; if (f) enqueueVideo(f); });
  document.body.append(vpicker);
  return vpicker;
}

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

// Anillo de progreso circular real (un anillo por foto).
const CIRC = 2 * Math.PI * 27;
function ring(p) {
  const fg = svg('circle', { class: 'fg', cx: 32, cy: 32, r: 27, 'stroke-dasharray': CIRC.toFixed(1) });
  fg.style.strokeDashoffset = String((CIRC * (1 - p)).toFixed(1));
  return svg('svg', { class: 'ring', viewBox: '0 0 64 64', 'aria-hidden': 'true' }, svg('circle', { class: 'bg', cx: 32, cy: 32, r: 27 }), fg);
}

// Dibuja solo el panel de subida (no toca los campos que la persona está escribiendo).
function uploadPanel() {
  const jobs = Q.jobs;
  const box = h('div', { id: 'upload-panel', 'aria-live': 'polite' });
  if (!jobs.length) return box;
  const n = Q.total;
  let i = 0;
  for (const j of jobs) {
    if (j.status === 'error') {
      box.append(h('div', { class: 'msg msg-error', role: 'alert' }, icon('alert', { size: 22 }), h('div', null, h('p', null, j.error),
        h('div', { class: 'row' },
          j.stop ? h('button', { class: 'btn btn-primary', type: 'button', onclick: () => retry(j) }, t('uploadRetry')) : null,
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => drop(j) }, t('uploadSkip'))))));
      continue;
    }
    i++;
    const isV = j.kind === 'video';
    if (!isV && !j.preview) { try { j.preview = URL.createObjectURL(j.file); } catch { /* sin vista previa */ } }
    const pct = j.status === 'done' ? 100 : j.status === 'prep' ? 0 : Math.round(j.progress * 100);
    const label = j.status === 'done' ? t('upDone') : j.status === 'wait' ? t('upWaiting') : isV ? (j.status === 'prep' ? t('preparingVideo') : t('uploadingVideo', { pct })) : (j.status === 'prep' ? t('preparing', { i: Q.finished + 1, n }) : `${t('uploading', { i: Q.finished + 1, n })} ${pct}%`);
    const thumb = h('div', { class: 'upthumb' },
      j.preview ? h('img', { src: j.preview, alt: '' }) : icon('video', { size: 28 }),
      j.status === 'up' || j.status === 'prep' ? [h('span', { class: 'ring-shade' }), ring(pct / 100)] : null,
      j.status === 'done' ? [h('span', { class: 'ring-shade' }), svg('svg', { class: 'upcheck', viewBox: '0 0 34 34', fill: 'none', stroke: 'currentColor', 'stroke-width': '4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, svg('path', { d: 'M8 18l7 7 12-14' }))] : null);
    box.append(h('div', { class: `uprow${j.status === 'done' ? ' done' : ''}` }, thumb,
      h('div', { class: 'uptext' }, j.name || (isV ? t('videoItem') : t('photoItem')), h('small', null, isV ? `${formatSize(j.file.size)} · ${label}` : label)),
      h('span', { class: 'sr-only', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) })));
  }
  return box;
}

function refreshUploadPanel() {
  const old = document.getElementById('upload-panel');
  if (old) old.replaceWith(uploadPanel());
}
Q.onChange = refreshUploadPanel;
Q.onAllDone = () => { toast(t('upAllDone'), { ms: 4500 }); if (app.screen === 'gallery') confetti({ x: innerWidth / 2, y: 220, count: 14, ms: 1000 }); };
Q.onItem = () => {
  app.ui.quota = null;
  if (app.screen !== 'gallery') return;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { a.addEventListener('blur', () => setTimeout(() => app.screen === 'gallery' && render(), 50), { once: true }); return; }
  render();
  if (!Q.jobs.length) announce(t('uploadDone', { n: Q.finished }));
};

function galleryCard(it, idx, list) {
  const url = it.type === 'youtube' ? youtubeThumb(it.youtubeId) : it.type === 'video' ? imgUrl(it.poster) : imgUrl(it.poster || it.src);
  const media = it.type === 'video' ? videoEl(it) : thumbEl(url);
  const upd = (patch) => { set('gallery', updateItem(S.state.gallery, it.id, patch)); };
  const live = () => S.state.gallery.find((x) => x.id === it.id);
  const titleOf = it.caption.es || t('noTitle');
  return h('article', { class: `card${it.hidden ? ' is-hidden' : ''}`, 'data-id': it.id },
    h('div', { class: 'card-head' }, media,
      h('div', { class: 'card-body' },
        h('span', { class: 'tag' }, it.type === 'youtube' ? t('youtubeVideo') : it.type === 'video' ? t('videoItem') : t('photoItem')),
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
  if (q) root.append(h('p', { class: 'help' }, (q.files <= 0 ? t('quotaNone') : t('quotaLeft', { n: Math.floor(q.files / 2) })) + ' ' + t('quotaVideos', { n: q.videos })));
  else if (q === null) {
    app.ui.quota = false;
    app.api.me().then((m) => { app.ui.quota = { files: m.cuotas.archivosRestantes, videos: m.cuotas.videosRestantes ?? 0 }; if (app.screen === 'gallery') { const a = document.activeElement; if (!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) render(); } }).catch(() => { /* la cuota es solo una ayuda */ });
  }
  const dz = h('div', { class: 'dropzone' },
    h('div', { class: 'dz-head' }, h('span', { class: 'dz-ico' }, icon('upload', { size: 28 })), h('div', null, h('strong', null, t('dzTitle')), h('p', null, t('dzHint')))),
    h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: () => filePicker().click() }, icon('camera', { size: 22 }), t('addPhotos')),
    h('button', { class: 'btn btn-primary btn-big', type: 'button', id: 'add-video', onclick: () => videoPicker().click() }, icon('video', { size: 22 }), t('addVideo')),
    h('button', { class: 'btn btn-secondary btn-big', type: 'button', onclick: () => go('youtube') }, icon('play', { size: 20 }), t('addYouTube')),
    h('p', { class: 'help' }, t('videoTips')));
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault(); dz.classList.remove('over');
    const files = [...(e.dataTransfer ? e.dataTransfer.files : [])];
    const imgs = files.filter((f) => /^image\//.test(f.type)), vids = files.filter((f) => /^video\//.test(f.type));
    if (imgs.length) enqueue(imgs);
    for (const v of vids) enqueueVideo(v);
  });
  root.append(dz);
  root.append(uploadPanel());
  if (!list.length) root.append(h('p', { class: 'msg' }, t('empty')));
  root.append(h('div', { class: 'cards' }, list.map((it, i) => galleryCard(it, i, list))));
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
