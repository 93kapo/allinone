import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, makeEnv, JPEG } from './helpers.js';
import { sniffVideo } from '../src/media.js';
import { validateContent } from '../src/schema.js';
import { readFileSync } from 'node:fs';

const MB = 1024 * 1024;
const text = (s) => new TextEncoder().encode(s);
function box(brand, n = 2048) {
  const b = new Uint8Array(n);
  b.set([0, 0, 0, 0x18]); b.set(text('ftyp'), 4); b.set(text(brand), 8);
  return b;
}
const WEBM = (n = 2048) => { const b = new Uint8Array(n); b.set([0x1a, 0x45, 0xdf, 0xa3]); return b; };
const vid = (call, bytes, { kind = 'video', cl = String(bytes.length), token, extra = {} } = {}) => {
  const headers = { 'x-kind': kind, 'content-type': 'application/octet-stream', ...extra };
  if (cl !== null) headers['content-length'] = cl;
  return call('/api/upload', { method: 'POST', headers, body: bytes, token });
};
const mediaKeys = (t) => [...t.env.MEDIA.store.keys()].filter((k) => k.startsWith('media/'));
const quotaObj = async (t) => {
  const k = [...t.env.MEDIA.store.keys()].find((x) => x.startsWith('content/quota/'));
  return k ? (await t.env.MEDIA.get(k)).json() : null;
};

test('firmas de video: MP4 (isom, mp42, avc1, M4V), MOV (qt), WebM; el resto no', () => {
  assert.deepEqual(sniffVideo(box('isom')), { ext: 'mp4', type: 'video/mp4' });
  for (const b of ['mp42', 'mp41', 'avc1', 'M4V ', 'hvc1', 'iso2']) assert.equal(sniffVideo(box(b)).ext, 'mp4', b);
  assert.deepEqual(sniffVideo(box('qt  ')), { ext: 'mov', type: 'video/quicktime' });
  assert.deepEqual(sniffVideo(WEBM()), { ext: 'webm', type: 'video/webm' });
  for (const b of [JPEG(), box('XXXX'), box('M4A '), text('hola mundo!!'), text('<svg></svg><svg>'), new Uint8Array(0), new Uint8Array(11), text('RIFF\0\0\0\0AVI LIST')]) assert.equal(sniffVideo(b), null);
});

test('subida de video válido: clave, Content-Type, Cache-Control inmutable, manifiesto', async () => {
  const t = await setup();
  for (const [bytes, ext, type] of [[box('isom'), 'mp4', 'video/mp4'], [box('qt  '), 'mov', 'video/quicktime'], [WEBM(), 'webm', 'video/webm']]) {
    const r = await vid(t.call, bytes, { extra: { 'content-type': 'text/plain' } }); // el tipo del cliente se ignora
    assert.equal(r.status, 201);
    const b = await r.json();
    assert.equal(b.kind, 'video'); assert.equal(b.contentType, type); assert.equal(b.size, bytes.length);
    assert.match(b.key, new RegExp(`^media/[0-9a-f-]{36}\\.${ext}$`));
    const o = await t.env.MEDIA.get(b.key);
    assert.equal(o.httpMetadata.contentType, type);
    assert.equal(o.httpMetadata.cacheControl, 'public, max-age=31536000, immutable');
    assert.equal(o.size, bytes.length);
  }
  const man = await (await t.env.MEDIA.get('content/media-manifest.json')).json();
  assert.equal(man.items.length, 3);
  assert.ok(man.items.every((i) => i.used === false && i.by === 'dueno@example.com'));
});

test('video que no es video (JPEG, texto, marca desconocida) => 415, nada guardado y no gasta cuota de video', async () => {
  const t = await setup();
  for (const b of [JPEG(3000), text('esto no es un video, es texto largo'), box('XXXX'), box('M4A ')]) assert.equal((await vid(t.call, b)).status, 415);
  assert.equal(mediaKeys(t).length, 0);
  assert.equal(await quotaObj(t), null);
});

test('sin Content-Length => 411; más de 95 MB declarado => 413 sin leer; justo 95 MB declarado pasa la revisión', async () => {
  const t = await setup();
  assert.equal((await vid(t.call, box('isom'), { cl: null })).status, 411);
  assert.equal((await vid(t.call, box('isom'), { cl: 'abc' })).status, 411);
  assert.equal((await vid(t.call, box('isom'), { cl: '0' })).status, 411);
  const r = await vid(t.call, box('isom'), { cl: String(95 * MB + 1) });
  assert.equal(r.status, 413);
  assert.match((await r.json()).error, /95 MB/);
  assert.equal(mediaKeys(t).length, 0);
  // declarado = tope, cuerpo más corto => 400 y se limpia (la revisión de tamaño no lo rechaza antes)
  assert.equal((await vid(t.call, box('isom'), { cl: String(95 * MB) })).status, 400);
  assert.equal(mediaKeys(t).length, 0);
});

