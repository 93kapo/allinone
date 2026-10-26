import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContent, cleanText, MAX_GALLERY } from '../src/schema.js';
import { findOrphans, sniffImage } from '../src/media.js';
import { validContent } from './helpers.js';

const NOW = new Date('2026-10-24T12:00:00Z');
const UUID = '123e4567-e89b-42d3-a456-426614174000';
const KEY = `media/${UUID}.jpg`;
const v = (c, mediaKeys = new Set()) => validateContent(c, { mediaKeys, now: NOW });
const bad = (c, campo, mk) => {
  const r = v(c, mk);
  assert.equal(r.ok, false, 'debía fallar: ' + campo);
  assert.ok(r.errores.some((e) => e.campo === campo), `esperaba error en ${campo}; hubo ${JSON.stringify(r.errores)}`);
  for (const e of r.errores) assert.ok(typeof e.mensaje === 'string' && e.mensaje.length > 0);
};

test('contenido válido pasa y se completa (ids, alt por defecto)', () => {
  const r = v(validContent());
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  assert.equal(r.value.gallery[0].alt.es, 'Cocina');
  assert.equal(r.value.gallery[0].hidden, false);
  assert.equal(r.value.settings.social.instagram, '');
});

test('genera ids faltantes y únicos', () => {
  const c = validContent();
  delete c.gallery[0].id;
  c.gallery.push({ type: 'youtube', category: 'exterior', youtubeId: 'dQw4w9WgXcQ', caption: { es: 'Video' } });
  const r = v(c);
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  assert.notEqual(r.value.gallery[0].id, r.value.gallery[1].id);
  assert.ok(r.value.gallery[0].id.length >= 8);
});

test('claves desconocidas, __proto__, constructor, prototype', () => {
  bad({ ...validContent(), extra: 1 }, 'extra');
  bad(JSON.parse('{"__proto__":{"x":1},"settings":{},"gallery":[],"beforeAfter":[],"reviews":[]}'), '__proto__');
  const c = validContent(); c.gallery[0] = JSON.parse('{"__proto__":{"admin":true}}');
  bad(c, 'gallery[0].__proto__');
  const d = validContent(); d.settings.constructor = {}; bad(d, 'settings.constructor');
  const e = validContent(); e.reviews[0].prototype = 1; bad(e, 'reviews[0].prototype');
  bad(JSON.parse('{"settings":{"social":{"__proto__":"x"}},"gallery":[],"beforeAfter":[],"reviews":[]}'), 'settings.social.__proto__');
});

test('"<script>" y "<" ">" rechazados en cualquier texto', () => {
  let c = validContent(); c.gallery[0].caption.es = '<script>alert(1)</script>'; bad(c, 'gallery[0].caption.es');
  c = validContent(); c.reviews[0].name = 'a>b'; bad(c, 'reviews[0].name');
  c = validContent(); c.reviews[0].text.en = '<img src=x>'; bad(c, 'reviews[0].text.en');
  c = validContent(); c.settings.email = 'a<b@x.com'; bad(c, 'settings.email');
});

test('redes: javascript:, data:, http:, otro dominio, parecidos', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'http://facebook.com/x', 'https://evil.com/facebook.com',
    'https://facebook.com.evil.com/x', 'https://evilfacebook.com', 'https://user:pw@facebook.com/x', 'https://facebook.com:8443/x',
    '//facebook.com/x', 'https://facebоok.com/x', 'https://instagram.com/x']) {
    const c = validContent(); c.settings.social.facebook = url; bad(c, 'settings.social.facebook');
  }
  const c = validContent(); c.settings.social.nadie = 'https://x.com'; bad(c, 'settings.social.nadie');
});

