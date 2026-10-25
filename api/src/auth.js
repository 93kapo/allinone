// Verificación del ID token de Firebase (RS256) con jose. Falla cerrada.
import { createRemoteJWKSet, jwtVerify } from 'jose';

export const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

export function createRemoteKeyResolver() {
  return createRemoteJWKSet(new URL(JWKS_URL));
}

const TOKEN_ERROR_CODES = new Set([
  'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JWKS_NO_MATCHING_KEY',
  'ERR_JWKS_MULTIPLE_MATCHING_KEYS',
  'ERR_JOSE_NOT_SUPPORTED',
]);

// Solo estos errores significan "el token es malo" (401). Cualquier otro (red, JWKS caído,
// JWKS inválido, error inesperado) significa "no pude verificar" => 503, nunca 200.
function isTokenError(e) {
  const c = e && e.code;
  return typeof c === 'string' && (c.startsWith('ERR_JWT_') || c.startsWith('ERR_JWS_') || TOKEN_ERROR_CODES.has(c));
}

export function parseAllowed(list) {
  return new Set(String(list || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
}

const MSG = {
  401: 'Inicia sesión de nuevo.',
  403: 'No tienes permiso para esta acción.',
  503: 'El servicio no está disponible por ahora. Intenta más tarde.',
};
const bad = (status) => ({ ok: false, status, mensaje: MSG[status] });

export async function authenticate(request, env, { getKey, now = () => new Date() }) {
  if (env.ADMIN_DISABLED === '1') return bad(503);
  if (!env.FIREBASE_PROJECT_ID) return bad(503);

  // El token SOLO viaja en Authorization: Bearer. Nada de URL ni cookies.
  const m = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*)$/.exec(request.headers.get('authorization') || '');
  if (!m) return bad(401);

  let payload;
  try {
    ({ payload } = await jwtVerify(m[1], getKey, {
      algorithms: ['RS256'],
      issuer: 'https://securetoken.google.com/' + env.FIREBASE_PROJECT_ID,
      audience: env.FIREBASE_PROJECT_ID,
      clockTolerance: 60,
      currentDate: now(),
      requiredClaims: ['exp', 'iat', 'sub'],
    }));
  } catch (e) {
    return bad(isTokenError(e) ? 401 : 503);
  }

  const nowSec = Math.floor(now().getTime() / 1000);
  if (typeof payload.sub !== 'string' || !payload.sub) return bad(401);
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 60) return bad(401);
  if (payload.email_verified !== true) return bad(403);
  if (typeof payload.email !== 'string') return bad(403);
  const email = payload.email.trim().toLowerCase();
  if (!email || !parseAllowed(env.ALLOWED_EMAILS).has(email)) return bad(403);
  return { ok: true, uid: payload.sub, email };
}
