import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseYouTubeId, youtubeThumb } from '../admin/js/lib/youtube.js';
import { fitWithin, PHOTO_MAX, THUMB_MAX } from '../admin/js/lib/imagesize.js';
import { makeId, addItem, moveUp, moveDown, toggleHidden, removeItem, updateItem, setCaption, ids } from '../admin/js/lib/listops.js';
import { isMockAllowed } from '../admin/js/lib/mockgate.js';
import { mediaUrl } from '../admin/js/lib/media-url.js';
import { apiErrorMessage } from '../admin/js/lib/errors.js';
import { diffLists, describeDiff, hasChange } from '../admin/js/lib/changes.js';
import { t } from '../admin/js/i18n.js';

const ID = 'dQw4w9WgXcQ';

test('schema.js del panel es idéntico al del Worker', () => {
  assert.equal(readFileSync(new URL('../admin/js/schema.js', import.meta.url), 'utf8'), readFileSync(new URL('../src/schema.js', import.meta.url), 'utf8'));
});

test('YouTube: formatos aceptados', () => {
  for (const u of [
    `https://youtu.be/${ID}`, `https://youtu.be/${ID}?si=abc`, `youtu.be/${ID}`,
    `https://www.youtube.com/watch?v=${ID}`, `https://youtube.com/watch?v=${ID}&t=10s`, `https://www.youtube.com/watch?feature=share&v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`, `https://www.youtube.com/shorts/${ID}`, `https://youtube.com/shorts/${ID}?feature=share`,
    `https://www.youtube.com/embed/${ID}`, `https://www.youtube.com/live/${ID}`, `  https://youtu.be/${ID}  `, `http://youtu.be/${ID}`,
  ]) assert.equal(parseYouTubeId(u), ID, u);
});