test('redes: dominios permitidos y subdominios www/m', () => {
  const c = validContent();
  c.settings.social = {
    facebook: 'https://m.facebook.com/allin1', instagram: 'https://www.instagram.com/allin1', google: 'https://maps.app.goo.gl/abc',
    youtube: 'https://youtu.be/dQw4w9WgXcQ', tiktok: 'https://www.tiktok.com/@allin1',
  };
  const r = v(c);
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  c.settings.social.google = 'https://g.page/allin1';
  assert.equal(v(c).ok, true);
  c.settings.social.google = 'https://sub.google.com/x';
  bad(c, 'settings.social.google');
});

test('textos largos', () => {
  let c = validContent(); c.gallery[0].caption.es = 'a'.repeat(81); bad(c, 'gallery[0].caption.es');
  c = validContent(); c.gallery[0].alt = { es: 'a'.repeat(161) }; bad(c, 'gallery[0].alt.es');
  c = validContent(); c.reviews[0].text.es = 'a'.repeat(601); bad(c, 'reviews[0].text.es');
  c = validContent(); c.reviews[0].name = 'a'.repeat(41); bad(c, 'reviews[0].name');
  c = validContent(); c.settings.email = 'a'.repeat(95) + '@x.com'; bad(c, 'settings.email');
  c = validContent(); c.gallery[0].caption.es = 'a'.repeat(80); assert.equal(v(c).ok, true);
  c = validContent(); c.gallery[0].caption.es = '   '; bad(c, 'gallery[0].caption.es');
});

test('10,000 elementos y demás topes de cantidad / tamaño', () => {
  const item = (i) => ({ id: `g${i}`, type: 'image', category: 'interior', src: 'assets/gallery/a.jpg', w: 1, h: 1, caption: { es: 'x' } });
  assert.equal(v(validContent({ gallery: Array.from({ length: 10000 }, (_, i) => item(i)) })).ok, false);
  bad(validContent({ gallery: Array.from({ length: MAX_GALLERY + 1 }, (_, i) => item(i)) }), 'gallery');
  assert.equal(v(validContent({ gallery: Array.from({ length: MAX_GALLERY }, (_, i) => item(i)) })).ok, true);
  bad(validContent({ reviews: Array.from({ length: 31 }, (_, i) => ({ id: `r${i}`, name: 'a', text: { es: 'b' }, source: 'google', date: '2026-01' })) }), 'reviews');
  bad(validContent({ beforeAfter: Array.from({ length: 31 }, (_, i) => ({ id: `b${i}`, before: 'assets/gallery/a.jpg', after: 'assets/gallery/b.jpg', alt: { es: 'x' } })) }), 'beforeAfter');
  const big = validContent(); big.settings.email = ''; big.padding = 'x'.repeat(300 * 1024);
  bad(big, '');
});

test('tipos erróneos', () => {
  bad(validContent({ gallery: 'hola' }), 'gallery');
  bad(validContent({ settings: [] }), 'settings');
  bad([], '');
  bad(null, '');
  let c = validContent(); c.gallery[0].w = '800'; bad(c, 'gallery[0].w');
  c = validContent(); c.gallery[0].w = 0; bad(c, 'gallery[0].w');
  c = validContent(); c.gallery[0].h = 4001; bad(c, 'gallery[0].h');
  c = validContent(); c.gallery[0].h = 1.5; bad(c, 'gallery[0].h');
  c = validContent(); c.gallery[0].hidden = 'si'; bad(c, 'gallery[0].hidden');
  c = validContent(); c.gallery[0].category = 'jardin'; bad(c, 'gallery[0].category');
  c = validContent(); c.gallery[0].type = 'video'; bad(c, 'gallery[0].src');
  c = validContent(); c.gallery[0].caption.es = 5; bad(c, 'gallery[0].caption.es');
  c = validContent(); c.gallery = [5]; bad(c, 'gallery[0]');
  c = validContent(); c.settings.showLicensed = 'yes'; bad(c, 'settings.showLicensed');
  c = validContent(); c.settings.licenseNumber = 'abc def'; bad(c, 'settings.licenseNumber');
  c = validContent(); c.reviews[0].source = 'yelp'; bad(c, 'reviews[0].source');
  c = validContent(); c.reviews[0].date = '2026-13'; bad(c, 'reviews[0].date');
  c = validContent(); c.reviews[0].date = '2026-11'; bad(c, 'reviews[0].date'); // futuro respecto a NOW
  c = validContent(); c.reviews[0].date = '2026-10'; assert.equal(v(c).ok, true);
  c = validContent(); c.schemaVersion = 2; bad(c, 'schemaVersion');
  c = validContent(); delete c.reviews; bad(c, 'reviews');
  c = validContent(); c.gallery[0].youtubeId = 'dQw4w9WgXcQ'; bad(c, 'gallery[0].youtubeId');
  c = validContent(); c.gallery.push({ type: 'youtube', category: 'interior', youtubeId: 'corto', caption: { es: 'v' } }); bad(c, 'gallery[1].youtubeId');
});

