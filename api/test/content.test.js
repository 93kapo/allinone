import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, makeEnv, makeR2, validContent, upload, JPEG } from './helpers.js';

const put = (t, body, ifMatch = 'none') => t.call('/api/content', { method: 'PUT', headers: { 'if-match': ifMatch }, json: body });
const getPublic = (t, headers = {}) => t.call('/api/content', { token: null, headers });

test('GET vacío => 404 {empty:true}', async () => {
  const t = await setup();
  const r = await getPublic(t);
  assert.equal(r.status, 404);
  assert.deepEqual(await r.json(), { empty: true });
});

test('PUT crea, GET público con ETag y cabeceras de caché; 304 con If-None-Match', async () => {
  const t = await setup();
  const r = await put(t, validContent());
  assert.equal(r.status, 200);
  const saved = await r.json();
  assert.equal(saved.schemaVersion, 1);
  assert.equal(saved.updatedBy, 'dueno@example.com');
  assert.match(saved.version, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z-[a-z0-9]{6}$/);
  assert.ok(t.env.MEDIA.store.has(`content/v-${saved.version}.json`));

  const g = await getPublic(t);
  assert.equal(g.status, 200);
  assert.equal(g.headers.get('etag'), `"${saved.version}"`);
  assert.equal(g.headers.get('cache-control'), 'public, max-age=30, stale-while-revalidate=300');
  assert.equal((await g.json()).version, saved.version);

  for (const inm of [`"${saved.version}"`, saved.version, `W/"${saved.version}"`, `"x", "${saved.version}"`]) {
    const n = await getPublic(t, { 'if-none-match': inm });
    assert.equal(n.status, 304, inm);
    assert.equal(n.headers.get('etag'), `"${saved.version}"`);
    assert.equal(await n.text(), '');
  }
  assert.equal((await getPublic(t, { 'if-none-match': '"otra"' })).status, 200);
});

test('el servidor pone los metadatos aunque el cliente mande otros', async () => {
  const t = await setup();
  const r = await put(t, { ...validContent(), version: 'falsa', updatedBy: 'otro@x.com', updatedAt: '2000-01-01' });
  const saved = await r.json();
  assert.notEqual(saved.version, 'falsa');
  assert.equal(saved.updatedBy, 'dueno@example.com');
  assert.notEqual(saved.updatedAt, '2000-01-01');
});

test('If-Match: falta => 428; no coincide => 409 con mensaje exacto; "none" con contenido existente => 409', async () => {
  const t = await setup();
  assert.equal((await t.call('/api/content', { method: 'PUT', json: validContent() })).status, 428);
  assert.equal((await put(t, validContent(), '"inventada"')).status, 409);
  const first = await (await put(t, validContent(), 'none')).json();
  const stale = await put(t, validContent(), 'none');
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error, 'Alguien cambió el sitio hace un momento, recarga');
  assert.equal((await put(t, validContent(), `"${first.version}"`)).status, 200);
});

