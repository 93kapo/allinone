// Antes y después.
import { h } from './dom.js';
import { t } from './i18n.js';
import { app, register, go, render, field, itemError, thumbEl, imgUrl, controls, backButton, msg, announce } from './app.js';
import { S, set } from './store.js';
import { setCaption, addItem, makeId } from './lib/listops.js';
import { prepareImage } from './image.js';
import { apiErrorMessage } from './lib/errors.js';

// Borrador del par nuevo (vive mientras el panel está abierto; las fotos ya subidas no se pierden al cambiar de pantalla).
const nb = { before: null, after: null, es: '', en: '', error: '', busy: '' }; // before/after: { key, url }

function pickFile(which) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.hidden = true;
  inp.addEventListener('change', async () => {
    const f = inp.files[0]; inp.remove();
    if (!f) return;
    nb.error = ''; nb.busy = which; render();
    try {
      const prep = await prepareImage(f, { withThumb: false });
      const r = await app.api.upload(prep.main.blob, 'photo', null);
      const url = URL.createObjectURL(prep.main.blob);
      app.blobUrls.set(r.key, url);
      nb[which] = { key: r.key, url };
    } catch (e) {
      nb.error = e && e.code ? t(e.code === 'heic' ? 'errHeic' : e.code === 'jpeg' ? 'errJpeg' : 'errDecode') : apiErrorMessage(e || { network: true }, 'upload');
    }
    nb.busy = ''; render();
  });
  document.body.append(inp);
  inp.click();
}

function slot(which, label) {
  const cur = nb[which];
  return h('figure', null,
    cur ? thumbEl(cur.url) : h('div', { class: 'thumb-ph' }, label),
    h('figcaption', null, label),
    h('button', { class: 'btn btn-secondary btn-small', type: 'button', disabled: !!nb.busy, onclick: () => pickFile(which) }, nb.busy === which ? t('baPreparing') : (cur ? t('baChange') : t('baPick'))));
}

function baCard(it, idx, list) {
  const titleOf = it.caption.es || t('noTitle');
  return h('article', { class: `card${it.hidden ? ' is-hidden' : ''}` },
    it.hidden ? h('span', { class: 'tag tag-hidden' }, t('hiddenTag')) : null,
    h('div', { class: 'pair' },
      h('figure', null, thumbEl(imgUrl(it.before)), h('figcaption', null, t('baBeforeTag'))),
      h('figure', null, thumbEl(imgUrl(it.after)), h('figcaption', null, t('baAfterTag')))),
    field({ label: t('titleEs'), value: it.caption.es, max: 80, section: 'beforeAfter', id: it.id, name: 'caption.es', onInput: (v) => set('beforeAfter', S.state.beforeAfter.map((x) => (x.id === it.id ? setCaption(x, 'es', v) : x))) }),
    field({ label: t('titleEn'), value: it.caption.en, max: 80, section: 'beforeAfter', id: it.id, name: 'caption.en', onInput: (v) => set('beforeAfter', S.state.beforeAfter.map((x) => (x.id === it.id ? setCaption(x, 'en', v) : x))) }),
    itemError('beforeAfter', it.id),
    controls('beforeAfter', it, idx, list, { confirmText: t('confirmRemoveBA') }));
}

register('ba', () => {
  const root = h('div');
  const list = S.state.beforeAfter;
  const err = h('p', { class: 'msg msg-error', role: 'alert' }, nb.error || '');
  err.hidden = !nb.error;
  const esIn = field({ label: t('titleEs'), value: nb.es, max: 80, section: 'ba-new', id: 'x', name: 'es', onInput: (v) => { nb.es = v; } });
  const enIn = field({ label: t('titleEn'), value: nb.en, max: 80, section: 'ba-new', id: 'x', name: 'en', onInput: (v) => { nb.en = v; } });
  const localErr = h('p', { class: 'err', role: 'alert' });
  const add = h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: () => {
    if (!nb.before || !nb.after) { localErr.textContent = t('baNeedBoth'); return; }
    if (!nb.es.trim()) { localErr.textContent = t('baNeedTitle'); return; }
    const id = makeId(new Set(S.state.beforeAfter.map((x) => x.id)));
    set('beforeAfter', addItem(S.state.beforeAfter, { id, before: nb.before.key, after: nb.after.key, caption: { es: nb.es, en: nb.en }, alt: { es: '', en: '' }, hidden: false }, { atStart: true }));
    nb.before = nb.after = null; nb.es = nb.en = ''; nb.error = '';
    render(); announce(t('baAdd'));
  } }, t('baAdd'));
  root.append(
    backButton(), h('h1', null, t('baTitle')), msg('warn', t('photoCare')),
    h('section', { class: 'card', 'aria-label': t('baCreate') }, h('h2', null, t('baCreate')),
      h('div', { class: 'pair' }, slot('before', t('baBefore')), slot('after', t('baAfter'))),
      err, esIn, enIn, localErr, add),
    !list.length ? h('p', { class: 'msg' }, t('empty')) : null,
    h('div', null, list.map((it, i) => baCard(it, i, list))));
  return root;
});