test('ids duplicados o inválidos', () => {
  const c = validContent();
  c.gallery.push({ ...c.gallery[0] });
  bad(c, 'gallery[1].id');
  const d = validContent(); d.reviews[0].id = 'a b'; bad(d, 'reviews[0].id');
  const e = validContent(); e.reviews.push({ ...e.reviews[0] }); bad(e, 'reviews[1].id');
});

test('claves de media: deben existir en el manifiesto; rutas assets seguras', () => {
  let c = validContent(); c.gallery[0].src = KEY;
  bad(c, 'gallery[0].src'); // no está en el manifiesto
  assert.equal(v(c, new Set([KEY])).ok, true);
  for (const src of ['media/../../etc/passwd', 'media/x.jpg', `media/${UUID}.svg`, `media/${UUID}.jpg/..`, 'https://evil.com/a.jpg',
    'assets/gallery/../../x.jpg', 'assets/gallery/a/b.jpg', 'assets/gallery/a.svg', 'assets/gallery/', '/assets/gallery/a.jpg', 'javascript:1']) {
    c = validContent(); c.gallery[0].src = src; bad(c, 'gallery[0].src', new Set([src]));
  }
  c = validContent(); c.gallery[0].poster = KEY; bad(c, 'gallery[0].poster');
  c = validContent(); c.beforeAfter = [{ id: 'b1', before: KEY, after: 'assets/gallery/ba-1-after.jpg', alt: { es: 'x' } }];
  bad(c, 'beforeAfter[0].before');
  assert.equal(v(c, new Set([KEY])).ok, true);
  c.beforeAfter[0].alt = {}; bad(c, 'beforeAfter[0].alt.es', new Set([KEY]));
});

test('normalización: NFC, control, bidi, espacios', () => {
  assert.equal(cleanText('  é‮‏\u0007x\n y  '), 'éx y');
  const c = validContent(); c.gallery[0].caption.es = ' Cocina‮x⁦ ';
  const r = v(c);
  assert.equal(r.value.gallery[0].caption.es, 'Cocinax');
});

test('el esquema devuelve errores en español con campo y mensaje', () => {
  const c = validContent(); c.gallery[0].caption.es = '';
  const r = v(c);
  assert.deepEqual(Object.keys(r.errores[0]).sort(), ['campo', 'mensaje']);
  assert.match(r.errores[0].mensaje, /obligatorio/);
});

test('firma de imagen y huérfanos (función pura v2)', () => {
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0]))?.ext, 'jpg');
  assert.equal(sniffImage(new TextEncoder().encode('<svg xmlns=""/>')), null);
  assert.equal(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBP'))?.ext, 'webp');
  assert.equal(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WAVE')), null);
  const items = [
    { key: 'a', at: '2026-01-01T00:00:00Z', used: false },
    { key: 'b', at: '2026-10-20T00:00:00Z', used: false },
    { key: 'c', at: '2026-01-01T00:00:00Z', used: true },
  ];
  assert.deepEqual(findOrphans(items, NOW, 30), ['a']);
});

