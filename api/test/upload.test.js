import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, makeEnv, upload, JPEG } from './helpers.js';

const text = (s) => new TextEncoder().encode(s);
const MB = 1024 * 1024;

test('JPEG, PNG y WebP válidos: clave del servidor, Content-Type y Cache-Control correctos, manifiesto', async () => {
  const t = await setup();
  const png = new Uint8Array(50); png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = new Uint8Array(50); webp.set(text('RIFF')); webp.set(text('WEBP'), 8);
  const cases = [[JPEG(), 'jpg', 'image/jpeg'], [png, 'png', 'image/png'], [webp, 'webp', 'image/webp']];
  for (const [bytes, ext, type] of cases) {
    // el Content-Type del cliente miente a propósito
    const r = await upload(t.call, bytes, { type: 'text/plain' });
    assert.equal(r.status, 201);
    const b = await r.json();
    assert.match(b.key, new RegExp(`^media/[0-9a-f-]{36}\\.${ext}$`));
    const o = await t.env.MEDIA.get(b.key);
    assert.equal(o.httpMetadata.contentType, type);
    assert.equal(o.httpMetadata.cacheControl, 'public, max-age=31536000, immutable');
    assert.equal(o.size, bytes.length);
  }
  const th = await (await upload(t.call, JPEG(), { kind: 'thumb' })).json();
  assert.match(th.key, /^media\/[0-9a-f-]{36}-t\.jpg$/);
  const man = await (await t.env.MEDIA.get('content/media-manifest.json')).json();
  assert.equal(man.items.length, 4);
  assert.deepEqual(Object.keys(man.items[0]).sort(), ['at', 'by', 'key', 'size', 'used']);
  assert.equal(man.items[0].used, false);
  assert.equal(man.items[0].by, 'dueno@example.com');
});

test('SVG, HTML, PDF y texto renombrados como .jpg / image/jpeg => 415 y nada se guarda', async () => {
  const t = await setup();
  const evil = [text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), text('<!doctype html><script>1</script>'),
    text('%PDF-1.7 ...'), text('GIF89a....'), text('RIFF\0\0\0\0WAVEfmt '), text('hola')];
  for (const b of evil) {
    const r = await t.call('/api/upload', { method: 'POST', headers: { 'x-kind': 'photo', 'content-type': 'image/jpeg', 'x-filename': 'foto.jpg' }, body: b });
    assert.equal(r.status, 415);
  }
  assert.equal([...t.env.MEDIA.store.keys()].filter((k) => k.startsWith('media/')).length, 0);
});

test('0 bytes => 400; sin X-Kind o con X-Kind raro => 400', async () => {
  const t = await setup();
  assert.equal((await upload(t.call, new Uint8Array(0))).status, 400);
  assert.equal((await t.call('/api/upload', { method: 'POST', body: JPEG() })).status, 400);
  assert.equal((await upload(t.call, JPEG(), { kind: '../x' })).status, 400);
});

test('mayor al tope (8 MB) => 413; justo en el tope pasa; miniatura tiene tope propio', async () => {
  const t = await setup();
  assert.equal((await upload(t.call, JPEG(8 * MB + 1))).status, 413);
  assert.equal((await upload(t.call, JPEG(8 * MB))).status, 201);
  assert.equal((await upload(t.call, JPEG(MB + 1), { kind: 'thumb' })).status, 413);
});

test('Content-Length falso: se cuentan los bytes reales', async () => {
  const t = await setup();
  const r1 = await t.call('/api/upload', { method: 'POST', headers: { 'x-kind': 'photo', 'content-length': '100' }, body: JPEG(9 * MB) });
  assert.equal(r1.status, 413);
  const r2 = await t.call('/api/upload', { method: 'POST', headers: { 'x-kind': 'photo', 'content-length': String(500 * MB) }, body: JPEG(200) });
  assert.equal(r2.status, 201);
});

test('no se lee mucho más que el tope aunque el cuerpo sea enorme', async () => {
  const t = await setup();
  let pulled = 0;
  const chunk = JPEG(64 * 1024);
  const stream = new ReadableStream({
    pull(c) { if (pulled > 200 * MB) { c.close(); return; } pulled += chunk.length; c.enqueue(chunk); },
  });
  const r = await t.call('/api/upload', { method: 'POST', headers: { 'x-kind': 'photo', 'content-length': '10' }, body: stream });
  assert.equal(r.status, 413);
  assert.ok(pulled <= 8 * MB + 2 * 64 * 1024 + 1024 * 1024, `se leyeron ${pulled} bytes`);
});

test('cuota diaria de archivos => 429 en español; otro usuario no se ve afectado', async () => {
  const t = await setup({ env: makeEnv({ QUOTA_FILES_PER_DAY: '2' }) });
  assert.equal((await upload(t.call, JPEG())).status, 201);
  assert.equal((await upload(t.call, JPEG())).status, 201);
  const r = await upload(t.call, JPEG());
  assert.equal(r.status, 429);
  assert.match((await r.json()).error, /límite de 2 archivos/);
  const other = await t.kit.sign({ email: 'otra@example.com', sub: 'uid-2' });
  assert.equal((await upload(t.call, JPEG(), { token: other })).status, 201);
  const q = [...t.env.MEDIA.store.keys()].filter((k) => k.startsWith('content/quota/'));
  assert.equal(q.length, 2);
  assert.ok(q.every((k) => /^content\/quota\/[0-9a-f]{32}\/\d{4}-\d{2}-\d{2}\.json$/.test(k)));
  assert.ok(q.every((k) => !k.includes('example.com')), 'el correo no va en claro en la clave');
});

test('cuota diaria de bytes => 429', async () => {
  const t = await setup({ env: makeEnv({ QUOTA_MB_PER_DAY: '1' }) });
  assert.equal((await upload(t.call, JPEG(600 * 1024))).status, 201);
  const r = await upload(t.call, JPEG(600 * 1024));
  assert.equal(r.status, 429);
  assert.match((await r.json()).error, /1 MB/);
});

test('subidas simultáneas respetan la cuota (sin pasarse)', async () => {
  const t = await setup({ env: makeEnv({ QUOTA_FILES_PER_DAY: '3' }) });
  const rs = await Promise.all(Array.from({ length: 6 }, () => upload(t.call, JPEG())));
  const ok = rs.filter((r) => r.status === 201).length;
  assert.equal(ok, 3);
  assert.equal(rs.filter((r) => r.status === 429).length, 3);
  const man = await (await t.env.MEDIA.get('content/media-manifest.json')).json();
  assert.equal(man.items.length, 3);
});

test('tope total del bucket (MAX_BUCKET_MB) => 507 y se limpia el archivo', async () => {
  const t = await setup({ env: makeEnv({ MAX_BUCKET_MB: '1' }) });
  assert.equal((await upload(t.call, JPEG(700 * 1024))).status, 201);
  const r = await upload(t.call, JPEG(700 * 1024));
  assert.equal(r.status, 507);
  assert.equal([...t.env.MEDIA.store.keys()].filter((k) => k.startsWith('media/')).length, 1);
});

test('subir exige autenticación y no hay endpoint de borrado', async () => {
  const t = await setup();
  assert.equal((await upload(t.call, JPEG(), { token: null })).status, 401);
  assert.equal((await t.call('/api/upload', { method: 'DELETE' })).status, 405);
});
