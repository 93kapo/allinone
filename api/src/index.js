// Worker allin1-api: panel estático (assets) + API en /api/* en el mismo origen.
import { authenticate, createRemoteKeyResolver } from './auth.js';
import { fail, withSecurity } from './http.js';
import { createLimiter } from './ratelimit.js';
import * as h from './handlers.js';

const AUTH_ROUTES = {
  '/api/content': { PUT: 'put' },
  '/api/history': { GET: 'history' },
  '/api/restore': { POST: 'restore' },
  '/api/upload': { POST: 'upload' },
  '/api/me': { GET: 'me' },
};

// getKey y now se pueden inyectar en pruebas.
export function createApp({ getKey, now = () => new Date() } = {}) {
  const limiter = createLimiter(() => now().getTime());
  let remote = null;
  const keys = (...a) => (getKey ? getKey(...a) : (remote ||= createRemoteKeyResolver())(...a));
  const deps = { now };

  async function route(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method;
    if (!path.startsWith('/api/')) {
      return env.ASSETS ? env.ASSETS.fetch(request) : fail(404, 'No encontrado.');
    }

    const ip = request.headers.get('cf-connecting-ip') || 'desconocida';
    if (!limiter.hit(`ip:${ip}`, 300)) return fail(429, 'Demasiadas solicitudes. Espera un momento.', {}, { 'retry-after': '60' });

    if (path === '/api/content') {
      if (method === 'GET') return h.getContent(request, env);
      if (method === 'OPTIONS') return h.preflightContent(request);
    }

    const allowed = AUTH_ROUTES[path];
    if (!allowed) return fail(404, 'No encontrado.');
    if (method === 'OPTIONS') return new Response(null, { status: 204 }); // sin CORS: solo mismo origen
    const action = allowed[method];
    if (!action) return fail(405, 'Método no permitido.', {}, { allow: Object.keys(allowed).join(', ') });

    if (limiter.over(`fail:${ip}`, 20)) return fail(429, 'Demasiados intentos. Espera un momento.', {}, { 'retry-after': '60' });
    const auth = await authenticate(request, env, { getKey: keys, now });
    if (!auth.ok) {
      if (auth.status !== 503) limiter.hit(`fail:${ip}`, 20);
      return fail(auth.status, auth.mensaje);
    }
    const user = { email: auth.email, uid: auth.uid };
    if (!limiter.hit(`user:${user.email}`, 60)) return fail(429, 'Demasiadas solicitudes. Espera un momento.', {}, { 'retry-after': '60' });

    switch (action) {
      case 'put': return h.putContent(request, env, user, deps);
      case 'history': return h.getHistory(env);
      case 'restore': return h.postRestore(request, env, user, deps);
      case 'upload':
        if (!limiter.hit(`up:${user.email}`, 20)) return fail(429, 'Demasiadas subidas seguidas. Espera un momento.', {}, { 'retry-after': '60' });
        return h.postUpload(request, env, user, deps);
      case 'me': return h.getMe(env, user, deps);
      default: return fail(404, 'No encontrado.');
    }
  }

  return {
    async fetch(request, env, ctx) {
      try {
        return withSecurity(await route(request, env, ctx));
      } catch (e) {
        console.error('error-interno', e && e.name); // sin detalles hacia afuera
        return withSecurity(fail(500, 'Ocurrió un error. Intenta de nuevo.'));
      }
    },
  };
}

export default createApp();