test('cuerpo real mayor que el declarado => 413 y se corta el stream; cuerpo menor => 400; todo se limpia y se devuelve la cuota', async () => {
  const t = await setup();
  assert.equal((await vid(t.call, box('isom', 5000), { cl: '1000' })).status, 413);
  assert.equal((await vid(t.call, box('isom', 1000), { cl: '5000' })).status, 400);
  assert.equal(mediaKeys(t).length, 0);
  const q = await quotaObj(t);
  assert.equal(q.videos, 0); assert.equal(q.vbytes, 0);
  const man = await t.env.MEDIA.get('content/media-manifest.json');
  assert.equal(man, null);
});

test('stream enorme con Content-Length chico: no se lee mucho más que lo declarado', async () => {
  const t = await setup();
  let pulled = 0;
  const chunk = box('isom', 64 * 1024);
  const stream = new ReadableStream({ pull(c) { if (pulled > 300 * MB) { c.close(); return; } pulled += chunk.length; c.enqueue(chunk); } });
  const r = await t.call('/api/upload', { method: 'POST', headers: { 'x-kind': 'video', 'content-length': '1000' }, body: stream });
  assert.equal(r.status, 413);
  assert.ok(pulled <= 2 * MB, `se leyeron ${pulled} bytes`);
});

test('cuota de videos por día (aparte de la de fotos) => 429; otro usuario no se ve afectado', async () => {
  const t = await setup({ env: makeEnv({ QUOTA_VIDEOS_PER_DAY: '2', QUOTA_FILES_PER_DAY: '50' }) });
  assert.equal((await vid(t.call, box('isom'))).status, 201);
  assert.equal((await vid(t.call, box('isom'))).status, 201);
  const r = await vid(t.call, box('isom'));
  assert.equal(r.status, 429);
  assert.match((await r.json()).error, /límite de 2 videos/);
  // las fotos siguen funcionando
  const p = await t.call('/api/upload', { method: 'POST', headers: { 'x-kind': 'photo' }, body: JPEG() });
  assert.equal(p.status, 201);
  const other = await t.kit.sign({ email: 'otra@example.com', sub: 'uid-2' });
  assert.equal((await vid(t.call, box('isom'), { token: other })).status, 201);
  // la foto no borró el contador de videos
  const me = await (await t.call('/api/me')).json();
  assert.equal(me.cuotas.videosRestantes, 0);
  assert.equal(me.cuotas.videosPorDia, 2);
});

test('la cuota de fotos agotada no bloquea videos', async () => {
  const t = await setup({ env: makeEnv({ QUOTA_FILES_PER_DAY: '1' }) });
  assert.equal((await t.call('/api/upload', { method: 'POST', headers: { 'x-kind': 'photo' }, body: JPEG() })).status, 201);
  assert.equal((await t.call('/api/upload', { method: 'POST', headers: { 'x-kind': 'photo' }, body: JPEG() })).status, 429);
  assert.equal((await vid(t.call, box('isom'))).status, 201);
});

test('cuota de MB de video por día => 429', async () => {
  const t = await setup({ env: makeEnv({ QUOTA_VIDEO_MB_PER_DAY: '1' }) });
  assert.equal((await vid(t.call, box('isom', 600 * 1024))).status, 201);
  const r = await vid(t.call, box('isom', 600 * 1024));
  assert.equal(r.status, 429);
  assert.match((await r.json()).error, /1 MB de video/);
});

test('subidas de video simultáneas respetan la cuota', async () => {
  const t = await setup({ env: makeEnv({ QUOTA_VIDEOS_PER_DAY: '2' }) });
  const rs = await Promise.all(Array.from({ length: 5 }, () => vid(t.call, box('isom'))));
  assert.equal(rs.filter((r) => r.status === 201).length, 2);
  assert.equal(rs.filter((r) => r.status === 429).length, 3);
});

test('tope global de almacenamiento (MAX_BUCKET_MB) => 507 sin guardar el video', async () => {
  const t = await setup({ env: makeEnv({ MAX_BUCKET_MB: '1' }) });
  assert.equal((await vid(t.call, box('isom', 700 * 1024))).status, 201);
  const r = await vid(t.call, box('isom', 700 * 1024));
  assert.equal(r.status, 507);
  assert.equal(mediaKeys(t).length, 1);
});

test('el tope global por defecto es de 8 GB', async () => {
  const { maxBucketBytes } = await import('../src/media.js');
  assert.equal(maxBucketBytes({}), 8000 * MB);
});

