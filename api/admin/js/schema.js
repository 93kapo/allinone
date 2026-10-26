// Validador ESTRICTO y puro del contenido del sitio. Sin acceso a red ni a R2.
// Devuelve { ok, errores:[{campo, mensaje}], value } con textos normalizados e ids generados.

export const MAX_BYTES = 256 * 1024;
export const MAX_GALLERY = 300;
export const MAX_BEFORE_AFTER = 30;
export const MAX_REVIEWS = 30;
const MAX_ERRORS = 50;

const ROOT_KEYS = ['schemaVersion', 'version', 'updatedAt', 'updatedBy', 'settings', 'gallery', 'beforeAfter', 'reviews'];
const SETTINGS_KEYS = ['email', 'social', 'showLicensed', 'licenseNumber'];
const NETWORKS = {
  facebook: ['facebook.com'],
  instagram: ['instagram.com'],
  google: ['google.com', 'maps.app.goo.gl', 'g.page'],
  youtube: ['youtube.com', 'youtu.be'],
  tiktok: ['tiktok.com'],
};
const GALLERY_KEYS = ['id', 'type', 'category', 'src', 'youtubeId', 'poster', 'w', 'h', 'caption', 'alt', 'hidden', 'focus'];
const BA_KEYS = ['id', 'before', 'after', 'alt', 'caption', 'hidden', 'focusBefore', 'focusAfter', 'zoomBefore', 'zoomAfter', 'shape'];
const SHAPES = ['wide', 'tall', 'square'];
const REVIEW_KEYS = ['id', 'name', 'text', 'source', 'date', 'hidden'];
const CATEGORIES = ['interior', 'exterior', 'remodeling'];
const SOURCES = ['google', 'facebook', 'nextdoor', 'directo'];

const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const MEDIA_RE = new RegExp(`^media/${UUID_RE}(-t|-p)?\\.(jpg|png|webp)$`); // fotos, miniaturas (-t) y carteles (-p)
const VIDEO_RE = new RegExp(`^media/${UUID_RE}\\.(mp4|mov|webm)$`);
// Único video "heredado" del sitio que sigue permitido por ruta (lista blanca exacta).
export const LEGACY_VIDEOS = new Set(['assets/gallery/allin1.mp4']);
const ASSET_RE = /^assets\/gallery\/[A-Za-z0-9][A-Za-z0-9_-]{0,79}(\.[A-Za-z0-9_-]{1,10}){0,2}$/;
const ASSET_EXT_RE = /\.(jpg|jpeg|png|webp)$/i;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const EMAIL_RE = /^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]{2,}$/;

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
};
const get = (o, k) => (hasOwn(o, k) ? o[k] : undefined);
const len = (s) => Array.from(s).length;

