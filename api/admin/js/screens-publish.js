// Inicio, vista previa, publicar, historial, deshacer, borrador pendiente y errores de carga.
import { h } from './dom.js';
import { t } from './i18n.js';
import { app, register, go, render, backButton, msg, thumbEl, imgUrl, announce, videoEl } from './app.js';
import { S, setBase, useDraft, isDirty, clearDraft, saveNow, rebaseDraft, normalize } from './store.js';
import { validateState, locateServerErrors } from './lib/validate.js';
import { apiErrorMessage } from './lib/errors.js';
import { diffLists, describeDiff, hasChange } from './lib/changes.js';
import { youtubeThumb } from './lib/youtube.js';
import { SITE_GALLERY_URL } from './config.js';

const SEC_NAME = () => ({ gallery: t('secPhotos'), beforeAfter: t('secBA'), reviews: t('secReviews'), settings: t('secSettings') });
const SEC_SCREEN = { gallery: 'gallery', beforeAfter: 'ba', reviews: 'reviews', settings: 'settings' };
const CAT = () => ({ interior: t('catInterior'), exterior: t('catExterior'), remodeling: t('catRemodeling') });

register('loading', () => h('div', null, h('h1', null, t('loading'))));
register('fatal', (p) => h('div', null, h('h1', null, t('loadError')), msg('error', p.text || t('errNetwork')),
  h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: () => p.retry && p.retry() }, t('retry'))));

register('home', () => {
  const tile = (key, hint, screen) => h('button', { class: 'tile', type: 'button', onclick: () => go(screen) }, h('span', { class: 'tile-title' }, t(key)), h('span', { class: 'tile-hint' }, t(hint)));
  return h('div', null,
    h('h1', null, t('homeTitle')),
    S.isFirst ? msg('', t('firstTime')) : h('p', null, t('homeHello')),
    app.ui.flash ? msg('ok', app.ui.flash) : null,
    h('div', { class: 'tiles' },
      tile('actPhotos', 'actPhotosHint', 'gallery'), tile('actBA', 'actBAHint', 'ba'),
      tile('actSettings', 'actSettingsHint', 'settings'), tile('actReviews', 'actReviewsHint', 'reviews')),
    h('div', { class: 'shortcuts' },
      h('button', { class: 'btn btn-secondary btn-big', type: 'button', onclick: () => go('undo') }, t('actUndo')),
      h('button', { class: 'btn btn-secondary btn-big', type: 'button', onclick: () => go('history') }, t('actHistory'))));
});

// ---- Borrador pendiente ----
register('draft', (p) => {
  const same = p.draft.baseVersion === p.version;
  const keep = async () => { setBase(p.content, { first: p.first }); useDraft(p.draft.state, p.version); go('home'); };
  const drop = async () => { await clearDraft(); setBase(p.content, { first: p.first }); go('home'); };
  return h('div', null, h('h1', null, t('draftFound').split('.')[0] + '.'),
    msg('', same ? t('draftFound') : t('draftOld')),
    h('div', { class: 'stack' },
      h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: keep }, same ? t('draftKeep') : t('draftOnTop')),
      h('button', { class: 'btn btn-secondary btn-big', type: 'button', onclick: drop }, same ? t('draftDrop') : t('draftUseLatest'))));
});

// ---- Vista previa ----
function changesFor() {
  const next = S.state, base = S.base;
  return {
    gallery: diffLists(base.gallery, next.gallery),
    beforeAfter: diffLists(base.beforeAfter, next.beforeAfter),
    reviews: diffLists(base.reviews, next.reviews),
    settings: JSON.stringify(base.settings) !== JSON.stringify(next.settings),
  };
}