test('YouTube: formatos rechazados', () => {
  for (const u of [
    '', '   ', null, undefined, 42, 'hola', `https://vimeo.com/${ID}`, `https://evil.com/watch?v=${ID}`,
    `https://youtube.com.evil.com/watch?v=${ID}`, `https://evil.com/youtu.be/${ID}`, 'https://youtu.be/corto', `https://youtu.be/${ID}x`,
    'https://www.youtube.com/watch?v=', 'https://www.youtube.com/', 'https://www.youtube.com/channel/UC12345678901', `javascript:alert(1)//youtu.be/${ID}`,
    `ftp://youtu.be/${ID}`, 'https://youtu.be/a b c d e f g', 'https://www.youtube.com/watch?v=abc<script>',
  ]) assert.equal(parseYouTubeId(u), null, String(u));
  assert.equal(parseYouTubeId('x'.repeat(400)), null);
  assert.equal(youtubeThumb(ID), `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
});

test('tamaños: lado largo máximo, sin agrandar, enteros', () => {
  assert.deepEqual(fitWithin(4032, 3024, PHOTO_MAX), { w: 1600, h: 1200 });
  assert.deepEqual(fitWithin(3024, 4032, PHOTO_MAX), { w: 1200, h: 1600 });
  assert.deepEqual(fitWithin(800, 600, PHOTO_MAX), { w: 800, h: 600 });
  assert.deepEqual(fitWithin(1600, 1600, PHOTO_MAX), { w: 1600, h: 1600 });
  assert.deepEqual(fitWithin(4032, 3024, THUMB_MAX), { w: 480, h: 360 });
  assert.deepEqual(fitWithin(10000, 1, 1600), { w: 1600, h: 1 });
  const r = fitWithin(3001, 1999, 1600);
  assert.ok(Number.isInteger(r.w) && Number.isInteger(r.h) && Math.max(r.w, r.h) === 1600);
  assert.throws(() => fitWithin(0, 10, 100));
  assert.throws(() => fitWithin(NaN, 10, 100));
});

test('lista: ids únicos y agregar', () => {
  const seen = new Set();
  let n = 0;
  const rand = () => (n++ < 20 ? 0 : (n * 0.137) % 1); // fuerza choques al inicio
  const used = new Set(['naaaaaaaaaa']);
  for (let i = 0; i < 50; i++) { const id = makeId(used, rand); assert.match(id, /^[A-Za-z0-9_-]{1,40}$/); assert.ok(!used.has(id)); used.add(id); seen.add(id); }
  assert.equal(seen.size, 50);
  const a = [{ id: 'a' }, { id: 'b' }];
  assert.deepEqual(ids(addItem(a, { id: 'c' })), ['a', 'b', 'c']);
  assert.deepEqual(ids(addItem(a, { id: 'c' }, { atStart: true })), ['c', 'a', 'b']);
  assert.throws(() => addItem(a, { id: 'a' }));
  assert.equal(a.length, 2); // no muta
});

test('lista: subir, bajar, ocultar, quitar, actualizar', () => {
  const a = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(ids(moveUp(a, 'b')), ['b', 'a', 'c']);
  assert.deepEqual(ids(moveDown(a, 'b')), ['a', 'c', 'b']);
  assert.deepEqual(ids(moveUp(a, 'a')), ['a', 'b', 'c']);
  assert.deepEqual(ids(moveDown(a, 'c')), ['a', 'b', 'c']);
  assert.deepEqual(ids(moveDown(a, 'zzz')), ['a', 'b', 'c']);
  assert.notEqual(moveUp(a, 'a'), a);
  const h = toggleHidden(a, 'b');
  assert.equal(h[1].hidden, true);
  assert.equal(toggleHidden(h, 'b')[1].hidden, false);
  assert.equal(a[1].hidden, undefined);
  assert.deepEqual(ids(removeItem(a, 'b')), ['a', 'c']);
  assert.deepEqual(ids(removeItem(a, 'x')), ['a', 'b', 'c']);
  assert.equal(updateItem(a, 'c', { category: 'interior' })[2].category, 'interior');
});

test('título: limpia la descripción automática', () => {
  let it = { caption: { es: 'Cocina', en: '' }, alt: { es: 'Cocina', en: 'Cocina' } };
  it = setCaption(it, 'es', 'Cocina nueva');
  assert.deepEqual(it.alt, { es: '', en: '' });
  assert.equal(it.caption.es, 'Cocina nueva');
  const own = setCaption({ caption: { es: 'A', en: 'B' }, alt: { es: 'Descripción larga', en: 'Long text' } }, 'es', 'C');
  assert.equal(own.alt.es, 'Descripción larga');
  assert.equal(setCaption({ caption: { es: 'A', en: 'B' }, alt: { es: 'x', en: 'B' } }, 'en', 'D').alt.en, '');
});

test('modo de prueba: solo en localhost con ?mock=1', () => {
  assert.equal(isMockAllowed({ hostname: 'localhost', search: '?mock=1' }), true);
  assert.equal(isMockAllowed({ hostname: 'localhost', search: '' }), false);
  assert.equal(isMockAllowed({ hostname: 'localhost', search: '?mock=0' }), false);
  assert.equal(isMockAllowed({ hostname: 'admin.allin1jax.com', search: '?mock=1' }), false);
  assert.equal(isMockAllowed({ hostname: 'localhost.evil.com', search: '?mock=1' }), false);
  assert.equal(isMockAllowed({ hostname: 'evil.com', search: '?a=localhost&mock=1' }), false);
  assert.equal(isMockAllowed({ hostname: '127.0.0.1', search: '?mock=1' }), false);
  assert.equal(isMockAllowed({ hostname: 'LOCALHOST', search: '?mock=1' }), false);
  assert.equal(isMockAllowed(null), false);
  assert.equal(isMockAllowed({}), false);
});

test('la producción no importa el módulo de prueba por ninguna otra vía', () => {
  const main = readFileSync(new URL('../admin/js/main.js', import.meta.url), 'utf8');
  const lines = main.split('\n').filter((l) => /auth-mock|__mock/.test(l));
  assert.ok(lines.length >= 1);
  assert.match(main, /isMockAllowed\(location\)\s*\?/);
  assert.equal(readFileSync(new URL('../admin/js/auth-real.js', import.meta.url), 'utf8').includes('__mock'), false);
});

test('URLs de imágenes', () => {
  const cfg = { mediaBase: 'https://media.allin1jax.com', siteBase: '' };
  assert.equal(mediaUrl('media/abc.jpg', cfg), 'https://media.allin1jax.com/media/abc.jpg');
  assert.equal(mediaUrl('assets/gallery/x.jpg', cfg), null);
  assert.equal(mediaUrl('assets/gallery/x.jpg', { ...cfg, siteBase: 'https://allin1jax.com' }), 'https://allin1jax.com/assets/gallery/x.jpg');
  assert.equal(mediaUrl('media/../x', cfg), null);
  assert.equal(mediaUrl('https://evil.com/a.jpg', cfg), null);
  assert.equal(mediaUrl('', cfg), null);
});

test('errores de la API a español', () => {
  const m = (status, ctx, body) => apiErrorMessage({ status, body }, ctx);
  assert.equal(m(403), 'Este correo no tiene permiso para editar la página.');
  assert.match(m(409, 'publish'), /Alguien cambió la página hace un momento\. Recargue para ver lo último/);
  assert.match(m(409, 'restore'), /versión/);
  assert.match(m(404, 'restore'), /no existe/);
  assert.match(m(401), /sesión/);
  assert.match(m(413), /grande/);
  assert.match(m(415), /JPG, PNG o WebP/);
  assert.match(m(422), /Revise/);
  assert.match(m(428), /Recargue/);
  assert.match(m(429, 'upload', { error: 'Llegaste al límite de 40 archivos por hoy. Intenta mañana.' }), /límite de fotos de hoy/);
  assert.match(m(429, 'upload', { error: 'Demasiadas solicitudes. Espera un momento.' }), /Espere un minuto/);
  assert.match(m(503), /no está disponible/);
  assert.match(m(507), /lleno/);
  assert.match(m(500), /nuestro lado/);
  assert.match(m(418), /Algo salió mal/);
  assert.equal(apiErrorMessage({ network: true }, 'upload'), 'No pudimos subir la foto. Revise su internet e intente otra vez.');
  assert.match(apiErrorMessage({ network: true }, 'publish'), /Revise su internet/);
  // ningún mensaje deja pasar texto en inglés/técnico ni llaves sin reemplazar
  for (const s of [401, 403, 404, 409, 413, 415, 422, 428, 429, 503, 507, 500]) assert.doesNotMatch(m(s, 'publish'), /\{|undefined|Error|HTTP/);
});

test('CSP del panel: _headers y Worker iguales, con las fotos del sitio', () => {
  const hdr = readFileSync(new URL('../admin/_headers', import.meta.url), 'utf8').match(/Content-Security-Policy: (.*)/)[1].trim();
  const src = readFileSync(new URL('../src/http.js', import.meta.url), 'utf8');
  const parts = [...src.slice(src.indexOf('export const CSP'), src.indexOf('export const SECURITY_HEADERS')).matchAll(/"([^"]*)"/g)].map((m) => m[1]).join('');
  assert.equal(parts, hdr);
  assert.match(hdr, /img-src 'self' https:\/\/media\.allin1jax\.com https:\/\/allin1jax\.com https:\/\/www\.allin1jax\.com https:\/\/i\.ytimg\.com data: blob:/);
  assert.doesNotMatch(hdr, /unsafe-inline|unsafe-eval/);
});

test('acceso sin contraseña: el panel no tiene campos de contraseña', () => {
  for (const f of ['screens-auth.js', 'auth-real.js', 'main.js']) {
    const s = readFileSync(new URL(`../admin/js/${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(s, /type: 'password'|signInWithEmailAndPassword|sendPasswordResetEmail/, f);
  }
  const real = readFileSync(new URL('../admin/js/auth-real.js', import.meta.url), 'utf8');
  for (const fn of ['sendSignInLinkToEmail', 'isSignInWithEmailLink', 'signInWithEmailLink']) assert.ok(real.includes(fn), fn);
  assert.ok(real.includes('https://admin.allin1jax.com/'));
});

test('imágenes del sitio ya se pueden mostrar', () => {
  const cfg = readFileSync(new URL('../admin/js/config.js', import.meta.url), 'utf8');
  assert.match(cfg, /SITE_IMG_BASE = 'https:\/\/allin1jax\.com'/);
});

test('cambios entre listas', () => {
  const base = [{ id: 'a', x: 1 }, { id: 'b', x: 1 }, { id: 'c', x: 1 }];
  assert.equal(hasChange(diffLists(base, base)), false);
  const d = diffLists(base, [{ id: 'c', x: 1 }, { id: 'a', x: 2 }, { id: 'n' }]);
  assert.deepEqual(d, { added: 1, removed: 1, modified: 1, moved: true });
  assert.equal(describeDiff(d), '1 nuevo(s), 1 quitado(s), 1 cambiado(s), cambió el orden');
  assert.equal(describeDiff(diffLists(base, base)), '');
});

test('textos: reemplazo de variables', () => {
  assert.equal(t('uploading', { i: 2, n: 5 }), 'Subiendo foto 2 de 5…');
  assert.equal(t('noExiste'), 'noExiste');
});
