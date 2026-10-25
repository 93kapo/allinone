// Datos del negocio y Reseñas.
import { h } from './dom.js';
import { t } from './i18n.js';
import { app, register, render, field, selectField, itemError, controls, backButton, msg, announce } from './app.js';
import { S, set, touch } from './store.js';
import { addItem, makeId, updateItem } from './lib/listops.js';

register('settings', () => {
  const st = S.state.settings;
  const upd = (patch) => { S.state.settings = { ...S.state.settings, ...patch }; touch(); };
  const social = (net, label, example) => field({
    label, value: st.social[net], type: 'url', inputmode: 'url', autocomplete: 'off', section: 'settings', id: '', name: `social.${net}`,
    help: example, onInput: (v) => { S.state.settings = { ...S.state.settings, social: { ...S.state.settings.social, [net]: v } }; touch(); },
  });
  const sw = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': st.showLicensed ? 'true' : 'false', 'aria-describedby': 'lic-warn', onclick: () => {
    upd({ showLicensed: !S.state.settings.showLicensed }); render();
  } }, h('span', { class: 'knob', 'aria-hidden': 'true' }), t('setLicensed'));
  return h('div', null,
    backButton(), h('h1', null, t('setTitle')),
    field({ label: t('setEmail'), value: st.email, type: 'email', inputmode: 'email', autocomplete: 'off', max: 100, section: 'settings', id: '', name: 'email', onInput: (v) => upd({ email: v }) }),
    h('h2', null, t('setSocial')), h('p', { class: 'help' }, t('setSocialHint')),
    social('facebook', t('setFacebook'), 'https://www.facebook.com/sunegocio'),
    social('instagram', t('setInstagram'), 'https://www.instagram.com/sunegocio'),
    social('google', t('setGoogle'), 'https://maps.app.goo.gl/…'),
    social('youtube', t('setYoutube'), 'https://www.youtube.com/@sucanal'),
    social('tiktok', t('setTiktok'), 'https://www.tiktok.com/@sunegocio'),
    h('h2', null, t('setLicensed')),
    sw, h('p', { class: 'msg msg-warn', id: 'lic-warn' }, t('setLicensedWarn')),
    field({ label: t('setLicenseNum'), value: st.licenseNumber, max: 20, upper: true, autocomplete: 'off', section: 'settings', id: '', name: 'licenseNumber', help: t('setLicenseHint'), onInput: (v) => upd({ licenseNumber: v }) }),
    h('p', { class: 'msg' }, t('setPhone')));
});

const SOURCES = () => [['google', t('srcGoogle')], ['facebook', t('srcFacebook')], ['nextdoor', t('srcNextdoor')], ['directo', t('srcDirecto')]];
const nowYM = () => { const d = new Date(); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; };

function reviewCard(r, idx, list) {
  const editing = app.ui.editing.has(r.id);
  const upd = (patch) => set('reviews', updateItem(S.state.reviews, r.id, patch));
  const live = () => S.state.reviews.find((x) => x.id === r.id);
  const label = (d) => { const m = /^(\d{4})-(\d{2})$/.exec(d || ''); return m ? `${t('months')[+m[2] - 1]} ${m[1]}` : ''; };
  const src = (SOURCES().find(([v]) => v === r.source) || ['', ''])[1];
  const toggle = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { if (editing) app.ui.editing.delete(r.id); else app.ui.editing.add(r.id); render(); } }, editing ? t('revDone') : t('revEdit'));
  const head = h('div', null,
    r.hidden ? h('span', { class: 'tag tag-hidden' }, t('hiddenTagM')) : null,
    h('p', null, h('strong', null, r.name || t('noTitle')), src || r.date ? ` · ${[src, label(r.date)].filter(Boolean).join(' · ')}` : ''),
    editing ? null : h('div', { class: 'quote' }, r.text.es));
  const form = editing ? h('div', null,
    field({ label: t('revName'), value: r.name, max: 40, section: 'reviews', id: r.id, name: 'name', onInput: (v) => upd({ name: v }) }),
    field({ label: t('revTextEs'), value: r.text.es, max: 600, multiline: true, section: 'reviews', id: r.id, name: 'text.es', onInput: (v) => upd({ text: { ...live().text, es: v } }) }),
    field({ label: t('revTextEn'), value: r.text.en, max: 600, multiline: true, section: 'reviews', id: r.id, name: 'text.en', onInput: (v) => upd({ text: { ...live().text, en: v } }) }),
    selectField({ label: t('revSource'), value: r.source, options: SOURCES(), placeholder: t('chooseCategory'), section: 'reviews', id: r.id, name: 'source', onChange: (v) => upd({ source: v }) }),
    h('div', { class: 'row' },
      selectField({ label: t('revMonth'), value: (r.date || '').slice(5, 7), options: t('months').map((m, i) => [String(i + 1).padStart(2, '0'), m]), section: 'reviews', id: r.id, name: 'date', onChange: (v) => upd({ date: `${(live().date || '').slice(0, 4) || nowYM().y}-${v}` }) }),
      selectField({ label: t('revYear'), value: (r.date || '').slice(0, 4), options: Array.from({ length: 12 }, (_, i) => [String(nowYM().y - i), String(nowYM().y - i)]), section: 'reviews', id: r.id, name: 'date-year', onChange: (v) => upd({ date: `${v}-${(live().date || '').slice(5, 7) || String(nowYM().m).padStart(2, '0')}` }) }))) : null;
  return h('article', { class: `card${r.hidden ? ' is-hidden' : ''}` }, head, form, itemError('reviews', r.id),
    controls('reviews', r, idx, list, { confirmText: t('confirmRemoveReview', { name: r.name || t('noTitle') }), extra: [toggle] }));
}

register('reviews', () => {
  const list = S.state.reviews;
  const add = h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: () => {
    const { y, m } = nowYM();
    const id = makeId(new Set(list.map((x) => x.id)));
    set('reviews', addItem(S.state.reviews, { id, name: '', text: { es: '', en: '' }, source: '', date: `${y}-${String(m).padStart(2, '0')}`, hidden: false }, { atStart: true }));
    app.ui.editing.add(id);
    render(); announce(t('revAdd'));
  } }, t('revAdd'));
  return h('div', null, backButton(), h('h1', null, t('revTitle')), msg('warn', t('revWarn')), add,
    !list.length ? h('p', { class: 'msg' }, t('empty')) : null,
    h('div', null, list.map((r, i) => reviewCard(r, i, list))));
});
