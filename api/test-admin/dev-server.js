// Servidor de PRUEBAS locales (no es producción, no usa Firebase real):
//  - sirve admin/ con las cabeceras reales de admin/_headers (CSP incluida),
//  - /api/* es el Worker REAL (src/index.js) con R2 simulado en memoria y claves de prueba,
//  - /__dev/* y /__mock/* y /__media/* son ayudas de prueba.
// Uso: node test-admin/dev-server.js [puerto]   (por defecto 8786)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/index.js';
import { makeEnv, makeKit } from '../test/helpers.js';

const ROOT = resolve(fileURLToPath(new URL('../admin', import.meta.url)));
const MOCK = resolve(fileURLToPath(new URL('./mock', import.meta.url)));
const PORT = Number(process.argv[2] || process.env.PORT || 8786);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg' };

async function staticHeaders() {
  const txt = await readFile(join(ROOT, '_headers'), 'utf8');
  const out = {};
  for (const line of txt.split('\n').slice(1)) {
    const m = /^\s+([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (m) out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}

let env = makeEnv({ ALLOWED_EMAILS: 'dueno@example.com' });
const kit = await makeKit();
const app = createApp({ getKey: kit.getKey });
const HEADERS = await staticHeaders();

const body = async (req) => { const c = []; for await (const x of req) c.push(x); return Buffer.concat(c); };

async function callApi(method, path, { token, json, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  let b;
  if (json !== undefined) { b = JSON.stringify(json); h['content-type'] = 'application/json'; }
  return app.fetch(new Request(`http://localhost:${PORT}${path}`, { method, headers: h, body: b }), env, {});
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const p = url.pathname;
    if (p.startsWith('/api/')) {
      const buf = ['GET', 'HEAD'].includes(req.method) ? undefined : await body(req);
      const hdrs = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string' && k !== 'host') hdrs.set(k, v);
      const r = await app.fetch(new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers: hdrs, body: buf && buf.length ? buf : undefined }), env, {});
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    if (p === '/__dev/token') {
      const email = url.searchParams.get('email') || '';
      const token = await kit.sign({ email, email_verified: url.searchParams.get('verified') !== '0' });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ token }));
      return;
    }
    if (p === '/__dev/reset') { env = makeEnv({ ALLOWED_EMAILS: 'dueno@example.com' }); res.writeHead(200); res.end('ok'); return; }
    if (p === '/__dev/bump') { // otro "usuario" cambia la página (para probar el error 409)
      const token = await kit.sign({ email: 'dueno@example.com' });
      const cur = await (await callApi('GET', '/api/content')).json();
      const next = { ...cur, settings: { ...cur.settings, email: 'otra-persona@example.com' } };
      for (const k of ['schemaVersion', 'version', 'updatedAt', 'updatedBy']) delete next[k];
      const r = await callApi('PUT', '/api/content', { token, json: next, headers: { 'if-match': cur.version } });
      res.writeHead(r.status); res.end(await r.text()); return;
    }
    if (p === '/__dev/state') {
      const keys = [...env.MEDIA.store.keys()];
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ keys })); return;
    }
    if (p.startsWith('/__media/')) {
      const o = await env.MEDIA.get(decodeURIComponent(p.slice('/__media/'.length)));
      if (!o) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': o.httpMetadata.contentType || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(Buffer.from(await o.arrayBuffer()));
      return;
    }
    let file;
    if (p === '/__mock/auth-mock.js') file = join(MOCK, 'auth-mock.js');
    else {
      const rel = normalize(decodeURIComponent(p === '/' ? '/index.html' : p));
      file = join(ROOT, rel);
      if (!file.startsWith(ROOT + '/') || rel.endsWith('_headers')) { res.writeHead(404, HEADERS); res.end('no'); return; }
    }
    try {
      const data = await readFile(file);
      res.writeHead(200, { ...HEADERS, 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    } catch { res.writeHead(404, HEADERS); res.end('no'); }
  } catch (e) {
    console.error(e);
    res.writeHead(500); res.end('error');
  }
}).listen(PORT, () => console.log(`panel de pruebas en http://localhost:${PORT}/?mock=1`));