test('encuadre opcional: contenido viejo sigue válido; valores válidos se conservan', () => {
  const c = validContent({ beforeAfter: [{ id: 'b1', before: 'assets/gallery/a.jpg', after: 'assets/gallery/b.jpg', alt: { es: 'x' } }] });
  const r = v(c);
  assert.equal(r.ok, true);
  for (const k of ['focusBefore', 'focusAfter', 'zoomBefore', 'zoomAfter', 'shape']) assert.equal(k in r.value.beforeAfter[0], false, 'sin valores por defecto inventados');
  const c2 = validContent({ beforeAfter: [{ id: 'b1', before: 'assets/gallery/a.jpg', after: 'assets/gallery/b.jpg', alt: { es: 'x' },
    focusBefore: { x: 0, y: 100 }, focusAfter: { x: 50, y: 33 }, zoomBefore: 1, zoomAfter: 2.456, shape: 'tall' }] });
  const r2 = v(c2);
  assert.equal(r2.ok, true, JSON.stringify(r2.errores));
  assert.deepEqual(r2.value.beforeAfter[0].focusBefore, { x: 0, y: 100 });
  assert.equal(r2.value.beforeAfter[0].zoomAfter, 2.46);
  assert.equal(r2.value.beforeAfter[0].shape, 'tall');
  for (const s of ['wide', 'tall', 'square']) assert.equal(v(validContent({ beforeAfter: [{ id: 'b', before: 'assets/gallery/a.jpg', after: 'assets/gallery/b.jpg', alt: { es: 'x' }, shape: s }] })).ok, true);
  const g = validContent(); g.gallery[0].focus = { x: 20, y: 80 };
  assert.deepEqual(v(g).value.gallery[0].focus, { x: 20, y: 80 });
});

test('encuadre: valores fuera de rango, tipos raros y claves extra se rechazan', () => {
  const ba = (extra) => validContent({ beforeAfter: [{ id: 'b', before: 'assets/gallery/a.jpg', after: 'assets/gallery/b.jpg', alt: { es: 'x' }, ...extra }] });
  for (const f of [{ x: -1, y: 0 }, { x: 101, y: 0 }, { x: 5.5, y: 0 }, { x: '5', y: 0 }, { x: 5 }, { y: 5 }, {}, 'centro', [50, 50], 7, { x: NaN, y: 1 }, { x: 1, y: Infinity }]) {
    bad(ba({ focusBefore: f }), 'beforeAfter[0].focusBefore');
    bad(ba({ focusAfter: f }), 'beforeAfter[0].focusAfter');
  }
  for (const z of [0.99, 3.01, 0, -1, '2', NaN, Infinity, [], {}, true]) { bad(ba({ zoomBefore: z }), 'beforeAfter[0].zoomBefore'); bad(ba({ zoomAfter: z }), 'beforeAfter[0].zoomAfter'); }
  for (const s of ['Wide', 'ancha', '', 1, [], {}, true]) bad(ba({ shape: s }), 'beforeAfter[0].shape');
  bad(ba({ focus: { x: 1, y: 1 } }), 'beforeAfter[0].focus'); // clave que no existe en pares
  bad(ba({ zoom: 2 }), 'beforeAfter[0].zoom');
  bad(ba({ focusBefore: { x: 1, y: 1, z: 2 } }), 'beforeAfter[0].focusBefore.z');
  const g = (f) => { const c = validContent(); c.gallery[0].focus = f; return c; };
  bad(g({ x: 101, y: 0 }), 'gallery[0].focus'); bad(g('x'), 'gallery[0].focus'); bad(g({ x: 1, y: 1.5 }), 'gallery[0].focus');
  const z = validContent(); z.gallery[0].zoom = 2; bad(z, 'gallery[0].zoom');
});