function previewBody() {
  const st = S.state, cat = CAT();
  const root = h('div');
  const vis = (l) => l.filter((x) => !x.hidden);
  const hid = (l) => l.length - vis(l).length;
  const g = vis(st.gallery);
  root.append(h('h2', null, t('prevGallery')));
  root.append(g.length ? h('div', { class: 'pgrid' }, g.map((it) => h('div', { class: 'pcard' },
    it.type === 'video' ? videoEl(it) : thumbEl(it.type === 'youtube' ? youtubeThumb(it.youtubeId) : imgUrl(it.poster || it.src)),
    h('p', null, h('strong', null, it.caption.es || t('noTitle'))), h('p', null, `${cat[it.category] || ''}${it.type === 'youtube' ? ` · ${t('youtubeVideo')}` : it.type === 'video' ? ` · ${t('videoItem')}` : ''}`)))) : h('p', null, t('empty')));
  if (hid(st.gallery)) root.append(h('p', { class: 'help' }, t('prevHiddenNote', { n: hid(st.gallery) })));
  root.append(h('h2', null, t('prevBA')));
  const b = vis(st.beforeAfter);
  root.append(b.length ? h('div', null, b.map((it) => h('div', { class: 'card' },
    h('div', { class: 'pair' }, h('figure', null, thumbEl(imgUrl(it.before)), h('figcaption', null, t('baBeforeTag'))), h('figure', null, thumbEl(imgUrl(it.after)), h('figcaption', null, t('baAfterTag')))),
    h('p', null, h('strong', null, it.caption.es || it.alt.es))))) : h('p', null, t('empty')));
  if (hid(st.beforeAfter)) root.append(h('p', { class: 'help' }, t('prevHiddenNote', { n: hid(st.beforeAfter) })));
  root.append(h('h2', null, t('prevReviews')));
  const r = vis(st.reviews);
  root.append(r.length ? h('div', null, r.map((it) => h('div', { class: 'quote' }, h('p', null, it.text.es), h('p', null, h('strong', null, it.name))))) : h('p', null, t('empty')));
  if (hid(st.reviews)) root.append(h('p', { class: 'help' }, t('prevHiddenNote', { n: hid(st.reviews) })));
  return root;
}

register('preview', (p) => {
  const root = h('div');
  const v = validateState(S.state);
  const names = SEC_NAME();
  const errs = p.serverErrors ? locateServerErrors(p.serverErrors, v.map) : v.errores;
  root.append(h('h1', null, t('prevTitle')));
  if (p.error) root.append(msg('error', p.error));
  if (errs.length) {
    const sections = [...new Set(errs.map((e) => e.section).filter(Boolean))];
    root.append(h('div', { class: 'msg msg-error', role: 'alert' }, h('p', null, t('fixFirst')),
      h('ul', null, errs.slice(0, 12).map((e) => h('li', null, `${names[e.section] || ''}${e.index >= 0 ? ` (${e.index + 1})` : ''}: ${e.mensaje}`)))));
    app.ui.attempted = true;
    root.append(h('div', { class: 'stack' }, sections.map((s) => h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: () => go(SEC_SCREEN[s]) }, `${t('goFix')}: ${names[s]}`))),
      h('button', { class: 'btn-link', type: 'button', onclick: () => go('home') }, t('keepEditing')));
    return root;
  }
  const ch = changesFor();
  const lines = [];
  for (const k of ['gallery', 'beforeAfter', 'reviews']) if (hasChange(ch[k])) lines.push(`${names[k]}: ${describeDiff(ch[k])}`);
  if (ch.settings) lines.push(t('prevSettingsChanged'));
  const any = lines.length > 0 || S.isFirst;
  root.append(h('h2', null, t('prevChanges')));
  root.append(lines.length ? h('ul', null, lines.map((l) => h('li', null, l))) : h('p', null, t('prevNoChanges')));
  root.append(previewBody());
  const go1 = h('button', { class: 'btn btn-primary btn-big', type: 'button', disabled: !any, onclick: async () => { go1.disabled = true; go1.textContent = t('publishing'); await publish(); } }, t('publishNow'));
  const row = h('div', { class: 'stack' }, go1);
  if (p.conflict) row.prepend(h('button', { class: 'btn btn-secondary btn-big', type: 'button', onclick: () => app.reload() }, t('reload')));
  row.append(h('button', { class: 'btn btn-secondary btn-big', type: 'button', onclick: () => go('home') }, t('keepEditing')));
  root.append(row);
  return root;
});

export function startPublish() {
  app.ui.attempted = true;
  go('preview');
}

async function publish() {
  const v = validateState(S.state);
  if (!v.ok) { go('preview'); return; }
  try {
    const content = await app.api.putContent(v.payload, S.isFirst ? 'none' : S.baseVersion);
    setBase(content, { version: content.version });
    await clearDraft();
    app.ui.attempted = false; app.ui.touched.clear(); app.ui.flash = '';
    go('done');
    announce(t('published'));
  } catch (e) {
    const text = apiErrorMessage(e, 'publish');
    if (e.status === 422 && e.body && Array.isArray(e.body.errores)) go('preview', { serverErrors: e.body.errores, error: text });
    else { await saveNow(); go('preview', { error: text, conflict: e.status === 409 }); }
  }
}

