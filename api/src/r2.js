// Utilidades de R2: claves, JSON y actualización atómica con precondición (compare-and-swap).

export const KEYS = {
  current: 'content/current.json',
  manifest: 'content/media-manifest.json',
  versionPrefix: 'content/v-',
  version: (v) => `content/v-${v}.json`,
  quota: (hash, date) => `content/quota/${hash}/${date}.json`,
};

export const VERSION_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z-[a-z0-9]{6}$/;
const JSON_META = { contentType: 'application/json; charset=utf-8' };

export async function getJSON(bucket, key) {
  const obj = await bucket.get(key);
  if (!obj) return { obj: null, data: null };
  return { obj, data: await obj.json() };
}

export function putJSON(bucket, key, data, opts = {}) {
  return bucket.put(key, JSON.stringify(data), { httpMetadata: JSON_META, ...opts });
}

// Lee, aplica mutate(actual) y escribe solo si nadie cambió el objeto entretanto.
// mutate devuelve { write, result } o { abort: valor }.
export async function casUpdate(bucket, key, mutate, retries = 6) {
  for (let i = 0; i < retries; i++) {
    const { obj, data } = await getJSON(bucket, key);
    const r = await mutate(data);
    if (r.abort !== undefined) return { aborted: true, value: r.abort };
    const put = await putJSON(bucket, key, r.write, {
      onlyIf: obj ? { etagMatches: obj.etag } : { etagDoesNotMatch: '*' },
    });
    if (put) return { aborted: false, value: r.result };
  }
  throw new Error('cas-agotado');
}

export async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomSuffix(n = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => (b % 36).toString(36)).join('');
}
