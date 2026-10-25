// Manejadores de cada endpoint. Todos devuelven Response JSON con mensajes en español.
import { fail, json, publicCorsHeaders, readBodyCapped, stripEtag } from './http.js';
import { KEYS, VERSION_RE, getJSON } from './r2.js';
import { MAX_BYTES as CONTENT_MAX, validateContent } from './schema.js';
import { commitContent, listHistory } from './history.js';
import { MAX_BYTES, addToManifest, manifestTotal, maxBucketBytes, mediaKeyFor, mediaKeySet, sniffImage, sniffVideo } from './media.js';
import { getUsage, limitsFrom, quotaMessage, refundVideo, remaining, reserve, reserveVideo } from './quotas.js';

const PUBLIC_CACHE = 'public, max-age=30, stale-while-revalidate=300';
const q = (v) => `"${v}"`;

export async function getContent(request, env) {
  const cors = publicCorsHeaders(request);
  const obj = await env.MEDIA.get(KEYS.current);
  if (!obj) return json({ empty: true }, 404, { ...cors, 'cache-control': 'public, max-age=30' });
  const text = await obj.text();
  let version = '';
  try { version = JSON.parse(text).version || ''; } catch { return fail(500, 'No se pudo leer el contenido.', {}, cors); }
  const headers = { ...cors, etag: q(version), 'cache-control': PUBLIC_CACHE };
  const inm = request.headers.get('if-none-match');
  if (inm && inm.split(',').some((t) => stripEtag(t) === version || t.trim() === '*')) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(text, { status: 200, headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } });
}

export function preflightContent(request) {
  const cors = publicCorsHeaders(request);
  if (cors['access-control-allow-origin']) {
    cors['access-control-allow-methods'] = 'GET, OPTIONS';
    cors['access-control-allow-headers'] = 'If-None-Match';
    cors['access-control-max-age'] = '600';
  }
  return new Response(null, { status: 204, headers: cors });
}

async function readJsonBody(request, cap) {
  const ct = request.headers.get('content-type') || '';
  if (!/^application\/json\b/i.test(ct)) return { res: fail(415, 'El contenido debe enviarse como JSON.') };
  const r = await readBodyCapped(request, cap);
  if (r.tooLarge) return { res: fail(413, 'El contenido es demasiado grande (máximo 256 KB).') };
  try { return { data: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(r.bytes)) }; }
  catch { return { res: fail(400, 'El contenido no es un JSON válido.') }; }
}

const validationFail = (v) => fail(422, 'Revisa los datos marcados.', { errores: v.errores });

export async function putContent(request, env, user, deps) {
  const raw = request.headers.get('if-match');
  if (raw === null) return fail(428, 'Falta la versión del sitio. Recarga la página.');
  const ifMatch = stripEtag(raw);

  const body = await readJsonBody(request, CONTENT_MAX + 1024);
  if (body.res) return body.res;
  const v = validateContent(body.data, { mediaKeys: await mediaKeySet(env), now: deps.now() });
  if (!v.ok) return validationFail(v);

  const r = await commitContent(env, v.value, { email: user.email, now: deps.now(), ifMatch });
  if (r.conflict) return fail(409, 'Alguien cambió el sitio hace un momento, recarga');
  return json(r.content, 200, { etag: q(r.content.version) });
}

export async function getHistory(env) {
  return json({ versiones: await listHistory(env) });
}

export async function postRestore(request, env, user, deps) {
  const body = await readJsonBody(request, 4096);
  if (body.res) return body.res;
  const version = body.data && typeof body.data === 'object' ? body.data.version : undefined;
  if (typeof version !== 'string' || !VERSION_RE.test(version)) {
    return fail(422, 'Revisa los datos marcados.', { errores: [{ campo: 'version', mensaje: 'La versión no es válida.' }] });
  }
  const { data } = await getJSON(env.MEDIA, KEYS.version(version));
  if (!data) return fail(404, 'Esa versión ya no existe.');
  const v = validateContent(data, { mediaKeys: await mediaKeySet(env), now: deps.now() });
  if (!v.ok) return fail(409, 'Esa versión no se puede restaurar.');
  const r = await commitContent(env, v.value, { email: user.email, now: deps.now(), ifMatch: null, restoredFrom: version });
  return json(r.content, 200, { etag: q(r.content.version) });
}