register('done', () => h('div', null,
  h('h1', null, t('published')),
  msg('ok', t('published')),
  h('div', { class: 'stack' },
    h('a', { class: 'btn btn-primary btn-big', href: SITE_GALLERY_URL, target: '_blank', rel: 'noopener' }, t('publishedLink')),
    h('button', { class: 'btn btn-secondary btn-big', type: 'button', onclick: () => go('home') }, t('publishedBack')))));

// ---- Historial y deshacer ----
const fmtDate = (iso, fallback) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? (fallback || '') : d.toLocaleString('es-US', { dateStyle: 'long', timeStyle: 'short' });
};
function summaryText(r) {
  if (!r) return t('histNoSummary');
  const names = SEC_NAME(), out = [];
  for (const k of ['gallery', 'beforeAfter', 'reviews']) {
    const s = r[k];
    if (s) { const d = describeDiff({ added: s.added, removed: s.removed, modified: s.modified, moved: s.reordered }); if (d) out.push(`${names[k]}: ${d}`); }
  }
  if (r.settings) out.push(t('prevSettingsChanged'));
  return out.length ? out.join('. ') : t('histNoSummary');
}

async function doRestore(version, doneMsg) {
  const content = await app.api.restore(version);
  setBase(content, { version: content.version });
  await clearDraft();
  app.ui.attempted = false; app.ui.touched.clear();
  app.ui.flash = doneMsg;
  go('home');
  announce(doneMsg);
}

function loadHistory(p, render2) {
  if (p.versions || p.loading) return;
  p.loading = true;
  app.api.history().then((r) => { p.versions = r.versiones || []; p.loading = false; if (app.params === p) render(); })
    .catch((e) => { p.error = apiErrorMessage(e, 'load'); p.loading = false; if (app.params === p) render(); });
}

register('history', (p) => {
  loadHistory(p);
  const root = h('div', null, backButton(), h('h1', null, t('histTitle')));
  if (p.error) return (root.append(msg('error', p.error), h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: () => go('history') }, t('retry'))), root);
  if (!p.versions) return (root.append(h('p', { class: 'loading' }, t('loading'))), root);
  if (p.restoreError) root.append(msg('error', p.restoreError));
  if (!p.versions.length) return (root.append(msg('', t('histEmpty'))), root);
  root.append(h('ul', { class: 'hist' }, p.versions.map((v) => {
    const li = h('li', null,
      h('p', null, h('strong', null, fmtDate(v.updatedAt, v.version))),
      v.updatedBy ? h('p', null, t('histBy', { who: v.updatedBy })) : null,
      h('p', null, summaryText(v.resumen)),
      v.restauradaDe ? h('p', { class: 'help' }, t('histRestoredFrom')) : null);
    if (v.actual) { li.append(h('span', { class: 'tag' }, t('histCurrent'))); return li; }
    if (p.confirm === v.version) {
      li.append(h('div', { class: 'confirm', role: 'alertdialog' }, h('p', null, t('histConfirm', { date: fmtDate(v.updatedAt, v.version) }) + (isDirty() ? t('histConfirmDirty') : '')),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { try { await doRestore(v.version, t('histRestored')); } catch (e) { p.confirm = null; p.restoreError = apiErrorMessage(e, 'restore'); render(); } } }, t('histYes')),
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { p.confirm = null; render(); } }, t('cancel')))));
    } else li.append(h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { p.confirm = v.version; p.restoreError = ''; render(); } }, t('histRestore')));
    return li;
  })));
  return root;
});

register('undo', (p) => {
  loadHistory(p);
  const root = h('div', null, backButton(), h('h1', null, t('actUndo')));
  if (p.error) return (root.append(msg('error', p.error), h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: () => go('undo') }, t('retry'))), root);
  if (!p.versions) return (root.append(h('p', { class: 'loading' }, t('loading'))), root);
  const i = p.versions.findIndex((v) => v.actual);
  const prev = i >= 0 ? p.versions[i + 1] : null;
  if (!prev) return (root.append(msg('', t('undoNone'))), root);
  if (p.restoreError) root.append(msg('error', p.restoreError));
  root.append(msg('', t('undoConfirm', { date: fmtDate(prev.updatedAt, prev.version) }) + (isDirty() ? t('histConfirmDirty') : '')),
    h('div', { class: 'stack' },
      h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: async () => { try { await doRestore(prev.version, t('undoDone')); } catch (e) { p.restoreError = apiErrorMessage(e, 'restore'); render(); } } }, t('undoYes')),
      h('button', { class: 'btn btn-secondary btn-big', type: 'button', onclick: () => go('home') }, t('cancel'))));
  return root;
});
