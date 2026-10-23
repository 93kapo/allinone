(function () {
  'use strict';
  var doc = document, root = doc.documentElement, body = doc.body;
  root.classList.add('js');
  var lang = (root.lang || 'en').slice(0, 2) === 'es' ? 'es' : 'en';
  var base = lang === 'es' ? '../' : '';
  var cfg = window.SITE_CONFIG || {};
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var motion = root.classList.contains('js-motion') && !reduce;
  var fine = !!(window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches);
  var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
  var canAnim = !reduce && typeof Element.prototype.animate === 'function';
  var EASE = 'cubic-bezier(.16,1,.3,1)';
  var phone = cfg.phone || '';
  var waNum = String(cfg.whatsappNumber || '').replace(/\D/g, '');
  var waOn = cfg.whatsappEnabled !== false && !!waNum;
  window.__aioErrors = [];

  /* Every feature is isolated: one failure never blocks the rest (or leaves content hidden). */
  function safe(name, fn) { try { fn(); } catch (e) { window.__aioErrors.push(name + ': ' + (e && e.message)); } }
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return [].slice.call((c || doc).querySelectorAll(s)); }
  function mk(tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  var T = {
    en: {
      phPhoto: 'Photo placeholder', phVideo: 'Video placeholder', phHint: 'Your project photo or short video goes here', ph: 'Placeholder',
      sending: 'Sending...',
      notConfigured: 'The online form is not connected yet. Please call us at ' + phone + ' for your free estimate.',
      ok: 'Thank you! We received your request and will contact you soon.',
      err: 'Something went wrong. Please try again or call us at ' + phone + '.',
      invalid: 'Please check the highlighted fields.',
      eName: 'Please enter your name.', ePhoneEmpty: 'Please enter a phone number.', ePhone: 'Enter a valid 10-digit phone number.',
      eEmail: 'Enter a valid email address.', eZip: 'Use a 5-digit ZIP code.', eSvc: 'Please choose a service.',
      eSvcW: 'Please choose a service to continue.', ePt: 'Please choose a property type.', eSize: 'Please choose an approximate size.', eUrg: 'Please choose when you would like to start.',
      copied: 'Copied to clipboard', copyFail: 'Could not copy. Please copy it manually.',
      baBefore: 'Before', baAfter: 'After', baPh: 'Before / after placeholder', baPhHint: 'Your before and after photos go here',
      baLabel: 'Before and after comparison. Use the left and right arrow keys to move the divider.', baVal: function (v) { return v + '% before, ' + (100 - v) + '% after'; },
      lbLabel: 'Image viewer', lbClose: 'Close', lbPrev: 'Previous', lbNext: 'Next', lbOf: 'of', open: 'Open',
      step: 'Step', of: 'of', summary: 'Review', next: 'Next', reviewBtn: 'Review estimate',
      sService: 'Service', sPt: 'Property', sSize: 'Size', sUrg: 'Timing', sLoc: 'Location', sName: 'Name', sPhone: 'Phone', sEmail: 'Email',
      sumTitle: 'Review your estimate request', sumHint: 'Nothing has been sent yet. Choose how you want to send it.',
      waSend: 'Send by WhatsApp', callNow: 'Call ' + phone, copySum: 'Copy summary', sendForm: 'Send request', edit: 'Edit answers',
      waOpened: 'WhatsApp opened with your details. Press send there to finish.', formOk: 'Thank you! We received your request and will contact you soon.',
      hello: "Hi! I'd like a free estimate for a project in Jacksonville.",
      cursorOn: 'Custom cursor: on', cursorOff: 'Custom cursor: off',
      more: 'Details', less: 'Hide details', slide: 'of'
    },
    es: {
      phPhoto: 'Espacio para foto', phVideo: 'Espacio para video', phHint: 'Aquí irá la foto o el video corto de un proyecto', ph: 'Espacio reservado',
      sending: 'Enviando...',
      notConfigured: 'El formulario en línea aún no está conectado. Llámanos al ' + phone + ' para tu estimado gratis.',
      ok: '¡Gracias! Recibimos tu solicitud y te contactaremos pronto.',
      err: 'Algo salió mal. Inténtalo de nuevo o llámanos al ' + phone + '.',
      invalid: 'Revisa los campos marcados.',
      eName: 'Escribe tu nombre.', ePhoneEmpty: 'Escribe un número de teléfono.', ePhone: 'Escribe un teléfono válido de 10 dígitos.',
      eEmail: 'Escribe un correo válido.', eZip: 'Usa un código ZIP de 5 dígitos.', eSvc: 'Elige un servicio.',
      eSvcW: 'Elige un servicio para continuar.', ePt: 'Elige el tipo de propiedad.', eSize: 'Elige un tamaño aproximado.', eUrg: 'Elige cuándo te gustaría empezar.',
      copied: 'Copiado al portapapeles', copyFail: 'No se pudo copiar. Cópialo manualmente.',
      baBefore: 'Antes', baAfter: 'Después', baPh: 'Espacio antes / después', baPhHint: 'Aquí irán tus fotos de antes y después',
      baLabel: 'Comparación de antes y después. Usa las flechas izquierda y derecha para mover el divisor.', baVal: function (v) { return v + '% antes, ' + (100 - v) + '% después'; },
      lbLabel: 'Visor de imágenes', lbClose: 'Cerrar', lbPrev: 'Anterior', lbNext: 'Siguiente', lbOf: 'de', open: 'Abrir',
      step: 'Paso', of: 'de', summary: 'Resumen', next: 'Siguiente', reviewBtn: 'Ver resumen',
      sService: 'Servicio', sPt: 'Propiedad', sSize: 'Tamaño', sUrg: 'Plazo', sLoc: 'Ubicación', sName: 'Nombre', sPhone: 'Teléfono', sEmail: 'Correo',
      sumTitle: 'Revisa tu solicitud de estimado', sumHint: 'Aún no se ha enviado nada. Elige cómo quieres enviarla.',
      waSend: 'Enviar por WhatsApp', callNow: 'Llamar al ' + phone, copySum: 'Copiar resumen', sendForm: 'Enviar solicitud', edit: 'Editar respuestas',
      waOpened: 'Se abrió WhatsApp con tus datos. Pulsa enviar allí para terminar.', formOk: '¡Gracias! Recibimos tu solicitud y te contactaremos pronto.',
      hello: '¡Hola! Me gustaría un estimado gratis para un proyecto en Jacksonville.',
      cursorOn: 'Cursor personalizado: activado', cursorOff: 'Cursor personalizado: desactivado',
      more: 'Detalles', less: 'Ocultar detalles', slide: 'de'
    }
  }[lang];

  function waUrl(text) { return 'https://wa.me/' + waNum + '?text=' + encodeURIComponent(text); }
  var main = $('#main');
  function setInert(on) {
    [main, $('.site-footer'), $('#cta-bar'), $('.wa-float')].forEach(function (el) {
      if (!el) return;
      if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert');
    });
  }

  /* ---------- Toast ---------- */
  var toastEl = $('#toast'), toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2400);
  }
  function copyText(txt) {
    function fallback() {
      try {
        var ta = mk('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        body.appendChild(ta); ta.select(); var ok = doc.execCommand('copy'); body.removeChild(ta); toast(ok ? T.copied : T.copyFail);
      } catch (e) { toast(T.copyFail); }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast(T.copied); }, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }

  /* ---------- Basics: contact data, flags ---------- */
  safe('basics', function () {
    $$('[data-phone-link]').forEach(function (a) { if (cfg.phoneTel) a.setAttribute('href', 'tel:' + cfg.phoneTel); });
    $$('[data-phone-text]').forEach(function (el) { if (cfg.phone) el.textContent = cfg.phone; });
    var emailItem = $('#email-item');
    if (emailItem && cfg.email) {
      var ea = $('a', emailItem); ea.href = 'mailto:' + cfg.email; ea.textContent = cfg.email; emailItem.hidden = false;
    }
    var socials = cfg.social || {}, list = $('#social-list');
    if (list) {
      var any = false;
      Object.keys(socials).forEach(function (k) {
        if (!socials[k]) return;
        var li = mk('li'), a = mk('a'); a.href = socials[k]; a.rel = 'noopener noreferrer'; a.target = '_blank';
        a.textContent = k.charAt(0).toUpperCase() + k.slice(1); li.appendChild(a); list.appendChild(li); any = true;
      });
      if (any && list.parentNode) list.parentNode.hidden = false;
    }
    if (cfg.showLicensed) {
      $$('.lic').forEach(function (el) {
        el.classList.add('show');
        if (cfg.licenseNumber && el.hasAttribute('data-lic-number')) el.textContent += ' · ' + (lang === 'es' ? 'Licencia' : 'License') + ' #' + cfg.licenseNumber;
      });
      var hb = $('#hero-badge'); if (hb) hb.hidden = false;
      var tl = $('[data-trust-lic]');
      if (tl) {
        tl.classList.add('real');
        tl.innerHTML = '<strong></strong>' + (cfg.licenseNumber ? '<span></span>' : '');
        $('strong', tl).textContent = lang === 'es' ? 'Licenciados y asegurados' : 'Licensed & Insured';
        if (cfg.licenseNumber) $('span', tl).textContent = (lang === 'es' ? 'Licencia' : 'License') + ' #' + cfg.licenseNumber;
      }
    }
    $$('[data-wa]').forEach(function (a) {
      if (!waOn) { a.hidden = true; return; }
      a.setAttribute('href', waUrl(lang === 'es' ? '¡Hola! Me gustaría una cotización gratis para un proyecto de pintura/remodelación en Jacksonville.' : "Hi! I'd like a free estimate for a painting/remodeling project in Jacksonville."));
    });
    $$('[data-copy="phone"]').forEach(function (b) {
      if (!phone) return; b.hidden = false;
      b.addEventListener('click', function () { copyText(phone); });
    });
    if (emailItem && cfg.email) {
      var cb = mk('button', 'copy-btn'); cb.type = 'button'; cb.textContent = $('[data-copy="phone"]') ? $('[data-copy="phone"]').textContent : 'Copy';
      cb.setAttribute('aria-label', (lang === 'es' ? 'Copiar correo' : 'Copy email'));
      cb.addEventListener('click', function () { copyText(cfg.email); }); emailItem.appendChild(cb);
    }
  });

  /* ---------- Real reviews (replace placeholders) ---------- */
  safe('reviews', function () {
    var rv = cfg.reviews, track = $('#car-track');
    if (!track || !rv || !rv.length) return;
    track.innerHTML = '';
    rv.forEach(function (r, i) {
      var a = mk('article', 'card review real car-slide'); a.setAttribute('role', 'group'); a.setAttribute('aria-roledescription', 'slide');
      a.setAttribute('aria-label', (i + 1) + ' ' + T.slide + ' ' + rv.length);
      var p1 = mk('p'), p2 = mk('p'), s = mk('strong');
      p1.textContent = (r.text && (r.text[lang] || r.text.en)) || ''; s.textContent = r.name || ''; p2.appendChild(s);
      a.appendChild(p1); a.appendChild(p2); track.appendChild(a);
    });
  });

  /* ---------- Carousel (native scroll-snap = swipe; buttons/dots/keys added) ---------- */
  safe('carousel', function () {
    var track = $('#car-track'), prev = $('#car-prev'), next = $('#car-next'), dots = $('#car-dots'), ctl = $('.car-ctl');
    if (!track) return;
    var slides = $$('.car-slide', track), cur = 0, tick = false;
    function step() { var s = slides[0]; return s ? s.getBoundingClientRect().width + 16 : 300; }
    function build() {
      dots.innerHTML = '';
      slides.forEach(function (s, i) {
        var b = mk('button', 'car-dot'); b.type = 'button'; b.setAttribute('aria-label', (i + 1) + ' ' + T.slide + ' ' + slides.length);
        b.addEventListener('click', function () { track.scrollTo({ left: i * step(), behavior: reduce ? 'auto' : 'smooth' }); });
        dots.appendChild(b);
      });
    }
    function update() {
      tick = false;
      var overflow = track.scrollWidth > track.clientWidth + 4;
      if (ctl) ctl.hidden = !overflow || slides.length < 2;
      cur = clamp(Math.round(track.scrollLeft / step()), 0, slides.length - 1);
      $$('.car-dot', dots).forEach(function (d, i) { if (i === cur) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    }
    function req() { if (!tick) { tick = true; raf(update); } }
    build(); update();
    track.addEventListener('scroll', req, { passive: true });
    window.addEventListener('resize', req, { passive: true });
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev.click(); }
    });
  });

  /* ---------- Mobile drawer nav + scroll-spy ---------- */
  safe('nav', function () {
    var tgl = $('#nav-toggle'), nav = $('#main-nav');
    if (!tgl || !nav) return;
    var isOpen = false, mq = window.matchMedia('(min-width:900px)');
    function setOpen(v, restore) {
      if (v === isOpen) return;
      isOpen = v;
      nav.classList.toggle('open', v);
      tgl.setAttribute('aria-expanded', v ? 'true' : 'false');
      body.classList.toggle('nav-open', v);
      setInert(v);
      if (v) { var f = $('a', nav); setTimeout(function () { if (isOpen && f) f.focus({ preventScroll: true }); }, 60); }
      else if (restore) tgl.focus({ preventScroll: true });
    }
    tgl.addEventListener('click', function () { setOpen(!isOpen, true); });
    nav.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a'); if (a) setOpen(false, false); });
    doc.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false, true); return; }
      if (e.key === 'Tab') {
        var f = [tgl].concat($$('a', nav)).filter(function (x) { return x.offsetParent !== null || x === tgl; });
        if (!f.length) return;
        var i = f.indexOf(doc.activeElement);
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && (i === f.length - 1 || i === -1)) { e.preventDefault(); f[0].focus(); }
      }
    });
    var onMq = function () { if (mq.matches) setOpen(false, false); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);

    /* Scroll-spy */
    var links = $$('a[href^="#"]', nav), map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var cur = null;
    function mark(id) {
      if (id === cur) return; cur = id;
      links.forEach(function (a) { if (map[id] === a) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }
    if ('IntersectionObserver' in window) {
      var spy = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) { if (en.isIntersecting) mark(en.target.id); });
        if ((window.pageYOffset || 0) < window.innerHeight * 0.25) mark(null);
      }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
      Object.keys(map).forEach(function (id) { var s = doc.getElementById(id); if (s) spy.observe(s); });
      window.addEventListener('scroll', function () { if ((window.pageYOffset || 0) < 80) mark(null); }, { passive: true });
    }
  });

  /* ---------- Services: expandable detail ---------- */
  safe('services', function () {
    $$('.svc').forEach(function (card, i) {
      var more = $('.svc-more', card); if (!more) return;
      var id = 'svc-more-' + i; more.id = id; more.hidden = true;
      var b = mk('button', 'svc-toggle'); b.type = 'button'; b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', id);
      b.innerHTML = '<span></span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
      $('span', b).textContent = T.more; card.appendChild(b);
      var anim = null;
      b.addEventListener('click', function () {
        var open = b.getAttribute('aria-expanded') === 'true';
        b.setAttribute('aria-expanded', open ? 'false' : 'true'); $('span', b).textContent = open ? T.more : T.less;
        if (anim) anim.cancel();
        if (!open) {
          more.hidden = false;
          if (canAnim) { var h = more.offsetHeight; more.style.overflow = 'hidden'; anim = more.animate({ height: ['0px', h + 'px'], opacity: [0, 1] }, { duration: 450, easing: EASE }); anim.onfinish = anim.oncancel = function () { more.style.overflow = ''; anim = null; }; }
        } else if (canAnim) {
          var h2 = more.offsetHeight; more.style.overflow = 'hidden';
          anim = more.animate({ height: [h2 + 'px', '0px'], opacity: [1, 0] }, { duration: 320, easing: EASE });
          anim.onfinish = function () { more.hidden = true; more.style.overflow = ''; anim = null; };
          anim.oncancel = function () { more.style.overflow = ''; };
        } else more.hidden = true;
      });
    });
  });

  /* ---------- Gallery: grid, filters (FLIP), lightbox ---------- */
  var gal = null;
  safe('gallery', function () {
    var g = $('#gallery-grid'); if (!g) return;
    var cats = window.GALLERY_CATEGORIES || [], items = (window.GALLERY_ITEMS || []).slice();
    function catLabel(id) { for (var i = 0; i < cats.length; i++) if (cats[i].id === id) return cats[i].label[lang] || cats[i].label.en; return ''; }
    var placeholders = !items.length;
    if (placeholders) {
      var n = window.GALLERY_PLACEHOLDERS || 6;
      for (var i = 0; i < n; i++) items.push({ type: i === 1 ? 'video' : 'image', ph: true, n: i + 1, category: cats.length ? cats[i % cats.length].id : '' });
    }
    function title(it) { return it.ph ? ((it.type === 'video' ? T.phVideo : T.phPhoto) + ' ' + it.n) : ((it.caption && (it.caption[lang] || it.caption.en)) || (it.alt && (it.alt[lang] || it.alt.en)) || ''); }
    function phBox(it) {
      var d = mk('div', 'g-ph', '<span class="tag"></span><span></span><small></small>');
      $('.tag', d).textContent = T.ph; d.children[1].textContent = (it.type === 'video' ? T.phVideo : T.phPhoto) + ' ' + it.n; d.children[2].textContent = T.phHint; return d;
    }
    var figs = [];
    items.forEach(function (it, idx) {
      var f = mk('figure', 'g-item'); f.dataset.cat = it.category || ''; f._it = it;
      var b = mk('button', 'g-btn'); b.type = 'button'; b.setAttribute('aria-haspopup', 'dialog');
      b.setAttribute('aria-label', T.open + ': ' + title(it));
      var m, alt = (it.alt && (it.alt[lang] || it.alt.en)) || '';
      if (it.ph) m = phBox(it);
      else if (it.type === 'video' && !it.poster) { m = mk('video'); m.muted = true; m.playsInline = true; m.preload = 'metadata'; m.src = base + it.src + '#t=0.1'; m.setAttribute('aria-hidden', 'true'); m.tabIndex = -1; }
      else { m = mk('img'); m.src = base + (it.type === 'video' ? it.poster : it.src); m.alt = alt; m.loading = 'lazy'; m.width = 800; m.height = 600; }
      b.appendChild(m);
      if (it.type === 'video') b.appendChild(mk('span', 'g-play', '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'));
      f.appendChild(b);
      var capTxt = it.ph ? catLabel(it.category) : ((it.caption && (it.caption[lang] || it.caption.en)) || '');
      if (capTxt) { var c = mk('figcaption'); c.textContent = capTxt; f.appendChild(c); }
      b.addEventListener('click', function () { gal.open(f, b); });
      g.appendChild(f); figs.push(f);
    });

    /* Filters */
    var used = cats.filter(function (c) { return items.some(function (it) { return it.category === c.id; }); });
    var fbox = $('#g-filters'), token = 0;
    function visibleFigs() { return figs.filter(function (f) { return !f.hidden; }); }
    function applyFilter(cat) {
      var my = ++token;
      var leaving = figs.filter(function (f) { return !f.hidden && !(cat === 'all' || f.dataset.cat === cat); });
      var go = function () {
        if (my !== token) return;
        var before = new Map();
        figs.forEach(function (f) { if (!f.hidden) before.set(f, f.getBoundingClientRect()); });
        figs.forEach(function (f) { f.hidden = !(cat === 'all' || f.dataset.cat === cat); f.classList.add('in'); });
        if (gempty) gempty.hidden = figs.some(function (f) { return !f.hidden; });
        if (!canAnim) return;
        figs.forEach(function (f) {
          if (f.hidden) return;
          var a = before.get(f), r = f.getBoundingClientRect();
          if (a) {
            var dx = a.left - r.left, dy = a.top - r.top;
            if (dx || dy) f.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 520, easing: EASE });
          } else f.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: EASE });
        });
      };
      if (canAnim && leaving.length) {
        leaving.forEach(function (f) { f.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.94)' }], { duration: 180, easing: 'ease-out', fill: 'forwards' }); });
        setTimeout(function () { leaving.forEach(function (f) { f.getAnimations().forEach(function (a) { a.cancel(); }); }); go(); }, 190);
      } else go();
    }
    var realItems = items.some(function (it) { return !it.ph; });
    var gempty = $('#g-empty');
    if (fbox && (used.length > 1 || (realItems && cats.length > 1))) {
      var btns = [];
      [{ id: 'all', label: { en: 'All', es: 'Todos' } }].concat(realItems ? cats : used).forEach(function (c, i) {
        var b = mk('button', 'fbtn'); b.type = 'button'; b.textContent = c.label[lang] || c.label.en; b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
        b.addEventListener('click', function () { btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); applyFilter(c.id); });
        fbox.appendChild(b); btns.push(b);
      });
    } else if (fbox) fbox.hidden = true;

    /* Lightbox */
    var lb = mk('div', 'lb'); lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', T.lbLabel);
    var chev = function (d) { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; };
    lb.innerHTML = '<p class="lb-count" aria-live="polite"></p>' +
      '<button type="button" class="lb-btn lb-close" aria-label="' + T.lbClose + '">' + chev('M6 6l12 12M18 6L6 18') + '</button>' +
      '<button type="button" class="lb-btn lb-prev" aria-label="' + T.lbPrev + '">' + chev('M15 5l-7 7 7 7') + '</button>' +
      '<button type="button" class="lb-btn lb-next" aria-label="' + T.lbNext + '">' + chev('M9 5l7 7-7 7') + '</button>' +
      '<figure class="lb-stage"><div class="lb-media"></div><figcaption class="lb-cap"></figcaption></figure>';
    body.appendChild(lb);
    var lbMedia = $('.lb-media', lb), lbCap = $('.lb-cap', lb), lbCount = $('.lb-count', lb);
    var list = [], idx = 0, opener = null, isOpen = false;
    function render(dir, fromThumb) {
      var f = list[idx], it = f._it;
      var vid = lbMedia.querySelector('video'); if (vid) vid.pause();
      lbMedia.innerHTML = '';
      var m;
      if (it.ph) m = phBox(it);
      else if (it.type === 'video') { m = mk('video'); m.controls = true; m.playsInline = true; m.preload = 'metadata'; if (it.poster) m.poster = base + it.poster; m.src = base + it.src; m.setAttribute('aria-label', (it.alt && (it.alt[lang] || it.alt.en)) || title(it)); }
      else { m = mk('img'); m.src = base + it.src; m.alt = (it.alt && (it.alt[lang] || it.alt.en)) || ''; }
      lbMedia.appendChild(m);
      lbCap.textContent = it.ph ? (title(it) + (catLabel(it.category) ? ' · ' + catLabel(it.category) : '')) : (title(it) || '');
      lbCount.textContent = (idx + 1) + ' ' + T.lbOf + ' ' + list.length;
      $('.lb-prev', lb).hidden = $('.lb-next', lb).hidden = list.length < 2;
      if (!canAnim) return;
      if (fromThumb) {
        var run = function () {
          var r0 = fromThumb.getBoundingClientRect(), r1 = m.getBoundingClientRect();
          if (!r1.width || !r1.height) return;
          m.animate([{ transformOrigin: '0 0', transform: 'translate(' + (r0.left - r1.left) + 'px,' + (r0.top - r1.top) + 'px) scale(' + (r0.width / r1.width) + ',' + (r0.height / r1.height) + ')' }, { transformOrigin: '0 0', transform: 'none' }], { duration: 480, easing: EASE });
        };
        if (m.tagName === 'IMG' && !m.complete) m.addEventListener('load', run, { once: true }); else run();
      } else if (dir) m.animate([{ opacity: 0, transform: 'translateX(' + (dir * 40) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: EASE });
    }
    function go(d) { if (list.length < 2) return; idx = (idx + d + list.length) % list.length; render(d); }
    function close() {
      if (!isOpen) return; isOpen = false;
      var vid = lbMedia.querySelector('video'); if (vid) vid.pause();
      lb.classList.remove('open'); body.classList.remove('lb-open'); setInert(false);
      if (opener) opener.focus({ preventScroll: true });
    }
    $('.lb-close', lb).addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', function () { go(-1); });
    $('.lb-next', lb).addEventListener('click', function () { go(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lb-stage')) close(); });
    doc.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'Tab') {
        var f = $$('button,video[controls]', lb).filter(function (x) { return !x.hidden; });
        var i = f.indexOf(doc.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && (i === f.length - 1 || i === -1)) { e.preventDefault(); f[0].focus(); }
      }
    });
    var sx = 0, sy = 0, sid = null;
    lb.addEventListener('pointerdown', function (e) { if (e.target.closest('.lb-btn') || e.target.tagName === 'VIDEO') return; sx = e.clientX; sy = e.clientY; sid = e.pointerId; });
    lb.addEventListener('pointerup', function (e) {
      if (sid !== e.pointerId) return; sid = null;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    });
    gal = {
      open: function (fig, thumbBtn) {
        list = visibleFigs(); idx = Math.max(0, list.indexOf(fig)); opener = thumbBtn; isOpen = true;
        lb.classList.add('open'); body.classList.add('lb-open'); setInert(true);
        $('.lb-close', lb).focus({ preventScroll: true });
        render(0, $('img,video,.g-ph', thumbBtn));
      }
    };
  });

  /* ---------- Before / after sliders ---------- */
  safe('beforeafter', function () {
    var grid = $('#ba-grid'); if (!grid) return;
    var pairs = (window.BEFORE_AFTER || []).slice(), ph = !pairs.length;
    if (ph) pairs = [{ ph: 1 }, { ph: 2 }];
    pairs.forEach(function (p, i) {
      var fig = mk('figure', 'ba-item'), ba = mk('div', 'ba');
      function layer(cls, kind) {
        var l = mk('div', 'ba-layer ' + cls);
        if (p.ph) {
          l.className += ' ba-ph ' + kind;
          l.innerHTML = '<span class="tag"></span><span></span><small></small>';
          $('.tag', l).textContent = T.ph; l.children[1].textContent = (kind === 'b' ? T.baBefore : T.baAfter) + ' ' + p.ph; l.children[2].textContent = T.baPhHint;
        } else {
          var im = mk('img'); im.src = base + (kind === 'b' ? p.before : p.after); im.alt = ''; im.loading = 'lazy'; im.width = 800; im.height = 600; l.appendChild(im);
        }
        return l;
      }
      ba.appendChild(layer('ba-before', 'b')); ba.appendChild(layer('ba-after', 'a'));
      var l1 = mk('span', 'ba-lab l'), l2 = mk('span', 'ba-lab r'); l1.textContent = T.baBefore; l2.textContent = T.baAfter; l1.setAttribute('aria-hidden', 'true'); l2.setAttribute('aria-hidden', 'true');
      ba.appendChild(l1); ba.appendChild(l2);
      ba.appendChild(mk('div', 'ba-handle', '<span class="ba-knob"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/></svg></span>'));
      var inp = mk('input'); inp.type = 'range'; inp.min = 0; inp.max = 100; inp.step = 1; inp.value = 50;
      var altTxt = (p.alt && (p.alt[lang] || p.alt.en)) || '';
      inp.setAttribute('aria-label', (altTxt ? altTxt + '. ' : '') + T.baLabel);
      ba.appendChild(inp);
      function upd() {
        var v = +inp.value; ba.style.setProperty('--pos', v + '%'); ba.style.setProperty('--px', (v / 100 * ba.clientWidth).toFixed(1) + 'px');
        inp.setAttribute('aria-valuetext', T.baVal(v));
      }
      inp.addEventListener('input', upd);
      inp.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 5 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -5 : 0;
        if (d) { e.preventDefault(); inp.value = clamp(+inp.value + d, 0, 100); upd(); }
      });
      inp.addEventListener('pointerdown', function () { ba.classList.add('drag'); });
      ['pointerup', 'pointercancel', 'blur'].forEach(function (ev) { inp.addEventListener(ev, function () { ba.classList.remove('drag'); }); });
      if (window.ResizeObserver) new ResizeObserver(upd).observe(ba); else window.addEventListener('resize', upd);
      fig.appendChild(ba);
      var capTxt = p.ph ? '' : ((p.caption && (p.caption[lang] || p.caption.en)) || '');
      if (capTxt) { var c = mk('figcaption'); c.textContent = capTxt; fig.appendChild(c); }
      grid.appendChild(fig); upd();
    });
  });

  /* ---------- Forms: shared validation ---------- */
  function checkField(inp) {
    var v = (inp.value || '').trim(), n = inp.name;
    if (n === 'name') { if (inp.required && v.length < 2) return T.eName; }
    else if (n === 'phone') {
      var d = v.replace(/\D/g, '');
      if (!v) return inp.required ? T.ePhoneEmpty : '';
      if (!(d.length === 10 || (d.length === 11 && d[0] === '1'))) return T.ePhone;
    }
    else if (n === 'email') { if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return T.eEmail; }
    else if (n === 'zip') { if (v && !/^\d{5}$/.test(v)) return T.eZip; }
    else if (n === 'service' && inp.tagName === 'SELECT') { if (inp.required && !v) return T.eSvc; }
    return '';
  }
  function showField(inp, msg, shake) {
    var fld = inp.closest('.fld'); if (!fld) return;
    var err = $('.err', fld);
    fld.classList.toggle('is-invalid', !!msg);
    fld.classList.toggle('is-valid', !msg && !!(inp.value || '').trim());
    if (err) { err.hidden = !msg; err.textContent = msg || ''; }
    inp.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg && err) inp.setAttribute('aria-describedby', err.id); else inp.removeAttribute('aria-describedby');
    if (msg && shake && canAnim) { fld.classList.remove('shake'); void fld.offsetWidth; fld.classList.add('shake'); setTimeout(function () { fld.classList.remove('shake'); }, 450); }
  }
  function wireFields(scope) {
    $$('.fld input, .fld select, .fld textarea', scope).forEach(function (inp) {
      var touched = false;
      if (inp.tagName === 'SELECT') {
        var sync = function () { inp.classList.toggle('has-value', !!inp.value); };
        inp.addEventListener('change', function () { sync(); touched = true; showField(inp, checkField(inp)); }); sync();
      }
      inp.addEventListener('blur', function () { if ((inp.value || '').trim() || touched || inp.required && touched) { touched = true; showField(inp, checkField(inp)); } });
      inp.addEventListener('input', function () {
        var fld = inp.closest('.fld');
        if (touched || (fld && fld.classList.contains('is-invalid'))) showField(inp, checkField(inp));
        else if (fld) fld.classList.toggle('is-valid', !!(inp.value || '').trim() && !checkField(inp) && inp.name !== 'message');
      });
    });
  }
  function postForm(fd) {
    fd.delete('botcheck');
    if (cfg.formAccessKey) fd.append('access_key', cfg.formAccessKey);
    fd.append('subject', 'New quote request - ' + (cfg.businessName || ''));
    fd.append('page_language', lang);
    return fetch(cfg.formEndpoint, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } }).then(function (r) { if (!r.ok) throw new Error(r.status); });
  }

  /* ---------- Quick form ---------- */
  var quick = $('#quote-form');
  safe('quickform', function () {
    if (!quick) return;
    var status = $('#form-status');
    function say(kind, msg) { status.className = 'form-status show ' + kind; status.textContent = msg; }
    wireFields(quick);
    quick.addEventListener('submit', function (e) {
      e.preventDefault();
      if (quick.elements['botcheck'] && quick.elements['botcheck'].value) return; // honeypot
      var first = null;
      $$('.fld input, .fld select', quick).forEach(function (inp) { var m = checkField(inp); showField(inp, m, !!m); if (m && !first) first = inp; });
      if (first) { say('err', T.invalid); first.focus(); return; }
      if (!cfg.formEndpoint) { say('info', T.notConfigured); return; }
      var btn = $('button[type=submit]', quick); btn.disabled = true; say('info', T.sending);
      postForm(new FormData(quick)).then(function () {
        quick.reset(); $$('.fld', quick).forEach(function (f) { f.classList.remove('is-valid', 'is-invalid'); }); $$('select', quick).forEach(function (s) { s.classList.remove('has-value'); });
        say('ok', T.ok);
      }).catch(function () { say('err', T.err); }).then(function () { btn.disabled = false; });
    });
  });

  /* ---------- Wizard: estimate in 4 steps ---------- */
  safe('wizard', function () {
    var wz = $('#wizard'), col = wz && wz.parentNode;
    if (!wz) return;
    wz.hidden = false; col.classList.add('wiz-on');
    var steps = $$('.wiz-step', wz), sum = $('#wiz-summary'), bodyEl = $('#wiz-body'), fill = $('#wiz-fill'), count = $('#wiz-count');
    var dots = $$('.wiz-dots li', wz), back = $('#wiz-back'), nextB = $('#wiz-next'), errsum = $('#wiz-errsum'), status = $('#wiz-status');
    var cur = 1, sent = false;
    wireFields(wz);
    function val(name) { var c = wz.querySelector('input[name="' + name + '"]:checked'); return c ? c.value : ''; }
    function fv(name) { return (wz.elements[name].value || '').trim(); }

    function groupErr(name, msg) { var e = $('#' + name + '-err'); if (e) { e.hidden = !msg; e.textContent = msg || ''; } }
    function validate(n) {
      var bad = [];
      if (n === 1) { if (!val('service')) { groupErr('service', T.eSvcW); bad.push({ el: wz.querySelector('input[name=service]'), m: T.eSvcW }); } else groupErr('service', ''); }
      if (n === 2) {
        if (!val('ptype')) { groupErr('ptype', T.ePt); bad.push({ el: wz.querySelector('input[name=ptype]'), m: T.ePt }); } else groupErr('ptype', '');
        if (!val('size')) { groupErr('size', T.eSize); bad.push({ el: wz.querySelector('input[name=size]'), m: T.eSize }); } else groupErr('size', '');
      }
      if (n === 3) {
        if (!val('urgency')) { groupErr('urgency', T.eUrg); bad.push({ el: wz.querySelector('input[name=urgency]'), m: T.eUrg }); } else groupErr('urgency', '');
        var z = wz.elements['zip']; var zm = checkField(z); showField(z, zm, !!zm); if (zm) bad.push({ el: z, m: zm });
      }
      if (n === 4) {
        ['name', 'phone', 'email'].forEach(function (k) { var inp = wz.elements[k]; var m = checkField(inp); showField(inp, m, !!m); if (m) bad.push({ el: inp, m: m }); });
      }
      if (bad.length) { errsum.hidden = false; errsum.textContent = T.invalid + ' ' + bad.map(function (b) { return b.m; }).join(' '); bad[0].el.focus(); }
      else { errsum.hidden = true; errsum.textContent = ''; }
      return !bad.length;
    }
    ['service', 'ptype', 'size', 'urgency'].forEach(function (nm) {
      $$('input[name="' + nm + '"]', wz).forEach(function (r) { r.addEventListener('change', function () { groupErr(nm, ''); errsum.hidden = true; }); });
    });

    function show(n, dir) {
      cur = n;
      steps.forEach(function (s, i) { s.hidden = (i + 1) !== n; });
      sum.hidden = n !== 5;
      var pct = n === 5 ? 1 : n / 4;
      fill.parentNode.style.setProperty('--p', pct); fill.style.setProperty('--p', pct);
      count.textContent = n === 5 ? T.summary : (T.step + ' ' + n + ' ' + T.of + ' 4');
      dots.forEach(function (d, i) { d.classList.toggle('on', i < Math.min(n, 4)); });
      back.hidden = n === 1; back.textContent = n === 5 ? T.edit : (lang === 'es' ? 'Atrás' : 'Back');
      nextB.hidden = n === 5; nextB.textContent = n === 4 ? T.reviewBtn : T.next;
      status.className = 'form-status'; status.textContent = '';
      var tgt = n === 5 ? sum : steps[n - 1];
      if (canAnim && dir) bodyEl.animate([{ opacity: 0, transform: 'translateX(' + (dir * 28) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: EASE });
      if (!dir) return; /* initial render: no focus, no scroll */
      var f = n === 5 ? sum : $('legend', tgt); if (f) f.focus({ preventScroll: true });
      var r = wz.getBoundingClientRect();
      if (r.top < 70 || r.top > window.innerHeight * 0.5) window.scrollTo({ top: r.top + (window.pageYOffset || 0) - 84, behavior: reduce ? 'auto' : 'smooth' });
    }
    function lines() {
      var out = [[T.sService, val('service')], [T.sPt, val('ptype')], [T.sSize, val('size')], [T.sUrg, val('urgency')]];
      var loc = [fv('city'), fv('zip')].filter(Boolean).join(' ');
      if (loc) out.push([T.sLoc, loc]);
      out.push([T.sName, fv('name')], [T.sPhone, fv('phone')]);
      if (fv('email')) out.push([T.sEmail, fv('email')]);
      return out;
    }
    function message() { return T.hello + '\n\n' + lines().map(function (l) { return l[0] + ': ' + l[1]; }).join('\n'); }

    function buildSummary() {
      sent = false; sum.innerHTML = '';
      sum.appendChild(mk('h4', '', '')).textContent = T.sumTitle;
      sum.appendChild(mk('p', 'fine')).textContent = T.sumHint;
      var dl = mk('dl', 'sum-list');
      lines().forEach(function (l) { var d = mk('div', '', '<dt></dt><dd></dd>'); $('dt', d).textContent = l[0]; $('dd', d).textContent = l[1]; dl.appendChild(d); });
      sum.appendChild(dl);
      var act = mk('div', 'sum-actions'), note = mk('div'); note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite');
      function okBox(msg) {
        note.innerHTML = '<div class="sum-ok"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path class="tick" pathLength="1" d="M7 12.5l3.2 3.2L17 9"/></svg><p></p></div>';
        $('p', note).textContent = msg;
      }
      function sendBg(btn) {
        if (!cfg.formEndpoint) return Promise.resolve(false);
        if (btn) btn.disabled = true;
        var fd = new FormData(wz); fd.append('message', message());
        return postForm(fd).then(function () { return true; }).catch(function () { status.className = 'form-status show err'; status.textContent = T.err; return false; }).then(function (r) { if (btn) btn.disabled = false; return r; });
      }
      if (waOn) {
        var w = mk('a', 'btn btn-wa'); w.href = waUrl(message()); w.target = '_blank'; w.rel = 'noopener';
        w.innerHTML = $('.wa-ico', doc) ? $('.wa-ico', doc).outerHTML : ''; w.appendChild(doc.createTextNode(T.waSend)); w.id = 'wiz-wa';
        w.addEventListener('click', function () { okBox(T.waOpened); sendBg(null); });
        act.appendChild(w);
      }
      var call = mk('a', 'btn btn-primary'); call.href = 'tel:' + (cfg.phoneTel || ''); call.textContent = T.callNow; act.appendChild(call);
      var cp = mk('button', 'btn btn-ghost'); cp.type = 'button'; cp.textContent = T.copySum; cp.addEventListener('click', function () { copyText(message()); }); act.appendChild(cp);
      if (cfg.formEndpoint) {
        var sb = mk('button', 'btn btn-dark'); sb.type = 'button'; sb.textContent = T.sendForm;
        sb.addEventListener('click', function () { status.className = 'form-status show info'; status.textContent = T.sending; sendBg(sb).then(function (ok) { if (ok) { status.className = 'form-status'; status.textContent = ''; okBox(T.formOk); } }); });
        act.appendChild(sb);
      }
      sum.appendChild(act); sum.appendChild(note);
    }

    wz.addEventListener('submit', function (e) {
      e.preventDefault();
      if (wz.elements['botcheck'] && wz.elements['botcheck'].value) return; // honeypot
      if (cur === 5) return;
      if (!validate(cur)) return;
      if (cur === 4) { buildSummary(); show(5, 1); } else show(cur + 1, 1);
    });
    back.addEventListener('click', function () { show(cur === 5 ? 4 : cur - 1, -1); });
    show(1, 0);

    /* Switch between wizard and quick message */
    var sq = $('#show-quick'), sw = $('#show-wizard');
    if (sq && sw && quick) {
      sw.hidden = false;
      sq.addEventListener('click', function () { col.classList.remove('wiz-on'); col.classList.add('quick-on'); sq.setAttribute('aria-expanded', 'true'); var f = $('input', quick); if (f) f.focus({ preventScroll: true }); });
      sw.addEventListener('click', function () { col.classList.remove('quick-on'); col.classList.add('wiz-on'); sq.setAttribute('aria-expanded', 'false'); sq.focus({ preventScroll: true }); });
    }

    /* "Request this service" from the cards */
    $$('[data-pick-svc]').forEach(function (a) {
      a.addEventListener('click', function () {
        var k = a.getAttribute('data-pick-svc'), r = wz.querySelector('input[name=service][data-k="' + k + '"]');
        col.classList.remove('quick-on'); col.classList.add('wiz-on');
        if (r) { r.checked = true; groupErr('service', ''); }
        if (cur !== 1) show(1, -1);
        var order = ['interior', 'exterior', 'drywall', 'flooring', 'bathroom', 'kitchen', 'decks', 'electrical', 'other'], sel = $('#f-service');
        if (sel && order.indexOf(k) > -1) { sel.selectedIndex = order.indexOf(k) + 1; sel.classList.add('has-value'); }
      });
    });
  });

  /* Mobile: hide the CTA bar while typing (on-screen keyboard) */
  safe('kb', function () {
    var mq = window.matchMedia('(max-width:899px)');
    doc.addEventListener('focusin', function (e) { if (mq.matches && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'radio') body.classList.add('kb-open'); });
    doc.addEventListener('focusout', function () { setTimeout(function () { var a = doc.activeElement; if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.type === 'radio') body.classList.remove('kb-open'); }, 60); });
  });

  /* ===================== MOTION ===================== */
  var header = $('.site-header');
  var bar = mk('div', 'scroll-progress'); bar.setAttribute('aria-hidden', 'true'); body.appendChild(bar);
  var hero = $('.hero'), tl = $('#timeline'), tlLis = tl ? $$('.steps li', tl) : [];
  var ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.pageYOffset || root.scrollTop, vh = window.innerHeight;
    var max = Math.max(1, root.scrollHeight - vh);
    bar.style.transform = 'scaleX(' + Math.min(1, y / max).toFixed(4) + ')';
    if (header) header.classList.toggle('is-scrolled', y > 24);
    if (motion && hero && y < hero.offsetHeight + 100) {
      hero.style.setProperty('--py', (y * -0.12).toFixed(1) + 'px');
      hero.style.setProperty('--py2', (y * 0.1).toFixed(1) + 'px');
      hero.style.setProperty('--py3', (y * 0.05).toFixed(1) + 'px');
    }
    if (motion && tl) {
      var r = tl.getBoundingClientRect();
      if (r.bottom > -100 && r.top < vh + 100) {
        var horiz = window.innerWidth >= 900, den = horiz ? Math.max(r.height, vh * 0.4) : r.height;
        var p = clamp((vh * 0.72 - r.top) / den, 0, 1);
        tl.style.setProperty('--tl', p.toFixed(3));
        tlLis.forEach(function (li, i) {
          var on = horiz ? p >= (i / (tlLis.length - 1)) * 0.96 - 0.001 : li.getBoundingClientRect().top < vh * 0.72;
          li.classList.toggle('is-on', on);
        });
      }
    }
  }
  function req() { if (!ticking) { ticking = true; raf(onScroll); } }
  window.addEventListener('scroll', req, { passive: true });
  window.addEventListener('resize', req, { passive: true });
  if (motion && tl) tl.style.setProperty('--tl', 0);
  safe('scroll0', onScroll);

  /* Page fade between EN/ES */
  safe('langfade', function () {
    if (!motion) return;
    $$('a[hreflang]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
        e.preventDefault(); root.classList.add('page-leave');
        setTimeout(function () { window.location.href = a.href; }, 260);
      });
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) root.classList.remove('page-leave'); });
  });

  /* Intro: first visit per session, <1.2s, skippable */
  safe('intro', function () {
    if (!root.classList.contains('js-intro')) return;
    try { sessionStorage.setItem('aio-intro', '1'); } catch (e) { /* ignore */ }
    var skip = function () { root.classList.add('intro-skip'); doc.removeEventListener('keydown', skip); };
    var intro = $('.intro');
    if (intro) { intro.addEventListener('pointerdown', skip); }
    doc.addEventListener('keydown', skip);
    setTimeout(function () { doc.removeEventListener('keydown', skip); }, 1300);
  });

  safe('motion', function () {
    if (!motion) { tlLis.forEach(function (li) { li.classList.add('is-on'); }); return; }
    /* Hero headline by words */
    var h1 = $('.hero h1');
    if (h1) {
      var txt = h1.textContent.replace(/\s+/g, ' ').trim();
      h1.setAttribute('aria-label', txt); h1.textContent = '';
      txt.split(' ').forEach(function (w, i, arr) {
        var o = mk('span', 'w'); o.setAttribute('aria-hidden', 'true');
        var inn = mk('span'); inn.textContent = w; inn.style.setProperty('--wi', i); o.appendChild(inn); h1.appendChild(o);
        if (i < arr.length - 1) h1.appendChild(doc.createTextNode(' '));
      });
      h1.classList.add('is-split');
    }
    $$('.hero-cta .btn').forEach(function (b, i) { b.style.setProperty('--bi', i); });

    /* Marquee */
    var track = $('.marquee-track'), grp = track && $('.marquee-group', track);
    if (grp) {
      var orig = grp.innerHTML, guard = 0;
      track.classList.add('is-running');
      while (grp.scrollWidth < window.innerWidth && guard++ < 6) grp.insertAdjacentHTML('beforeend', orig);
      var clone = grp.cloneNode(true); clone.setAttribute('aria-hidden', 'true'); track.appendChild(clone);
      track.style.animationDuration = Math.max(24, Math.round(grp.scrollWidth / 55)) + 's';
    }

    /* Scroll reveal */
    var groups = [
      ['.section .eyebrow, .section h2, .section > .container > .lead', 'mask', 0],
      ['.segments, .wizard, .form, .contact-list, .ba-block, .filters, .trust li, .car-ctl, .timeline', 'fade', 0],
      ['.grid > .card, .steps > li, .areas li, .faq details, .car-slide', 'fade', 1],
      ['.g-item', 'clip', 1],
      ['.site-footer .footer-grid > div', 'fade', 1]
    ];
    var targets = [];
    groups.forEach(function (gr) {
      $$(gr[0]).forEach(function (el) {
        if (el.hasAttribute('data-rv') || el.closest('[hidden]')) return;
        el.setAttribute('data-rv', gr[1]);
        if (gr[2]) { var idx = [].indexOf.call(el.parentNode.children, el); el.style.setProperty('--i', Math.min(idx, 7)); }
        else if (gr[1] === 'mask') el.style.setProperty('--i', el.matches('h2') ? 1 : el.matches('.lead') ? 2 : 0);
        targets.push(el);
      });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    targets.forEach(function (el) { io.observe(el); });
    /* Section hairlines */
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in-view'); sio.unobserve(en.target); } });
    }, { threshold: 0, rootMargin: '0px 0px -15% 0px' });
    $$('.section').forEach(function (s) { sio.observe(s); });
    /* Failsafe: anything near the viewport still hidden is revealed */
    setTimeout(function () {
      targets.forEach(function (el) {
        if (el.classList.contains('in')) return;
        var b = el.getBoundingClientRect();
        if (b.top < window.innerHeight * 1.2) { el.classList.add('in'); io.unobserve(el); }
      });
    }, 2500);

    /* FAQ: animated height */
    $$('.faq details').forEach(function (d) {
      var sum = $('summary', d), anim = null;
      sum.addEventListener('click', function (e) {
        e.preventDefault();
        if (anim) anim.cancel();
        var start = d.offsetHeight, opening = !d.open, end;
        if (opening) { d.open = true; end = d.offsetHeight; } else end = sum.offsetHeight + 2;
        d.style.overflow = 'hidden';
        anim = d.animate({ height: [start + 'px', end + 'px'] }, { duration: 450, easing: EASE });
        anim.onfinish = anim.oncancel = function () { if (!opening) d.open = false; d.style.overflow = ''; anim = null; };
      });
    });

    /* WhatsApp label: show briefly once */
    var wf = $('.wa-float');
    if (wf) { setTimeout(function () { wf.classList.add('show-label'); }, 3500); setTimeout(function () { wf.classList.remove('show-label'); }, 9000); }

    /* Card tilt + magnetic buttons (fine pointer only) */
    if (fine) {
      $$('.card:not(.review)').forEach(function (c) {
        var pend = false, ev;
        c.addEventListener('pointermove', function (e) {
          ev = e; if (pend) return; pend = true;
          raf(function () {
            pend = false; var r = c.getBoundingClientRect();
            var x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
            c.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
            c.style.setProperty('--ry', ((x - .5) * 7).toFixed(2) + 'deg'); c.style.setProperty('--rx', ((.5 - y) * 7).toFixed(2) + 'deg');
          });
        });
        c.addEventListener('pointerleave', function () { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
      });
      $$('.btn').forEach(function (b) {
        b.addEventListener('pointermove', function (e) {
          var r = b.getBoundingClientRect();
          b.style.translate = (((e.clientX - (r.left + r.width / 2)) / r.width) * 8).toFixed(1) + 'px ' + (((e.clientY - (r.top + r.height / 2)) / r.height) * 6).toFixed(1) + 'px';
        });
        b.addEventListener('pointerleave', function () { b.style.translate = ''; });
      });
    }
  });

  /* Custom cursor = a hammer. Fine pointer only, never with reduced motion, can be switched off.
     The native cursor is hidden only while the hammer is active (after the first mouse move). Text fields keep the native I-beam. */
  safe('cursor', function () {
    if (!fine || reduce) return;
    var KEY = 'aio-cursor', on = true;
    try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* ignore */ }
    var root = doc.documentElement, tg = $('#cursor-toggle'), c = mk('div', 'cursor'), x = -100, y = -100, pend = false, seen = false;
    var link = false, want = false, timer = 0;
    var LINK = 'a,button,select,label,summary,[role=button],.ba,input[type=range],input[type=checkbox],input[type=radio]';
    var TEXT = 'input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),textarea,select,[contenteditable=true]';
    c.setAttribute('aria-hidden', 'true');
    c.innerHTML = '<svg class="hammer" viewBox="0 0 40 40" width="40" height="40" fill="none" focusable="false"><g stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M15 15 L35 35" stroke="#fff" stroke-width="8.5"/><path d="M15 15 L35 35" stroke="#8A5A2B" stroke-width="5"/>' +
      '<g transform="translate(11 11) rotate(-45)"><rect x="-11" y="-6" width="22" height="12" rx="3" fill="#fff" stroke="#fff" stroke-width="3"/>' +
      '<rect x="-11" y="-6" width="22" height="12" rx="3" fill="#38C0D9" stroke="#12333A" stroke-width="1.8"/><rect x="-11" y="-6" width="5" height="12" rx="2" fill="#12333A"/></g></g></svg>';
    body.appendChild(c);
    var ham = c.firstChild;
    function sync() {
      if (tg) { tg.setAttribute('aria-pressed', on ? 'true' : 'false'); tg.textContent = on ? tg.dataset.on : tg.dataset.off; }
      c.hidden = !on; root.classList.toggle('hammer-on', on && seen);
      if (!on) c.classList.remove('is-on');
    }
    if (tg) { tg.hidden = false; tg.addEventListener('click', function () { on = !on; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ } sync(); }); }
    sync();
    /* hover state with a short delay so magnetic buttons moving under the pointer cannot make it flicker */
    function setLink(v) {
      if (v === want) return; want = v; clearTimeout(timer);
      if (want === link) return;
      timer = setTimeout(function () { link = want; c.classList.toggle('is-link', link); }, 50);
    }
    doc.addEventListener('pointermove', function (e) {
      if (!on || e.pointerType === 'touch') return;
      if (!seen) { seen = true; sync(); }
      x = e.clientX; y = e.clientY; c.classList.add('is-on');
      if (!pend) { pend = true; raf(function () { pend = false; c.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'; }); }
      var t = e.target, el = t && t.closest ? t : null;
      c.classList.toggle('is-text', !!(el && el.closest(TEXT)));
      setLink(!!(el && el.closest(LINK)));
    }, { passive: true });
    function strike() {
      var px = x, py = y;
      if (ham.animate) ham.animate([
        { transform: 'rotate(-38deg) scale(1.08)' }, { transform: 'rotate(-38deg) scale(1.08)', offset: .18 },
        { transform: 'rotate(14deg) scale(.96)', offset: .42 }, { transform: 'rotate(0deg) scale(1)' }
      ], { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' });
      var ring = mk('i', 'hit'); ring.style.left = px + 'px'; ring.style.top = py + 'px'; body.appendChild(ring);
      if (ring.animate) ring.animate([{ transform: 'scale(.25)', opacity: 0 }, { transform: 'scale(.5)', opacity: .95, offset: .25 }, { transform: 'scale(1.5)', opacity: 0 }],
        { duration: 420, delay: 120, easing: 'ease-out', fill: 'backwards' }).onfinish = function () { ring.remove(); };
      else ring.remove();
      for (var i = 0; i < 6; i++) {
        (function (a) {
          var sp = mk('i', 'spark'); sp.style.left = px + 'px'; sp.style.top = py + 'px'; body.appendChild(sp);
          var dx = Math.cos(a) * 24, dy = Math.sin(a) * 24;
          if (sp.animate) sp.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.2)', opacity: 0 }],
            { duration: 380, delay: 130, easing: 'ease-out', fill: 'backwards' }).onfinish = function () { sp.remove(); };
          else sp.remove();
        })(i * Math.PI / 3 + .3);
      }
    }
    doc.addEventListener('pointerdown', function (e) { if (on && seen && e.pointerType !== 'touch' && e.button === 0 && !c.classList.contains('is-text')) strike(); }, { passive: true });
    doc.documentElement.addEventListener('mouseleave', function () { c.classList.remove('is-on'); root.classList.remove('hammer-on'); seen = false; });
  });

  window.__motionReady = true;
})();
