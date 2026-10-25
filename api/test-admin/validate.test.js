import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPayload, validateState, locateError } from '../admin/js/lib/validate.js';
import { validateContent } from '../src/schema.js';
import { normalize } from '../admin/js/store.js';
import { readFileSync } from 'node:fs';

const NOW = new Date('2026-10-24T12:00:00Z');
const UUID = '0b8b5f2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b';
const base = () => ({
  settings: { email: 'info@example.com', social: { facebook: '', instagram: '', google: '', youtube: '', tiktok: '' }, showLicensed: false, licenseNumber: '' },
  gallery: [{ id: 'g1', type: 'image', category: 'interior', src: `media/${UUID}.jpg`, poster: `media/${UUID}-t.jpg`, w: 1600, h: 1200, caption: { es: 'Cocina', en: '' }, alt: { es: '', en: '' }, hidden: false }],
  beforeAfter: [],
  reviews: [],
});
const withSettings = (p) => { const s = base(); s.settings = { ...s.settings, ...p }; return s; };
const errs = (s) => validateState(s, NOW).errores;

test('estado válido pasa', () => { assert.deepEqual(errs(base()), []); });

test('el payload nunca lleva campos internos ni tipos desconocidos', () => {
  const s = base();
  s.gallery.push({ id: 'v1', type: 'gif', category: 'exterior', src: 'assets/gallery/a.gif', caption: { es: 'Viejo' } });
  s.gallery[0]._borrar = 1;
  const { payload, dropped, map } = buildPayload(s);
  assert.equal(payload.gallery.length, 1);
  assert.equal(dropped.length, 1);
  assert.deepEqual(map.gallery, ['g1']);
  assert.equal('_borrar' in payload.gallery[0], false);
  assert.equal('alt' in payload.gallery[0], false);
  assert.equal(validateContent(payload, { now: NOW, mediaKeys: new Set([`media/${UUID}.jpg`, `media/${UUID}-t.jpg`]) }).ok, true);
});

test('título obligatorio, categoría obligatoria, ≤80', () => {
  let s = base(); s.gallery[0].caption.es = '   ';
  let e = errs(s); assert.equal(e[0].campo, 'gallery[0].caption.es'); assert.equal(e[0].section, 'gallery'); assert.equal(e[0].id, 'g1');
  s = base(); s.gallery[0].category = '';
  assert.equal(errs(s)[0].campo, 'gallery[0].category');
  s = base(); s.gallery[0].caption.es = 'x'.repeat(81);
  assert.equal(errs(s)[0].campo, 'gallery[0].caption.es');
  s = base(); s.gallery[0].caption.es = 'x'.repeat(80);
  assert.deepEqual(errs(s), []);
  s = base(); s.gallery[0].caption.es = 'a<b';
  assert.equal(errs(s)[0].campo, 'gallery[0].caption.es');
});

test('redes: https y dominio oficial (igual que el Worker)', () => {
  const ok = { facebook: 'https://www.facebook.com/allin1', instagram: 'https://instagram.com/allin1', google: 'https://maps.app.goo.gl/abc', youtube: 'https://youtu.be/x', tiktok: 'https://www.tiktok.com/@a' };
  assert.deepEqual(errs(withSettings({ social: ok })), []);
  for (const [net, bad] of [
    ['facebook', 'http://facebook.com/a'], ['facebook', 'https://facebook.com.evil.com/a'], ['facebook', 'https://evil.com/facebook.com'],
    ['instagram', 'javascript:alert(1)'], ['tiktok', 'https://user:pw@tiktok.com/a'], ['google', 'https://google.com:8443/a'],
    ['youtube', 'https://vimeo.com/a'], ['facebook', 'https://facebook.com/a b'], ['facebook', 'facebook.com/a'],
  ]) {
    const e = errs(withSettings({ social: { ...ok, [net]: bad } }));
    assert.equal(e.length, 1, bad);
    assert.equal(e[0].campo, `settings.social.${net}`, bad);
    assert.equal(e[0].section, 'settings');
    assert.equal(e[0].field, `social.${net}`);
  }
});

test('licencia: A-Z, 0-9 y guion, hasta 20', () => {
  assert.deepEqual(errs(withSettings({ licenseNumber: 'CGC-123456' })), []);
  assert.deepEqual(errs(withSettings({ licenseNumber: '' })), []);
  for (const bad of ['cgc-1', 'CGC 1', 'CGC_1', 'A'.repeat(21), 'CGC<1>']) assert.equal(errs(withSettings({ licenseNumber: bad }))[0].campo, 'settings.licenseNumber', bad);
});