test('concurrencia: dos PUT con el mismo If-Match => uno 200 y otro 409', async () => {
  const t = await setup();
  const [a, b] = await Promise.all([put(t, validContent()), put(t, validContent({ reviews: [] }))]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const cur = await (await getPublic(t)).json();
  const versions = [...t.env.MEDIA.store.keys()].filter((k) => k.startsWith('content/v-'));
  assert.equal(versions.length, 1, 'el perdedor no deja versión huérfana');
  assert.equal(`content/v-${cur.version}.json`, versions[0]);
  // otra vuelta sobre una versión existente
  const [c, d] = await Promise.all([put(t, validContent(), cur.version), put(t, validContent(), cur.version)]);
  assert.deepEqual([c.status, d.status].sort(), [200, 409]);
});

test('validación: 422 con lista de errores por campo; JSON malo 400; tipo 415; enorme 413', async () => {
  const t = await setup();
  const c = validContent(); c.gallery[0].caption.es = '<b>';
  const r = await put(t, c);
  assert.equal(r.status, 422);
  const b = await r.json();
  assert.equal(b.errores[0].campo, 'gallery[0].caption.es');
  assert.ok(b.errores[0].mensaje);
  assert.equal((await t.call('/api/content', { method: 'PUT', headers: { 'if-match': 'none', 'content-type': 'application/json' }, body: '{no json' })).status, 400);
  assert.equal((await t.call('/api/content', { method: 'PUT', headers: { 'if-match': 'none', 'content-type': 'text/plain' }, body: '{}' })).status, 415);
  assert.equal((await t.call('/api/content', { method: 'PUT', headers: { 'if-match': 'none', 'content-type': 'application/json' }, body: ' '.repeat(400 * 1024) })).status, 413);
  assert.equal(t.env.MEDIA.store.has('content/current.json'), false);
});

test('claves de media: no existentes => 422; subidas => 200 y quedan marcadas como usadas', async () => {
  const t = await setup();
  const fake = 'media/123e4567-e89b-42d3-a456-426614174000.jpg';
  const c = validContent(); c.gallery[0].src = fake;
  assert.equal((await put(t, c)).status, 422);

  const up = await (await upload(t.call, JPEG())).json();
  c.gallery[0].src = up.key;
  const r = await put(t, c);
  assert.equal(r.status, 200, await r.clone().text());
  const manifest = await (await t.env.MEDIA.get('content/media-manifest.json')).json();
  assert.equal(manifest.items.find((i) => i.key === up.key).used, true);
});

test('historial: más recientes primero, con resumen de cambios; restaurar y deshacer', async () => {
  const t = await setup();
  const v1 = await (await put(t, validContent())).json();
  const c2 = validContent();
  c2.gallery.push({ id: 'g2', type: 'youtube', category: 'exterior', youtubeId: 'dQw4w9WgXcQ', caption: { es: 'Video' } });
  c2.reviews = [];
  c2.settings.email = '';
  const v2 = await (await put(t, c2, v1.version)).json();
  const c3 = JSON.parse(JSON.stringify(c2)); c3.gallery[0].caption.es = 'Cocina nueva';
  const v3 = await (await put(t, c3, v2.version)).json();

  let h = await (await t.call('/api/history')).json();
  assert.deepEqual(h.versiones.map((x) => x.version), [v3.version, v2.version, v1.version]);
  assert.equal(h.versiones[0].actual, true);
  assert.equal(h.versiones[0].updatedBy, 'dueno@example.com');
  assert.deepEqual(h.versiones[0].resumen.gallery, { added: 0, removed: 0, modified: 1, reordered: false });
  assert.equal(h.versiones[1].resumen.gallery.added, 1);
  assert.equal(h.versiones[1].resumen.reviews.removed, 1);
  assert.equal(h.versiones[1].resumen.settings, true);

  // restaurar v1 => versión NUEVA con el contenido de v1
  const rr = await t.call('/api/restore', { method: 'POST', json: { version: v1.version } });
  assert.equal(rr.status, 200);
  const r1 = await rr.json();
  assert.notEqual(r1.version, v1.version);
  assert.deepEqual(r1.gallery, v1.gallery);
  assert.deepEqual((await (await getPublic(t)).json()).gallery, v1.gallery);

  // deshacer: restaurar v3 (la que estaba antes de restaurar)
  const rr2 = await (await t.call('/api/restore', { method: 'POST', json: { version: v3.version } })).json();
  assert.deepEqual(rr2.gallery, v3.gallery);
  assert.equal(rr2.gallery[0].caption.es, 'Cocina nueva');

  h = await (await t.call('/api/history')).json();
  assert.equal(h.versiones.length, 5);
  assert.equal(h.versiones[1].restauradaDe, v1.version);
  assert.equal(h.versiones[0].restauradaDe, v3.version);

  // restore: entradas inválidas
  assert.equal((await t.call('/api/restore', { method: 'POST', json: { version: '../../x' } })).status, 422);
  assert.equal((await t.call('/api/restore', { method: 'POST', json: { version: '2020-01-01T00:00:00.000Z-abcdef' } })).status, 404);
  assert.equal((await t.call('/api/restore', { method: 'POST', json: {} })).status, 422);
});

test('conservación: solo las últimas 50 versiones (con listado paginado)', async () => {
  const env = makeEnv({ MEDIA: makeR2({ pageSize: 20 }) });
  const t = await setup({ env });
  let ifMatch = 'none';
  const all = [];
  for (let i = 0; i < 55; i++) {
    const c = validContent(); c.gallery[0].caption.es = `Foto ${i}`;
    const r = await put(t, c, ifMatch);
    assert.equal(r.status, 200, `iteración ${i}`);
    const saved = await r.json();
    all.push(saved.version);
    ifMatch = saved.version;
  }
  const keys = [...env.MEDIA.store.keys()].filter((k) => k.startsWith('content/v-'));
  assert.equal(keys.length, 50);
  for (const old of all.slice(0, 5)) assert.ok(!env.MEDIA.store.has(`content/v-${old}.json`), 'debía borrarse ' + old);
  for (const kept of all.slice(5)) assert.ok(env.MEDIA.store.has(`content/v-${kept}.json`));
  const h = await (await t.call('/api/history')).json();
  assert.equal(h.versiones.length, 50);
  assert.equal(h.versiones[0].version, all[54]);
  assert.equal(h.versiones[49].version, all[5]);
  assert.ok(env.MEDIA.store.has('content/current.json'));
});

test('/api/me devuelve correo y cuotas restantes; rutas desconocidas y métodos', async () => {
  const t = await setup();
  const m = await (await t.call('/api/me')).json();
  assert.equal(m.email, 'dueno@example.com');
  assert.equal(m.cuotas.archivosRestantes, 40);
  assert.equal(m.cuotas.bytesRestantes, 80 * 1024 * 1024);
  await upload(t.call, JPEG(1000));
  const m2 = await (await t.call('/api/me')).json();
  assert.equal(m2.cuotas.archivosRestantes, 39);
  assert.equal(m2.cuotas.bytesRestantes, 80 * 1024 * 1024 - 1000);
  assert.equal((await t.call('/api/nada')).status, 404);
  assert.equal((await t.call('/api/media/x', { method: 'DELETE' })).status, 404); // no existe borrado de media
  assert.equal((await t.call('/api/content', { method: 'DELETE' })).status, 405);
  assert.equal((await t.call('/api/history', { method: 'POST' })).status, 405);
});

test('endpoints con auth exigen token (401 sin él)', async () => {
  const t = await setup();
  for (const [p, m] of [['/api/history', 'GET'], ['/api/restore', 'POST'], ['/api/upload', 'POST'], ['/api/me', 'GET'], ['/api/content', 'PUT']]) {
    assert.equal((await t.call(p, { method: m, token: null })).status, 401, p);
  }
});

test('límite en memoria: tras muchos fallos de autenticación seguidos => 429', async () => {
  const t = await setup({ clock: false });
  let last;
  for (let i = 0; i < 25; i++) last = await t.call('/api/me', { token: null });
  assert.equal(last.status, 429);
});
