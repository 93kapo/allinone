// Arnés de pruebas: R2 simulado, claves RSA de WebCrypto, JWKS simulado y la app lista para llamar.
import { SignJWT, createLocalJWKSet } from 'jose';
import { createApp } from '../src/index.js';

export const PROJECT = 'allin1-d68ac';
export const OWNER = 'dueno@example.com';

// ---- R2 simulado (get/head/put con onlyIf/delete/list con paginación) ----
export function makeR2({ pageSize = 1000 } = {}) {
  const store = new Map();
  let counter = 0;
  const wrap = (key, e) => ({
    key, size: e.bytes.length, etag: e.etag, httpEtag: `"${e.etag}"`,
    httpMetadata: e.httpMetadata, customMetadata: e.customMetadata, uploaded: e.uploaded,
    body: new Response(e.bytes).body,
    text: async () => new TextDecoder().decode(e.bytes),
    json: async () => JSON.parse(new TextDecoder().decode(e.bytes)),
    arrayBuffer: async () => e.bytes.buffer.slice(0),
  });
  return {
    store,
    async get(key) { const e = store.get(key); return e ? wrap(key, e) : null; },
    async head(key) { const e = store.get(key); return e ? wrap(key, e) : null; },
    async put(key, value, opts = {}) {
      let bytes;
      if (typeof value === 'string') bytes = new TextEncoder().encode(value);
      else if (value instanceof Uint8Array) bytes = new Uint8Array(value);
      else bytes = new Uint8Array(await new Response(value).arrayBuffer());
      await Promise.resolve(); // cede el turno: permite probar carreras reales
      const cur = store.get(key); // comprobación + escritura sin awaits entre medias (atómico)
      const c = opts.onlyIf;
      if (c) {
        if (c.etagMatches && (!cur || cur.etag !== c.etagMatches)) return null;
        if (c.etagDoesNotMatch === '*' && cur) return null;
      }
      const e = { bytes, etag: `e${++counter}`, httpMetadata: opts.httpMetadata || {}, customMetadata: opts.customMetadata || {}, uploaded: new Date() };
      store.set(key, e);
      return wrap(key, e);
    },
    async delete(keys) { for (const k of Array.isArray(keys) ? keys : [keys]) store.delete(k); },
    async list({ prefix = '', cursor, limit } = {}) {
      const all = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const n = Math.min(limit || pageSize, pageSize);
      const slice = all.slice(start, start + n);
      return {
        objects: slice.map((k) => wrap(k, store.get(k))),
        truncated: start + n < all.length,
        cursor: start + n < all.length ? String(start + n) : undefined,
      };
    },
  };
}

// ---- Claves RSA (WebCrypto) y JWKS simulado ----
export async function makeKeyPair(kid = 'kid-1') {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid, alg: 'RS256', use: 'sig' };
  return { privateKey: pair.privateKey, publicKey: pair.publicKey, jwk, kid };
}

export async function makeKit() {
  const good = await makeKeyPair('kid-1');
  const other = await makeKeyPair('kid-2'); // no está en el JWKS
  const getKey = createLocalJWKSet({ keys: [good.jwk] });
  const nowS = () => Math.floor(Date.now() / 1000);

  async function sign(over = {}, { key = good, alg = 'RS256', kid = key.kid } = {}) {
    const claims = {
      email: OWNER, email_verified: true, sub: 'uid-1',
      iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT,
      iat: nowS(), exp: nowS() + 3600, ...over,
    };
    for (const k of Object.keys(claims)) if (claims[k] === undefined) delete claims[k];
    return new SignJWT(claims).setProtectedHeader({ alg, kid }).sign(key.privateKey);
  }
  return { good, other, getKey, sign, nowS };
}

export const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

export function makeEnv(extra = {}) {
  return { MEDIA: makeR2(), FIREBASE_PROJECT_ID: PROJECT, ALLOWED_EMAILS: `${OWNER}, Otra@Example.com`, ...extra };
}

// App lista: reloj que avanza 1 s por llamada (versiones únicas y ordenadas).
export async function setup({ env = makeEnv(), clock = true } = {}) {
  const kit = await makeKit();
  let t = Date.now();
  const now = clock ? () => new Date((t += 1000)) : () => new Date();
  const app = createApp({ getKey: kit.getKey, now });
  const token = await kit.sign();
  const call = (path, { method = 'GET', headers = {}, json, body, token: tk = token } = {}) => {
    const h = { ...headers };
    if (tk) h.authorization = `Bearer ${tk}`;
    let b = body;
    if (json !== undefined) { b = JSON.stringify(json); h['content-type'] = 'application/json'; }
    const init = { method, headers: h };
    if (b !== undefined) { init.body = b; init.duplex = 'half'; }
    return app.fetch(new Request(`https://admin.allin1jax.com${path}`, init), env, {});
  };
  return { app, env, kit, call, token };
}

export const JPEG = (n = 100) => { const b = new Uint8Array(n); b.set([0xff, 0xd8, 0xff, 0xe0]); return b; };

export function validContent(over = {}) {
  return {
    settings: { email: 'info@example.com', social: { facebook: 'https://www.facebook.com/allin1' }, showLicensed: true, licenseNumber: 'CGC-123' },
    gallery: [{ id: 'g1', type: 'image', category: 'interior', src: 'assets/gallery/ba-1-after.jpg', w: 800, h: 600, caption: { es: 'Cocina' } }],
    beforeAfter: [],
    reviews: [{ id: 'r1', name: 'Ana', text: { es: 'Excelente trabajo' }, source: 'google', date: '2026-01' }],
    ...over,
  };
}

export async function upload(call, bytes, { kind = 'photo', type = 'image/jpeg', token } = {}) {
  return call('/api/upload', { method: 'POST', headers: { 'x-kind': kind, 'content-type': type }, body: bytes, token });
}