// NFC, sin caracteres de control ni bidi, sin espacios en los extremos.
export function cleanText(s) {
  return s
    .normalize('NFC')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/[\u0000-\u001F\u007F-\u009F‪-‮⁦-⁩‎‏]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

export function videoOk(ref, mediaKeys) {
  if (typeof ref !== 'string') return false;
  if (LEGACY_VIDEOS.has(ref)) return true;
  return VIDEO_RE.test(ref) && mediaKeys.has(ref);
}

export function mediaOk(ref, mediaKeys) {
  if (typeof ref !== 'string') return false;
  if (ASSET_RE.test(ref) && !ref.includes('..') && ASSET_EXT_RE.test(ref)) return true;
  return MEDIA_RE.test(ref) && mediaKeys.has(ref);
}

export function collectMediaKeys(c) {
  const out = new Set();
  const add = (k) => { if (typeof k === 'string' && k.startsWith('media/')) out.add(k); };
  for (const g of c.gallery || []) { add(g.src); add(g.poster); }
  for (const b of c.beforeAfter || []) { add(b.before); add(b.after); }
  return out;
}

function randomId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export function validateContent(input, opts = {}) {
  const mediaKeys = opts.mediaKeys || new Set();
  const now = opts.now || new Date();
  const newId = opts.newId || randomId;
  const errores = [];
  const err = (campo, mensaje) => { if (errores.length < MAX_ERRORS) errores.push({ campo, mensaje }); };
  const done = () => ({ ok: errores.length === 0, errores, value: errores.length ? null : value });
  let value = null;

  if (!isObj(input)) { err('', 'El contenido no tiene el formato correcto.'); return done(); }
  let size;
  try { size = new TextEncoder().encode(JSON.stringify(input)).length; } catch { size = Infinity; }
  if (size > MAX_BYTES) { err('', 'El contenido es demasiado grande (máximo 256 KB).'); return done(); }

  const checkKeys = (o, allowed, path) => {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) err(path ? `${path}.${k}` : k, 'Este campo no está permitido.');
  };
  const str = (v, path, max, { required = false, label = 'Este texto' } = {}) => {
    if (v === undefined || v === null) { if (required) err(path, `${label} es obligatorio.`); return ''; }
    if (typeof v !== 'string') { err(path, `${label} debe ser texto.`); return ''; }
    const t = cleanText(v);
    if (/[<>]/.test(t)) { err(path, `${label} no puede llevar los signos < o >.`); return ''; }
    if (len(t) > max) { err(path, `${label} es demasiado largo (máximo ${max} caracteres).`); return t; }
    if (required && !t) err(path, `${label} es obligatorio.`);
    return t;
  };
  const bool = (v, path) => {
    if (v === undefined) return false;
    if (typeof v !== 'boolean') { err(path, 'Debe ser sí o no.'); return false; }
    return v;
  };
  const sub = (o, k, path) => {
    const v = get(o, k);
    if (v === undefined) return {};
    if (!isObj(v)) { err(path, 'Formato incorrecto.'); return {}; }
    return v;
  };
  const arr = (v, path, max) => {
    if (!Array.isArray(v)) { err(path, 'Debe ser una lista.'); return null; }
    if (v.length > max) { err(path, `Hay demasiados elementos (máximo ${max}).`); return null; }
    return v;
  };
  const idOf = (item, path, seen) => {
    let id = get(item, 'id');
    if (id === undefined || id === null || id === '') {
      do { id = newId(); } while (seen.has(id));
    } else if (typeof id !== 'string' || !ID_RE.test(id)) {
      err(`${path}.id`, 'El identificador no es válido.');
      return null;
    }
    if (seen.has(id)) { err(`${path}.id`, 'El identificador está repetido.'); return null; }
    seen.add(id);
    return id;
  };
  const media = (v, path, label) => {
    if (v === undefined || v === null || v === '') { err(path, `${label} es obligatoria.`); return ''; }
    if (!mediaOk(v, mediaKeys)) { err(path, `${label} no es válida o no se subió al sitio.`); return ''; }
    return v;
  };
  const video = (v, path) => {
    if (v === undefined || v === null || v === '') { err(path, 'El video es obligatorio.'); return ''; }
    if (!videoOk(v, mediaKeys)) { err(path, 'El video no es válido o no se subió al sitio.'); return ''; }
    return v;
  };
  // Encuadre opcional: punto focal {x,y} (enteros 0-100), zoom 1-3 y forma del marco.
  const focus = (o, k, path) => {
    const v = get(o, k);
    if (v === undefined || v === null) return undefined;
    if (!isObj(v)) { err(path, 'El punto de enfoque no es válido.'); return undefined; }
    checkKeys(v, ['x', 'y'], path);
    const x = get(v, 'x'), y = get(v, 'y');
    if (!Number.isInteger(x) || x < 0 || x > 100 || !Number.isInteger(y) || y < 0 || y > 100) { err(path, 'El punto de enfoque debe tener x e y enteros entre 0 y 100.'); return undefined; }
    return { x, y };
  };
  const zoom = (o, k, path) => {
    const v = get(o, k);
    if (v === undefined || v === null) return undefined;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > 3) { err(path, 'El acercamiento debe ser un número entre 1 y 3.'); return undefined; }
    return Math.round(v * 100) / 100;
  };
  const pair = (o, k, path, maxEs, maxEn, needEs) => {
    const p = sub(o, k, path);
    checkKeys(p, ['es', 'en'], path);
    return {
      es: str(get(p, 'es'), `${path}.es`, maxEs, { required: needEs, label: 'El texto en español' }),
      en: str(get(p, 'en'), `${path}.en`, maxEn, { label: 'El texto en inglés' }),
    };
  };

  checkKeys(input, ROOT_KEYS, '');
  for (const k of ['settings', 'gallery', 'beforeAfter', 'reviews']) {
    if (!hasOwn(input, k)) err(k, 'Falta esta sección.');
  }
  for (const k of ['version', 'updatedAt', 'updatedBy']) {
    if (hasOwn(input, k) && typeof input[k] !== 'string') err(k, 'Debe ser texto.');
  }
  if (hasOwn(input, 'schemaVersion') && input.schemaVersion !== 1) err('schemaVersion', 'Versión de formato no compatible.');

  // settings
  let settings = null;
  if (hasOwn(input, 'settings')) {
    const s = input.settings;
    if (!isObj(s)) err('settings', 'Formato incorrecto.');
    else {
      checkKeys(s, SETTINGS_KEYS, 'settings');
      const email = str(get(s, 'email'), 'settings.email', 100, { label: 'El correo' });
      if (email && !EMAIL_RE.test(email)) err('settings.email', 'El correo no es válido.');
      const soc = sub(s, 'social', 'settings.social');
      checkKeys(soc, Object.keys(NETWORKS), 'settings.social');
      const social = {};
      for (const [net, hosts] of Object.entries(NETWORKS)) {
        const path = `settings.social.${net}`;
        const raw = get(soc, net);
        if (raw === undefined || raw === null || raw === '') { social[net] = ''; continue; }
        if (typeof raw !== 'string') { err(path, 'Debe ser un enlace.'); social[net] = ''; continue; }
        const t = raw.trim();
        let url = null;
        try { url = /[\s<>"'\\\u0000-\u001F]/.test(t) || t.length > 300 ? null : new URL(t); } catch { url = null; }
        const host = url ? url.hostname.toLowerCase() : '';
        const okHost = hosts.some((h) => host === h || host === `www.${h}` || host === `m.${h}`);
        if (!url || url.protocol !== 'https:' || url.username || url.password || url.port || !okHost) {
          err(path, 'El enlace no es válido para esta red social (debe empezar con https:// y ser de su sitio oficial).');
          social[net] = '';
        } else social[net] = url.href;
      }
      let license = get(s, 'licenseNumber');
      if (license === undefined || license === null) license = '';
      if (typeof license !== 'string' || (license !== '' && !/^[A-Z0-9-]{1,20}$/.test(license))) {
        err('settings.licenseNumber', 'El número de licencia solo puede tener letras mayúsculas, números y guiones (máximo 20).');
        license = '';
      }
      settings = { email, social, showLicensed: bool(get(s, 'showLicensed'), 'settings.showLicensed'), licenseNumber: license };
    }
  }

  // gallery
  let gallery = null;
  if (hasOwn(input, 'gallery')) {
    const list = arr(input.gallery, 'gallery', MAX_GALLERY);
    if (list) {
      const seen = new Set();
      gallery = [];
      list.forEach((item, i) => {
        const p = `gallery[${i}]`;
        if (!isObj(item)) { err(p, 'Formato incorrecto.'); return; }
        checkKeys(item, GALLERY_KEYS, p);
        const id = idOf(item, p, seen);
        const type = get(item, 'type');
        if (type !== 'image' && type !== 'youtube' && type !== 'video') err(`${p}.type`, 'El tipo debe ser foto, video o video de YouTube.');
        const category = get(item, 'category');
        if (!CATEGORIES.includes(category)) err(`${p}.category`, 'La categoría no es válida.');
        const out = { id, type, category };
        if (type === 'image') {
          out.src = media(get(item, 'src'), `${p}.src`, 'La foto');
          if (hasOwn(item, 'youtubeId')) err(`${p}.youtubeId`, 'Una foto no lleva código de YouTube.');
        } else if (type === 'video') {
          out.src = video(get(item, 'src'), `${p}.src`);
          if (hasOwn(item, 'youtubeId')) err(`${p}.youtubeId`, 'Un video subido no lleva código de YouTube.');
        } else if (type === 'youtube') {
          const yt = get(item, 'youtubeId');
          if (typeof yt !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(yt)) err(`${p}.youtubeId`, 'El código de YouTube no es válido.');
          out.youtubeId = typeof yt === 'string' ? yt : '';
          if (hasOwn(item, 'src')) err(`${p}.src`, 'Un video de YouTube no lleva foto en este campo.');
        }
        const poster = get(item, 'poster');
        if (type === 'video') out.poster = media(poster, `${p}.poster`, 'La imagen de portada');
        else if (poster !== undefined && poster !== null && poster !== '') out.poster = media(poster, `${p}.poster`, 'La imagen de portada');
        for (const d of ['w', 'h']) {
          const v = get(item, d);
          if (v === undefined && type !== 'image') { out[d] = d === 'w' ? 1280 : 720; continue; }
          if (!Number.isInteger(v) || v < 1 || v > 4000) { err(`${p}.${d}`, 'La medida debe ser un número entero entre 1 y 4000.'); out[d] = 0; } else out[d] = v;
        }
        const caption = pair(item, 'caption', `${p}.caption`, 80, 80, true);
        const altIn = pair(item, 'alt', `${p}.alt`, 160, 160, false);
        out.caption = caption;
        out.alt = { es: altIn.es || caption.es, en: altIn.en || caption.en || caption.es };
        out.hidden = bool(get(item, 'hidden'), `${p}.hidden`);
        const gf = focus(item, 'focus', `${p}.focus`);
        if (gf) out.focus = gf;
        gallery.push(out);
      });
    }
  }

  // beforeAfter
  let beforeAfter = null;
  if (hasOwn(input, 'beforeAfter')) {
    const list = arr(input.beforeAfter, 'beforeAfter', MAX_BEFORE_AFTER);
    if (list) {
      const seen = new Set();
      beforeAfter = [];
      list.forEach((item, i) => {
        const p = `beforeAfter[${i}]`;
        if (!isObj(item)) { err(p, 'Formato incorrecto.'); return; }
        checkKeys(item, BA_KEYS, p);
        const id = idOf(item, p, seen);
        const before = media(get(item, 'before'), `${p}.before`, 'La foto del antes');
        const after = media(get(item, 'after'), `${p}.after`, 'La foto del después');
        const caption = pair(item, 'caption', `${p}.caption`, 80, 80, false);
        const altIn = pair(item, 'alt', `${p}.alt`, 160, 160, false);
        const alt = { es: altIn.es || caption.es, en: altIn.en || caption.en || caption.es };
        if (!alt.es) err(`${p}.alt.es`, 'Escribe una descripción de la foto en español.');
        const ba = { id, before, after, alt, caption, hidden: bool(get(item, 'hidden'), `${p}.hidden`) };
        for (const [k, fn] of [['focusBefore', focus], ['focusAfter', focus], ['zoomBefore', zoom], ['zoomAfter', zoom]]) {
          const v = fn(item, k, `${p}.${k}`);
          if (v !== undefined) ba[k] = v;
        }
        const shape = get(item, 'shape');
        if (shape !== undefined && shape !== null) {
          if (!SHAPES.includes(shape)) err(`${p}.shape`, 'La forma del marco debe ser horizontal, vertical o cuadrada.'); else ba.shape = shape;
        }
        beforeAfter.push(ba);
      });
    }
  }

  // reviews
  let reviews = null;
  if (hasOwn(input, 'reviews')) {
    const list = arr(input.reviews, 'reviews', MAX_REVIEWS);
    if (list) {
      const seen = new Set();
      const ym = now.toISOString().slice(0, 7);
      reviews = [];
      list.forEach((item, i) => {
        const p = `reviews[${i}]`;
        if (!isObj(item)) { err(p, 'Formato incorrecto.'); return; }
        checkKeys(item, REVIEW_KEYS, p);
        const id = idOf(item, p, seen);
        const name = str(get(item, 'name'), `${p}.name`, 40, { required: true, label: 'El nombre' });
        const text = pair(item, 'text', `${p}.text`, 600, 600, true);
        const source = get(item, 'source');
        if (!SOURCES.includes(source)) err(`${p}.source`, 'El origen de la reseña no es válido.');
        const date = get(item, 'date');
        if (typeof date !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(date)) err(`${p}.date`, 'La fecha debe ser AAAA-MM, por ejemplo 2026-03.');
        else if (date > ym) err(`${p}.date`, 'La fecha no puede ser en el futuro.');
        reviews.push({ id, name, text, source, date, hidden: bool(get(item, 'hidden'), `${p}.hidden`) });
      });
    }
  }

  value = { settings, gallery, beforeAfter, reviews };
  return done();
}
