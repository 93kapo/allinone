/* AIOContent: pure helpers to validate and normalize the editable site content (API JSON or embedded data).
   No DOM, no network. Works in the browser (window.AIOContent) and in Node (vm / module.exports).
   Funciones puras para validar y normalizar el contenido editable del sitio. */
(function (root) {
  'use strict';

  var CATEGORIES = ['interior', 'exterior', 'remodeling'];
  var TYPES = ['image', 'youtube', 'video']; /* 'video' = legacy / read-only in the panel */
  var NETWORKS = ['facebook', 'instagram', 'google', 'youtube', 'tiktok'];
  var HOSTS = {
    facebook: ['facebook.com'],
    instagram: ['instagram.com'],
    google: ['google.com', 'maps.app.goo.gl', 'g.page'],
    youtube: ['youtube.com', 'youtu.be'],
    tiktok: ['tiktok.com']
  };
  var SUB = { 'google.com': 1, 'facebook.com': 1, 'instagram.com': 1, 'youtube.com': 1, 'tiktok.com': 1 }; /* www. and m. allowed */
  var MAX_ITEMS = 200;
  var YT_RE = /^[A-Za-z0-9_-]{11}$/;
  var ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
  var MONTHS = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  };

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function str(v, max) { return typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max || 500) : ''; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function indexOf(a, v) { return a.indexOf(v); }

  /* ---- Social links: https only, host allowed per network, no credentials, no port ---- */
  function safeSocial(network, url) {
    if (typeof network !== 'string' || typeof url !== 'string' || !has(HOSTS, network)) return '';
    var u = url.trim();
    if (!u || u.length > 2048 || /[\s\u0000-\u001f\u007f\\<>"'`]/.test(u)) return '';
    var m = /^https:\/\/([^\/?#]+)([\/?#][\s\S]*)?$/i.exec(u);
    if (!m) return '';
    var host = m[1].toLowerCase(), rest = m[2] || '';
    if (/[@:%]/.test(host) || host.charAt(host.length - 1) === '.' || host.charAt(0) === '.') return '';
    var ok = false, allowed = HOSTS[network];
    for (var i = 0; i < allowed.length; i++) {
      var h = allowed[i];
      if (host === h) { ok = true; break; }
      if (SUB[h] && (host === 'www.' + h || host === 'm.' + h)) { ok = true; break; }
    }
    return ok ? 'https://' + host + rest : '';
  }

  /* ---- Media paths ---- */
  var REL_RE = /^[A-Za-z0-9][A-Za-z0-9._\-\/%+~]*$/;
  function badPath(p) { return !REL_RE.test(p) || /(^|\/)\.\.?(\/|$)/.test(p) || p.indexOf('//') !== -1 || p.length > 500; }
  function cleanOrigin(o) {
    if (typeof o !== 'string') return '';
    var m = /^(https?:\/\/[A-Za-z0-9.\-]+(?::\d{1,5})?)\/?$/i.exec(o.trim());
    return m ? m[1].toLowerCase() : '';
  }
  /* relative -> base + src ; 'media/...' -> mediaOrigin + '/' + key ; absolute only from mediaOrigin ; anything else -> '' */
  function resolveSrc(base, src, mediaOrigin) {
    if (typeof src !== 'string') return '';
    var s = src.trim(), origin = cleanOrigin(mediaOrigin);
    if (!s) return '';
    if (/^[A-Za-z][A-Za-z0-9+.\-]*:/.test(s)) { /* has a scheme: only an absolute URL under mediaOrigin */
      if (!origin || s.length > 600) return '';
      var low = s.toLowerCase();
      if (low.indexOf(origin + '/') !== 0) return '';
      var path = s.slice(origin.length + 1);
      if (!path || badPath(path)) return '';
      return origin + '/' + path;
    }
    if (s.charAt(0) === '/' || s.charAt(0) === '\\' || badPath(s)) return '';
    if (s.indexOf('media/') === 0) return origin ? origin + '/' + s : '';
    return (typeof base === 'string' ? base : '') + s;
  }

  /* ---- YouTube ---- */
  function youtubeThumb(id) { return typeof id === 'string' && YT_RE.test(id) ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : ''; }
  function youtubeEmbed(id) { return typeof id === 'string' && YT_RE.test(id) ? 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0' : ''; }

  /* ---- Validation (tolerant: invalid elements are dropped, unknown keys ignored) ---- */
  function bi(v) { var o = isObj(v) ? v : {}; return { es: str(o.es, 600), en: str(o.en, 600) }; }
  function dim(v) { return typeof v === 'number' && isFinite(v) && v > 0 && v <= 20000 ? Math.round(v) : 0; }

  function validateContent(json) {
    if (!isObj(json) || json.schemaVersion !== 1) return null;
    var version = typeof json.version === 'number' && isFinite(json.version) ? String(json.version) : str(json.version, 100);
    if (!version) return null;
    var out = {
      schemaVersion: 1, version: version, updatedAt: str(json.updatedAt, 40), updatedBy: str(json.updatedBy, 100),
      settings: { email: '', social: {}, showLicensed: false, licenseNumber: '' }, gallery: [], beforeAfter: [], reviews: []
    };
    var i, it, seen;
    var st = isObj(json.settings) ? json.settings : {};
    var email = str(st.email, 200);
    out.settings.email = /^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]+$/.test(email) ? email : '';
    var soc = isObj(st.social) ? st.social : {};
    for (i = 0; i < NETWORKS.length; i++) out.settings.social[NETWORKS[i]] = safeSocial(NETWORKS[i], soc[NETWORKS[i]]);
    out.settings.showLicensed = st.showLicensed === true;
    out.settings.licenseNumber = str(st.licenseNumber, 40);

    seen = {};
    var g = Array.isArray(json.gallery) ? json.gallery.slice(0, MAX_ITEMS) : [];
    for (i = 0; i < g.length; i++) {
      it = g[i];
      if (!isObj(it) || typeof it.id !== 'string' || !ID_RE.test(it.id) || seen[it.id] || indexOf(TYPES, it.type) < 0) continue;
      var e = { id: it.id, type: it.type, category: indexOf(CATEGORIES, it.category) >= 0 ? it.category : '', src: '', youtubeId: '', poster: str(it.poster, 500),
        w: dim(it.w), h: dim(it.h), caption: bi(it.caption), alt: bi(it.alt), hidden: it.hidden === true };
      if (it.type === 'youtube') { if (typeof it.youtubeId !== 'string' || !YT_RE.test(it.youtubeId)) continue; e.youtubeId = it.youtubeId; }
      else { e.src = str(it.src, 500); if (!e.src) continue; }
      seen[it.id] = 1; out.gallery.push(e);
    }

    seen = {};
    var b = Array.isArray(json.beforeAfter) ? json.beforeAfter.slice(0, MAX_ITEMS) : [];
    for (i = 0; i < b.length; i++) {
      it = b[i];
      if (!isObj(it) || typeof it.id !== 'string' || !ID_RE.test(it.id) || seen[it.id]) continue;
      var bf = str(it.before, 500), af = str(it.after, 500);
      if (!bf || !af) continue;
      seen[it.id] = 1; out.beforeAfter.push({ id: it.id, before: bf, after: af, alt: bi(it.alt), caption: bi(it.caption), hidden: it.hidden === true });
    }

    seen = {};
    var r = Array.isArray(json.reviews) ? json.reviews.slice(0, MAX_ITEMS) : [];
    for (i = 0; i < r.length; i++) {
      it = r[i];
      if (!isObj(it) || typeof it.id !== 'string' || !ID_RE.test(it.id) || seen[it.id]) continue;
      var name = str(it.name, 120), text = bi(it.text);
      if (!name || (!text.es && !text.en)) continue;
      var date = typeof it.date === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(it.date.trim()) ? it.date.trim() : '';
      seen[it.id] = 1; out.reviews.push({ id: it.id, name: name, text: text, source: str(it.source, 100), date: date, hidden: it.hidden === true });
    }
    return out;
  }

  /* ---- Views for the renderer (hidden items removed, URLs resolved, order preserved) ---- */
  function pick(o, lang) { return o ? (o[lang] || o[lang === 'es' ? 'en' : 'es'] || '') : ''; }

  function toGalleryItems(content, opts) {
    opts = opts || {};
    var list = content && Array.isArray(content.gallery) ? content.gallery : [], out = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it || it.hidden === true) continue;
      var o = { id: it.id, type: it.type, category: it.category || '', src: '', poster: '', youtubeId: '', thumb: '', embed: '', w: it.w || 0, h: it.h || 0, caption: it.caption || { es: '', en: '' }, alt: it.alt || { es: '', en: '' } };
      if (it.type === 'youtube') {
        o.youtubeId = it.youtubeId; o.embed = youtubeEmbed(it.youtubeId); o.thumb = youtubeThumb(it.youtubeId);
        if (!o.embed) continue;
        if (it.poster) o.poster = resolveSrc(opts.base, it.poster, opts.mediaOrigin);
      } else {
        o.src = resolveSrc(opts.base, it.src, opts.mediaOrigin);
        if (!o.src) continue;
        if (it.poster) o.poster = resolveSrc(opts.base, it.poster, opts.mediaOrigin);
      }
      out.push(o);
    }
    return out;
  }

  function toBeforeAfter(content, opts) {
    opts = opts || {};
    var list = content && Array.isArray(content.beforeAfter) ? content.beforeAfter : [], out = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it || it.hidden === true) continue;
      var bf = resolveSrc(opts.base, it.before, opts.mediaOrigin), af = resolveSrc(opts.base, it.after, opts.mediaOrigin);
      if (!bf || !af) continue;
      out.push({ id: it.id, before: bf, after: af, alt: it.alt || { es: '', en: '' }, caption: it.caption || { es: '', en: '' } });
    }
    return out;
  }

  function formatReviewDate(date, lang) {
    var m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(date || '');
    if (!m) return '';
    var l = lang === 'es' ? 'es' : 'en', name = MONTHS[l][+m[2] - 1];
    return l === 'es' ? name + ' de ' + m[1] : name + ' ' + m[1];
  }

  function toReviews(content, lang) {
    var list = content && Array.isArray(content.reviews) ? content.reviews : [], out = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it || it.hidden === true) continue;
      var text = pick(it.text, lang);
      if (!it.name || !text) continue;
      out.push({ id: it.id, name: it.name, text: text, source: it.source || '', date: it.date || '', dateLabel: formatReviewDate(it.date, lang) });
    }
    return out;
  }

  var api = {
    validateContent: validateContent, safeSocial: safeSocial, resolveSrc: resolveSrc,
    youtubeThumb: youtubeThumb, youtubeEmbed: youtubeEmbed, formatReviewDate: formatReviewDate,
    toGalleryItems: toGalleryItems, toBeforeAfter: toBeforeAfter, toReviews: toReviews,
    CATEGORIES: CATEGORIES, NETWORKS: NETWORKS
  };
  root.AIOContent = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