test('cartel (poster): imagen con clave -p y tope de 2 MB; un video no vale como cartel', async () => {
  const t = await setup();
  const r = await t.call('/api/upload', { method: 'POST', headers: { 'x-kind': 'poster' }, body: JPEG(5000) });
  assert.equal(r.status, 201);
  assert.match((await r.json()).key, /^media\/[0-9a-f-]{36}-p\.jpg$/);
  assert.equal((await t.call('/api/upload', { method: 'POST', headers: { 'x-kind': 'poster' }, body: JPEG(2 * MB + 1) })).status, 413);
  assert.equal((await t.call('/api/upload', { method: 'POST', headers: { 'x-kind': 'poster' }, body: box('isom') })).status, 415);
  assert.equal((await t.call('/api/upload', { method: 'POST', headers: { 'x-kind': 'photo' }, body: box('isom') })).status, 415);
});

test('flujo completo: subir video + cartel, publicar item video y queda marcado como usado', async () => {
  const t = await setup();
  const v = await (await vid(t.call, box('isom'))).json();
  const p = await (await t.call('/api/upload', { method: 'POST', headers: { 'x-kind': 'poster' }, body: JPEG(5000) })).json();
  const content = {
    settings: { email: '', social: {}, showLicensed: false, licenseNumber: '' },
    gallery: [{ id: 'v1', type: 'video', category: 'interior', src: v.key, poster: p.key, w: 1080, h: 1920, caption: { es: 'Recorrido' } }],
    beforeAfter: [], reviews: [],
  };
  const r = await t.call('/api/content', { method: 'PUT', headers: { 'if-match': 'none' }, json: content });
  assert.equal(r.status, 200);
  const saved = await r.json();
  assert.equal(saved.gallery[0].type, 'video'); assert.equal(saved.gallery[0].src, v.key);
  const man = await (await t.env.MEDIA.get('content/media-manifest.json')).json();
  assert.ok(man.items.filter((i) => i.key === v.key || i.key === p.key).every((i) => i.used));
  // un video que no se subió => 422
  const bad = structuredClone(content); bad.gallery[0].src = 'media/123e4567-e89b-42d3-a456-426614174000.mp4';
  const r2 = await t.call('/api/content', { method: 'PUT', headers: { 'if-match': saved.version }, json: bad });
  assert.equal(r2.status, 422);
});

test('esquema: video exige src de video y cartel; legado exacto permitido; semilla del sitio válida', () => {
  const KEY_V = 'media/123e4567-e89b-42d3-a456-426614174000.mp4';
  const KEY_P = 'media/123e4567-e89b-42d3-a456-426614174001-p.jpg';
  const KEY_I = 'media/123e4567-e89b-42d3-a456-426614174002.jpg';
  const base = (g) => ({ settings: { email: '', social: {}, showLicensed: false, licenseNumber: '' }, gallery: [g], beforeAfter: [], reviews: [] });
  const item = (o = {}) => ({ id: 'v', type: 'video', category: 'exterior', src: KEY_V, poster: KEY_P, caption: { es: 'Video' }, ...o });
  const keys = new Set([KEY_V, KEY_P, KEY_I]);
  const run = (g, mk = keys) => validateContent(base(g), { mediaKeys: mk });
  const campos = (r) => r.errores.map((e) => e.campo);
  assert.equal(run(item()).ok, true);
  assert.equal(run(item()).value.gallery[0].w, 1280);
  assert.deepEqual(campos(run(item(), new Set())), ['gallery[0].src', 'gallery[0].poster']);
  assert.deepEqual(campos(run(item({ poster: undefined }))), ['gallery[0].poster']);
  assert.deepEqual(campos(run(item({ src: KEY_I }))), ['gallery[0].src']); // una foto no es video
  assert.deepEqual(campos(run(item({ src: undefined }))), ['gallery[0].src']);
  assert.deepEqual(campos(run({ ...item(), type: 'image', src: KEY_V, poster: undefined, w: 100, h: 100 })), ['gallery[0].src']); // un video no es foto
  assert.deepEqual(campos(run(item({ youtubeId: 'dQw4w9WgXcQ' }))), ['gallery[0].youtubeId']);
  assert.deepEqual(campos(run(item({ src: 'assets/gallery/otro.mp4' }))), ['gallery[0].src']);
  assert.deepEqual(campos(run(item({ src: 'https://evil.com/a.mp4' }))), ['gallery[0].src']);
  assert.deepEqual(campos(run(item({ src: 'media/../x.mp4' }))), ['gallery[0].src']);
  const legacy = item({ src: 'assets/gallery/allin1.mp4', poster: 'assets/gallery/allin1-poster.jpg' });
  assert.equal(run(legacy, new Set()).ok, true);
  const seed = JSON.parse(readFileSync(new URL('../../web/assets/content-seed.json', import.meta.url), 'utf8'));
  const r = validateContent(seed, { mediaKeys: new Set() });
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  assert.equal(r.value.gallery[0].type, 'video');
});
