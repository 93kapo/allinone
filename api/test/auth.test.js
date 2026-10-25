import test from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { createApp } from '../src/index.js';
import { setup, makeEnv, b64u, OWNER, PROJECT, makeKit } from './helpers.js';

const me = (t, tok) => t.call('/api/me', { token: tok });

test('token válido => 200 y correo', async () => {
  const t = await setup();
  const r = await me(t);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).email, OWNER);
});

test('token caducado => 401', async () => {
  const t = await setup();
  const tok = await t.kit.sign({ iat: t.kit.nowS() - 7200, exp: t.kit.nowS() - 3600 });
  assert.equal((await me(t, tok)).status, 401);
});

test('iat en el futuro => 401', async () => {
  const t = await setup();
  const tok = await t.kit.sign({ iat: t.kit.nowS() + 3600, exp: t.kit.nowS() + 7200 });
  assert.equal((await me(t, tok)).status, 401);
});

test('aud incorrecto e iss incorrecto => 401', async () => {
  const t = await setup();
  assert.equal((await me(t, await t.kit.sign({ aud: 'otro-proyecto' }))).status, 401);
  assert.equal((await me(t, await t.kit.sign({ iss: 'https://securetoken.google.com/otro' }))).status, 401);
  assert.equal((await me(t, await t.kit.sign({ iss: 'https://evil.com' }))).status, 401);
});

test('alg none => 401', async () => {
  const t = await setup();
  const now = t.kit.nowS();
  const tok = `${b64u({ alg: 'none', typ: 'JWT', kid: 'kid-1' })}.${b64u({ email: OWNER, email_verified: true, sub: 'u', iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, iat: now, exp: now + 3600 })}.`;
  assert.equal((await me(t, tok)).status, 401);
});

test('HS256 firmado con la clave pública => 401', async () => {
  const t = await setup();
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', t.kit.good.publicKey));
  const now = t.kit.nowS();
  const tok = await new SignJWT({ email: OWNER, email_verified: true, sub: 'u', iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, iat: now, exp: now + 3600 })
    .setProtectedHeader({ alg: 'HS256', kid: 'kid-1' }).sign(spki);
  assert.equal((await me(t, tok)).status, 401);
});

test('kid desconocido => 401 (y firma de otra clave con el kid bueno => 401)', async () => {
  const t = await setup();
  assert.equal((await me(t, await t.kit.sign({}, { key: t.kit.other }))).status, 401);
  assert.equal((await me(t, await t.kit.sign({}, { key: t.kit.other, kid: 'kid-1' }))).status, 401);
});

test('payload alterado => 401', async () => {
  const t = await setup();
  const [h, , s] = (await t.kit.sign({ email: 'otra@example.com' })).split('.');
  const p = b64u({ email: OWNER, email_verified: true, sub: 'uid-1', iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, iat: t.kit.nowS(), exp: t.kit.nowS() + 3600 });
  assert.equal((await me(t, `${h}.${p}.${s}`)).status, 401);
});

test('sin sub => 401', async () => {
  const t = await setup();
  assert.equal((await me(t, await t.kit.sign({ sub: undefined }))).status, 401);
  assert.equal((await me(t, await t.kit.sign({ sub: '' }))).status, 401);
});

test('email_verified false o ausente => 403', async () => {
  const t = await setup();
  assert.equal((await me(t, await t.kit.sign({ email_verified: false }))).status, 403);
  assert.equal((await me(t, await t.kit.sign({ email_verified: 'true' }))).status, 403);
  assert.equal((await me(t, await t.kit.sign({ email_verified: undefined }))).status, 403);
});

test('correo fuera de la lista => 403 genérico', async () => {
  const t = await setup();
  const r = await me(t, await t.kit.sign({ email: 'intruso@example.com' }));
  assert.equal(r.status, 403);
  const body = JSON.stringify(await r.json());
  assert.ok(!/lista|permitid|intruso|allowed/i.test(body), body);
});

test('mayúsculas y espacios en el correo: se normaliza', async () => {
  const t = await setup();
  const r = await me(t, await t.kit.sign({ email: '  DUENO@Example.COM ' }));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).email, OWNER);
  // y la lista del secret también se normaliza ('Otra@Example.com')
  assert.equal((await me(t, await t.kit.sign({ email: 'otra@example.com' }))).status, 200);
});

test('ALLOWED_EMAILS vacío => nadie entra (403)', async () => {
  const t = await setup({ env: makeEnv({ ALLOWED_EMAILS: '' }) });
  assert.equal((await me(t)).status, 403);
});

test('sin cabecera, esquema equivocado, token en la URL, cookie => 401', async () => {
  const t = await setup();
  assert.equal((await me(t, null)).status, 401);
  assert.equal((await t.call('/api/me', { token: null, headers: { authorization: `Basic ${t.token}` } })).status, 401);
  assert.equal((await t.call(`/api/me?token=${t.token}`, { token: null })).status, 401);
  assert.equal((await t.call(`/api/me?access_token=${t.token}`, { token: null })).status, 401);
  assert.equal((await t.call('/api/me', { token: null, headers: { cookie: `token=${t.token}` } })).status, 401);
});

test('JWKS caído => 503, nunca 200', async () => {
  const kit = await makeKit();
  const env = makeEnv();
  const down = createApp({ getKey: async () => { throw new TypeError('fetch failed'); } });
  const tok = await kit.sign();
  const r = await down.fetch(new Request('https://admin.allin1jax.com/api/me', { headers: { authorization: `Bearer ${tok}` } }), env, {});
  assert.equal(r.status, 503);
});

test('resolvedor remoto real: JWKS responde 500 => 503; responde bien => 200', async () => {
  const kit = await makeKit();
  const env = makeEnv();
  const orig = globalThis.fetch;
  const tok = await kit.sign();
  const req = () => new Request('https://admin.allin1jax.com/api/me', { headers: { authorization: `Bearer ${tok}` } });
  try {
    globalThis.fetch = async () => new Response('boom', { status: 500 });
    assert.equal((await createApp().fetch(req(), env, {})).status, 503);
    globalThis.fetch = async () => { throw new TypeError('network'); };
    assert.equal((await createApp().fetch(req(), env, {})).status, 503);
    globalThis.fetch = async () => new Response('no es json', { status: 200 });
    assert.equal((await createApp().fetch(req(), env, {})).status, 503);
    globalThis.fetch = async () => new Response(JSON.stringify({ keys: [kit.good.jwk] }), { status: 200, headers: { 'content-type': 'application/json' } });
    assert.equal((await createApp().fetch(req(), env, {})).status, 200);
  } finally { globalThis.fetch = orig; }
});

test('ADMIN_DISABLED=1 => 503 en lo autenticado, el contenido público sigue', async () => {
  const t = await setup({ env: makeEnv({ ADMIN_DISABLED: '1' }) });
  assert.equal((await me(t)).status, 503);
  assert.equal((await t.call('/api/history')).status, 503);
  assert.equal((await t.call('/api/content', { method: 'PUT', headers: { 'if-match': 'none' }, json: {} })).status, 503);
  assert.equal((await t.call('/api/content', { token: null })).status, 404); // público: vacío, no 503
});

test('falta FIREBASE_PROJECT_ID => 503 (falla cerrada)', async () => {
  const env = makeEnv(); delete env.FIREBASE_PROJECT_ID;
  const t = await setup({ env });
  assert.equal((await me(t)).status, 503);
});
