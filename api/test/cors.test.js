import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, validContent, JPEG, upload } from './helpers.js';

const OK = ['https://allin1jax.com', 'https://www.allin1jax.com'];

test('GET /api/content: orígenes permitidos reciben CORS exacto con Vary: Origin', async () => {
  const t = await setup();
  await t.call('/api/content', { method: 'PUT', headers: { 'if-match': 'none' }, json: validContent() });
  for (const o of OK) {
    const r = await t.call('/api/content', { token: null, headers: { origin: o } });
    assert.equal(r.headers.get('access-control-allow-origin'), o);
    assert.match(r.headers.get('vary'), /Origin/);
    assert.match(r.headers.get('access-control-expose-headers'), /ETag/);
  }
});

test('GET /api/content: evil.com y parecidos no reciben CORS (pero sí Vary)', async () => {
  const t = await setup();
  await t.call('/api/content', { method: 'PUT', headers: { 'if-match': 'none' }, json: validContent() });
  for (const o of ['https://evil.com', 'http://allin1jax.com', 'https://allin1jax.com.evil.com', 'https://sub.allin1jax.com', 'null', 'https://allin1jax.com/']) {
    const r = await t.call('/api/content', { token: null, headers: { origin: o } });
    assert.equal(r.headers.get('access-control-allow-origin'), null, o);
    assert.match(r.headers.get('vary'), /Origin/);
  }
  // también en 404 y 304
  const e = await (await setup()).call('/api/content', { token: null, headers: { origin: OK[0] } });
  assert.equal(e.headers.get('access-control-allow-origin'), OK[0]);
});

test('preflight OPTIONS: solo orígenes permitidos', async () => {
  const t = await setup();
  const ok = await t.call('/api/content', { method: 'OPTIONS', token: null, headers: { origin: OK[0], 'access-control-request-method': 'GET' } });
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('access-control-allow-origin'), OK[0]);
  assert.equal(ok.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
  const no = await t.call('/api/content', { method: 'OPTIONS', token: null, headers: { origin: 'https://evil.com', 'access-control-request-method': 'PUT' } });
  assert.equal(no.headers.get('access-control-allow-origin'), null);
  assert.equal(no.headers.get('access-control-allow-methods'), null);
});

test('endpoints con auth NUNCA emiten CORS (ni con origen permitido, ni en errores, ni en preflight)', async () => {
  const t = await setup();
  const h = { origin: OK[0] };
  const responses = [
    await t.call('/api/me', { headers: h }),
    await t.call('/api/me', { token: null, headers: h }),
    await t.call('/api/history', { headers: h }),
    await t.call('/api/content', { method: 'PUT', headers: { ...h, 'if-match': 'none' }, json: validContent() }),
    await t.call('/api/history', { method: 'OPTIONS', headers: { ...h, 'access-control-request-method': 'GET' } }),
    await t.call('/api/upload', { method: 'OPTIONS', token: null, headers: { ...h, 'access-control-request-method': 'POST' } }),
    await upload((p, o) => t.call(p, { ...o, headers: { ...o.headers, ...h } }), JPEG()),
    await t.call('/api/restore', { method: 'POST', headers: h, json: {} }),
  ];
  for (const r of responses) {
    for (const [k] of r.headers) assert.ok(!k.startsWith('access-control-'), `${r.status} emitió ${k}`);
    assert.notEqual(r.headers.get('access-control-allow-origin'), '*');
  }
});

test('cabeceras de seguridad en TODAS las respuestas del Worker', async () => {
  const t = await setup();
  const rs = [
    await t.call('/api/content', { token: null }),
    await t.call('/api/me'),
    await t.call('/api/me', { token: null }),
    await t.call('/api/nada'),
    await t.call('/api/history', { method: 'POST' }),
    await t.call('/api/content', { method: 'PUT', headers: { 'if-match': 'none' }, json: validContent() }),
    await t.call('/api/content', { token: null, headers: { 'if-none-match': '"x"' } }),
  ];
  for (const r of rs) {
    assert.match(r.headers.get('content-security-policy'), /^default-src 'none'; script-src 'self' https:\/\/www\.gstatic\.com;/, String(r.status));
    assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'; base-uri 'none'; form-action 'none'$/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(r.headers.get('x-robots-tag'), 'noindex');
  }
  // respuestas autenticadas no se cachean
  assert.equal((await t.call('/api/me')).headers.get('cache-control'), 'no-store');
});

test('error interno: 500 genérico, sin detalles', async () => {
  const t = await setup();
  t.env.MEDIA.get = async () => { throw new Error('SECRETO interno r2 bucket'); };
  const orig = console.error; console.error = () => {};
  try {
    const r = await t.call('/api/content', { token: null });
    assert.equal(r.status, 500);
    assert.ok(!(await r.text()).includes('SECRETO'));
  } finally { console.error = orig; }
});