test('correo del negocio', () => {
  assert.deepEqual(errs(withSettings({ email: '' })), []);
  assert.equal(errs(withSettings({ email: 'sin-arroba' }))[0].campo, 'settings.email');
});

test('antes y después: fotos y título en español obligatorios', () => {
  const s = base();
  s.beforeAfter = [{ id: 'b1', before: `media/${UUID}.jpg`, after: 'assets/gallery/ba-1-after.jpg', caption: { es: 'Puerta', en: '' }, alt: { es: '', en: '' }, hidden: false }];
  assert.deepEqual(errs(s), []);
  s.beforeAfter[0].caption.es = '';
  assert.equal(errs(s)[0].campo, 'beforeAfter[0].alt.es');
  s.beforeAfter[0].caption.es = 'ok'; s.beforeAfter[0].after = '';
  assert.equal(errs(s)[0].campo, 'beforeAfter[0].after');
});

test('reseñas: nombre ≤40, texto ≤600, fuente, fecha no futura', () => {
  const r = (o) => { const s = base(); s.reviews = [{ id: 'r1', name: 'María G., Mandarin', text: { es: 'Muy buen trabajo', en: '' }, source: 'google', date: '2026-03', hidden: false, ...o }]; return errs(s); };
  assert.deepEqual(r({}), []);
  assert.equal(r({ name: 'x'.repeat(41) })[0].campo, 'reviews[0].name');
  assert.equal(r({ name: '' })[0].campo, 'reviews[0].name');
  assert.equal(r({ text: { es: 'x'.repeat(601), en: '' } })[0].campo, 'reviews[0].text.es');
  assert.equal(r({ text: { es: '', en: 'ok' } })[0].campo, 'reviews[0].text.es');
  assert.equal(r({ source: 'yelp' })[0].campo, 'reviews[0].source');
  assert.deepEqual(r({ source: 'directo' }), []);
  assert.equal(r({ date: '2026-11' })[0].campo, 'reviews[0].date');
  assert.deepEqual(r({ date: '2026-10' }), []);
  assert.equal(r({ date: '2026-13' })[0].campo, 'reviews[0].date');
});

test('YouTube en la galería', () => {
  const s = base();
  s.gallery.push({ id: 'y1', type: 'youtube', category: 'exterior', youtubeId: 'dQw4w9WgXcQ', w: 1280, h: 720, caption: { es: 'Video', en: '' }, hidden: false });
  assert.deepEqual(errs(s), []);
  s.gallery[1].youtubeId = 'corto';
  assert.equal(errs(s)[0].campo, 'gallery[1].youtubeId');
});

test('locateError', () => {
  const map = { gallery: ['a', 'b'], beforeAfter: [], reviews: ['r'] };
  assert.deepEqual(locateError('gallery[1].caption.es', map), { section: 'gallery', index: 1, id: 'b', field: 'caption.es' });
  assert.deepEqual(locateError('reviews[0]', map), { section: 'reviews', index: 0, id: 'r', field: '' });
  assert.equal(locateError('settings.social.tiktok', map).field, 'social.tiktok');
  assert.equal(locateError('', map).section, '');
});

test('videos: el item video se envía con src y cartel; el heredado de la semilla pasa', () => {
  const UUIDV = '0b8b5f2e-1c3d-4e5f-8a9b-0c1d2e3f4a5c';
  const s = base();
  s.gallery.push({ id: 'v1', type: 'video', category: 'interior', src: `media/${UUIDV}.mp4`, poster: `media/${UUIDV}-p.jpg`, w: 720, h: 1280, caption: { es: 'Recorrido', en: '' }, alt: { es: '', en: '' }, hidden: false });
  const { payload, dropped } = buildPayload(s);
  assert.equal(dropped.length, 0);
  assert.equal(payload.gallery[1].type, 'video');
  assert.equal(payload.gallery[1].src, `media/${UUIDV}.mp4`);
  assert.equal('youtubeId' in payload.gallery[1], false);
  assert.deepEqual(errs(s), []);
  s.gallery[1].poster = '';
  assert.equal(errs(s)[0].campo, 'gallery[1].poster');
  const seed = JSON.parse(readFileSync(new URL('../../web/assets/content-seed.json', import.meta.url), 'utf8'));
  const st = normalize(seed);
  assert.deepEqual(validateState(st, NOW).errores.map((e) => e.campo), ['gallery[0].caption.es'].filter(() => false));
  assert.equal(buildPayload(st).payload.gallery[0].src, 'assets/gallery/allin1.mp4');
});
