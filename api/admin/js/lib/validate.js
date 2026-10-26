// Arma lo que se envía al Worker y lo valida con el MISMO validador del Worker (js/schema.js
// es una copia exacta de src/schema.js; una prueba comprueba que son idénticas).
import { validateContent, collectMediaKeys } from '../schema.js';
import { framingFields } from './framing.js';

const SOCIALS = ['facebook', 'instagram', 'google', 'youtube', 'tiktok'];
const pubKeys = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));
const pair = (p) => ({ es: (p && p.es) || '', en: (p && p.en) || '' });

export function buildPayload(state) {
  const gallery = [], beforeAfter = [], reviews = [], dropped = [];
  const map = { gallery: [], beforeAfter: [], reviews: [] };
  for (const it of state.gallery) {
    if (it.type !== 'image' && it.type !== 'youtube' && it.type !== 'video') { dropped.push(it); continue; } // tipo desconocido
    const o = { id: it.id, type: it.type, category: it.category, caption: pair(it.caption), hidden: !!it.hidden };
    if (it.type === 'image' || it.type === 'video') o.src = it.src; else o.youtubeId = it.youtubeId;
    if (it.poster) o.poster = it.poster;
    if (it.w !== undefined) o.w = it.w;
    if (it.h !== undefined) o.h = it.h;
    if (it.focus) o.focus = { x: it.focus.x, y: it.focus.y };
    const alt = pair(it.alt);
    if (alt.es || alt.en) o.alt = alt;
    gallery.push(o); map.gallery.push(it.id);
  }
  for (const it of state.beforeAfter) {
    const o = { id: it.id, before: it.before, after: it.after, caption: pair(it.caption), hidden: !!it.hidden, ...framingFields(it) };
    const alt = pair(it.alt);
    if (alt.es || alt.en) o.alt = alt;
    beforeAfter.push(o); map.beforeAfter.push(it.id);
  }
  for (const it of state.reviews) {
    reviews.push({ id: it.id, name: it.name, text: pair(it.text), source: it.source, date: it.date, hidden: !!it.hidden });
    map.reviews.push(it.id);
  }
  const s = state.settings || {};
  const social = {};
  for (const n of SOCIALS) social[n] = (s.social && s.social[n]) || '';
  const settings = { email: s.email || '', social, showLicensed: !!s.showLicensed, licenseNumber: s.licenseNumber || '' };
  return { payload: { settings, gallery, beforeAfter, reviews }, map, dropped };
}

// "gallery[2].caption.es" -> { section:'gallery', index:2, id:'abc', field:'caption.es' }
export function locateError(campo, map) {
  let m = /^(gallery|beforeAfter|reviews)\[(\d+)\](?:\.(.*))?$/.exec(campo);
  if (m) return { section: m[1], index: +m[2], id: map[m[1]][+m[2]] || null, field: m[3] || '' };
  m = /^settings(?:\.(.*))?$/.exec(campo);
  if (m) return { section: 'settings', index: -1, id: null, field: m[1] || '' };
  return { section: '', index: -1, id: null, field: campo };
}

export function validateState(state, now = new Date()) {
  const { payload, map, dropped } = buildPayload(state);
  const v = validateContent(payload, { mediaKeys: collectMediaKeys(payload), now });
  const errores = v.errores.map((e) => ({ ...e, ...locateError(e.campo, map) }));
  return { ok: v.ok, errores, payload, map, dropped };
}

// Errores 422 del Worker -> mismo formato que validateState.
export function locateServerErrors(errores, map) {
  return (errores || []).map((e) => ({ ...e, ...locateError(String(e.campo || ''), map) }));
}
