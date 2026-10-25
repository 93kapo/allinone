// Ayudas HTTP: cabeceras de seguridad, respuestas JSON, CORS y lectura de cuerpo con tope.

export const CSP =
  "default-src 'none'; script-src 'self' https://www.gstatic.com; " +
  "connect-src 'self' https://*.googleapis.com https://identitytoolkit.googleapis.com " +
  "https://securetoken.googleapis.com https://firebaseinstallations.googleapis.com; " +
  "img-src 'self' https://media.allin1jax.com https://i.ytimg.com data: blob:; " +
  "style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export const SECURITY_HEADERS = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex',
  'strict-transport-security': 'max-age=31536000',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

export const ALLOWED_ORIGINS = new Set(['https://allin1jax.com', 'https://www.allin1jax.com']);

export function withSecurity(resp) {
  const headers = new Headers(resp.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(resp.status === 204 || resp.status === 304 ? null : resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extra,
    },
  });
}

// Error genérico en español. `extra` puede traer { errores: [{campo, mensaje}] }.
export function fail(status, mensaje, extra = {}, headers = {}) {
  return json({ error: mensaje, ...extra }, status, headers);
}

// CORS solo para el sitio público, y solo en GET /api/content.
export function publicCorsHeaders(request) {
  const h = { vary: 'Origin' };
  const origin = request.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    h['access-control-allow-origin'] = origin;
    h['access-control-expose-headers'] = 'ETag';
  }
  return h;
}

// Lee el cuerpo contando bytes REALES. Corta en cuanto se pasa del tope:
// en memoria nunca hay más de `cap` bytes (el trozo que cruza el tope se descarta).
export async function readBodyCapped(request, cap) {
  if (!request.body) return { bytes: new Uint8Array(0) };
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      try { await reader.cancel(); } catch { /* nada */ }
      return { tooLarge: true };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { bytes.set(c, off); off += c.byteLength; }
  return { bytes };
}

export function stripEtag(v) {
  return String(v || '').trim().replace(/^W\//, '').replace(/^"(.*)"$/, '$1');
}