export async function postUpload(request, env, user, deps) {
  const kind = request.headers.get('x-kind');
  if (kind !== 'photo' && kind !== 'thumb' && kind !== 'poster' && kind !== 'video') return fail(400, 'Falta indicar si es foto, miniatura, cartel o video.');
  const now = deps.now();
  if (kind === 'video') return uploadVideo(request, env, user, now);

  // Revisión previa barata (la definitiva es atómica más abajo).
  const lim = limitsFrom(env);
  const usage = await getUsage(env, user.email, now);
  if (usage.files >= lim.files) return fail(429, quotaMessage('archivos', env));

  const r = await readBodyCapped(request, MAX_BYTES[kind]);
  if (r.tooLarge) return fail(413, `El archivo es demasiado grande (máximo ${MAX_BYTES[kind] / 1048576} MB).`);
  if (!r.bytes.length) return fail(400, 'El archivo está vacío.');
  const sniff = sniffImage(r.bytes);
  if (!sniff) return fail(415, 'Solo se aceptan fotos JPG, PNG o WebP.');

  const res = await reserve(env, user.email, r.bytes.length, now);
  if (!res.ok) return fail(429, quotaMessage(res.motivo, env));

  const key = mediaKeyFor(crypto.randomUUID(), kind, sniff.ext);
  await env.MEDIA.put(key, r.bytes, {
    httpMetadata: { contentType: sniff.type, cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { by: user.email },
  });
  const added = await addToManifest(env, { key, size: r.bytes.length, by: user.email, at: now.toISOString(), used: false });
  if (!added.ok) {
    await env.MEDIA.delete(key);
    return fail(507, 'El almacenamiento del sitio está lleno. Avisa a quien administra el sitio.');
  }
  return json({ key, size: r.bytes.length, contentType: sniff.type, kind }, 201);
}

export async function getMe(env, user, deps) {
  return json({ email: user.email, cuotas: await remaining(env, user.email, deps.now()) });
}

// Video: se sube en streaming a R2 (nunca se junta completo en memoria). Exige Content-Length (tope 95 MB):
// el plan gratis de Cloudflare limita el cuerpo a 100 MB. Si el cuerpo real pasa de lo declarado se corta.
async function uploadVideo(request, env, user, now) {
  const cap = MAX_BYTES.video;
  const raw = request.headers.get('content-length');
  const declared = /^\d+$/.test(raw || '') ? Number(raw) : NaN;
  if (!Number.isSafeInteger(declared) || declared <= 0) return fail(411, 'No se pudo saber el tamaño del video. Intenta de nuevo.');
  if (declared > cap) return fail(413, `El video es demasiado grande (máximo ${cap / 1048576} MB).`);
  if (!request.body) return fail(400, 'El archivo está vacío.');

  const reader = request.body.getReader();
  const giveUp = async (res) => { try { await reader.cancel(); } catch { /* nada */ } return res; };
  const pre = [];
  let head = new Uint8Array(0);
  while (head.length < 12) {
    const { done, value } = await reader.read();
    if (done) break;
    pre.push(value);
    const n = new Uint8Array(head.length + value.length); n.set(head); n.set(value, head.length); head = n;
  }
  const sniff = sniffVideo(head);
  if (!sniff) return giveUp(fail(415, 'Solo se aceptan videos MP4 o MOV (el formato normal del iPhone).'));

  if ((await manifestTotal(env)) + declared > maxBucketBytes(env)) {
    return giveUp(fail(507, 'El almacenamiento del sitio está lleno. Avisa a quien administra el sitio.'));
  }
  const res = await reserveVideo(env, user.email, declared, now);
  if (!res.ok) return giveUp(fail(429, quotaMessage(res.motivo, env)));

  const key = mediaKeyFor(crypto.randomUUID(), 'video', sniff.ext);
  let sent = 0;
  const counted = new ReadableStream({
    start(c) { for (const ch of pre) { sent += ch.byteLength; c.enqueue(ch); } if (sent > declared) c.error(new Error('mayor')); },
    async pull(c) {
      const { done, value } = await reader.read();
      if (done) { c.close(); return; }
      sent += value.byteLength;
      if (sent > declared) { c.error(new Error('mayor')); try { await reader.cancel(); } catch { /* nada */ } return; }
      c.enqueue(value);
    },
    cancel() { return reader.cancel(); },
  });
  let body = counted;
  if (typeof FixedLengthStream !== 'undefined') { // en Cloudflare, R2 pide un largo conocido
    const f = new FixedLengthStream(declared);
    counted.pipeTo(f.writable).catch(() => { /* el put falla y se limpia abajo */ });
    body = f.readable;
  }
  const undo = async () => { try { await env.MEDIA.delete(key); } catch { /* nada */ } try { await refundVideo(env, user.email, declared, now); } catch { /* nada */ } };
  try {
    await env.MEDIA.put(key, body, {
      httpMetadata: { contentType: sniff.type, cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { by: user.email },
    });
  } catch {
    await undo();
    return sent > declared ? fail(413, 'El video es más grande de lo indicado.') : fail(400, 'El video no llegó completo. Intenta de nuevo.');
  }
  if (sent !== declared) { await undo(); return fail(400, 'El video no llegó completo. Intenta de nuevo.'); }
  const added = await addToManifest(env, { key, size: declared, by: user.email, at: now.toISOString(), used: false });
  if (!added.ok) { await undo(); return fail(507, 'El almacenamiento del sitio está lleno. Avisa a quien administra el sitio.'); }
  return json({ key, size: declared, contentType: sniff.type, kind: 'video' }, 201);
}
