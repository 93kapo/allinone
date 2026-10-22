(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  root.classList.add('js');
  var lang = (root.lang || 'en').slice(0, 2) === 'es' ? 'es' : 'en';
  var base = lang === 'es' ? '../' : '';
  var cfg = window.SITE_CONFIG || {};

  var T = {
    en: {
      phPhoto: 'Photo placeholder', phVideo: 'Video placeholder',
      phHint: 'Your project photo or short video goes here',
      waMsg: "Hi! I'd like a free estimate for a painting/remodeling project in Jacksonville.",
      sending: 'Sending...',
      notConfigured: 'The online form is not connected yet. Please call us at ' + (cfg.phone || '') + ' for your free estimate.',
      ok: 'Thank you! We received your request and will contact you soon.',
      err: 'Something went wrong. Please try again or call us at ' + (cfg.phone || '') + '.',
      invalid: 'Please fill in the required fields (name, phone, service) and use a 5-digit ZIP code.'
    },
    es: {
      phPhoto: 'Espacio para foto', phVideo: 'Espacio para video',
      phHint: 'Aquí irá la foto o el video corto de un proyecto',
      waMsg: '¡Hola! Me gustaría una cotización gratis para un proyecto de pintura/remodelación en Jacksonville.',
      sending: 'Enviando...',
      notConfigured: 'El formulario en línea aún no está conectado. Llámanos al ' + (cfg.phone || '') + ' para tu estimado gratis.',
      ok: '¡Gracias! Recibimos tu solicitud y te contactaremos pronto.',
      err: 'Algo salió mal. Inténtalo de nuevo o llámanos al ' + (cfg.phone || '') + '.',
      invalid: 'Completa los campos obligatorios (nombre, teléfono, servicio) y usa un ZIP de 5 dígitos.'
    }
  }[lang];

  /* Phone */
  [].forEach.call(doc.querySelectorAll('[data-phone-link]'), function (a) {
    if (cfg.phoneTel) a.setAttribute('href', 'tel:' + cfg.phoneTel);
  });
  [].forEach.call(doc.querySelectorAll('[data-phone-text]'), function (el) {
    if (cfg.phone) el.textContent = cfg.phone;
  });

  /* Email (hidden unless set) */
  var emailItem = doc.getElementById('email-item');
  if (emailItem && cfg.email) {
    var ea = emailItem.querySelector('a');
    ea.href = 'mailto:' + cfg.email; ea.textContent = cfg.email;
    emailItem.hidden = false;
  }

  /* Social (hidden unless set) */
  var socials = cfg.social || {}, list = doc.getElementById('social-list');
  if (list) {
    var any = false;
    Object.keys(socials).forEach(function (k) {
      if (!socials[k]) return;
      var li = doc.createElement('li'), a = doc.createElement('a');
      a.href = socials[k]; a.rel = 'noopener noreferrer'; a.target = '_blank';
      a.textContent = k.charAt(0).toUpperCase() + k.slice(1);
      li.appendChild(a); list.appendChild(li); any = true;
    });
    if (any && list.parentNode) list.parentNode.hidden = false;
  }

  /* Licensed & Insured (flag, default off) */
  if (cfg.showLicensed) {
    [].forEach.call(doc.querySelectorAll('.lic'), function (el) {
      el.classList.add('show');
      if (cfg.licenseNumber && el.hasAttribute('data-lic-number')) {
        el.textContent += ' · ' + (lang === 'es' ? 'Licencia' : 'License') + ' #' + cfg.licenseNumber;
      }
    });
    var hb = doc.getElementById('hero-badge'); if (hb) hb.hidden = false;
  }

  /* WhatsApp (number + flag from site-config.js; static hrefs are the no-JS fallback) */
  var waNum = String(cfg.whatsappNumber || '').replace(/\D/g, '');
  [].forEach.call(doc.querySelectorAll('[data-wa]'), function (a) {
    if (cfg.whatsappEnabled === false || !waNum) { a.hidden = true; return; }
    a.setAttribute('href', 'https://wa.me/' + waNum + '?text=' + encodeURIComponent(T.waMsg));
  });

  /* Mobile nav */
  var tgl = doc.getElementById('nav-toggle'), nav = doc.getElementById('main-nav');
  if (tgl && nav) {
    tgl.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      tgl.setAttribute('aria-expanded', open ? 'true' : 'false');
      doc.body.classList.toggle('nav-open', open);
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('open'); tgl.setAttribute('aria-expanded', 'false'); doc.body.classList.remove('nav-open'); }
    });
  }

  /* Gallery */
  var g = doc.getElementById('gallery-grid');
  if (g) {
    var items = window.GALLERY_ITEMS || [];
    function ph(i, video) {
      var d = doc.createElement('div'); d.className = 'g-ph';
      d.innerHTML = '<span class="tag">Placeholder</span><span></span><small></small>';
      d.children[1].textContent = (video ? T.phVideo : T.phPhoto) + ' ' + (i + 1);
      d.children[2].textContent = T.phHint;
      var f = doc.createElement('figure'); f.className = 'g-item'; f.appendChild(d); return f;
    }
    if (!items.length) {
      var n = window.GALLERY_PLACEHOLDERS || 6;
      for (var i = 0; i < n; i++) g.appendChild(ph(i, i === 1));
    } else {
      items.forEach(function (it) {
        var f = doc.createElement('figure'); f.className = 'g-item';
        var alt = (it.alt && (it.alt[lang] || it.alt.en)) || '';
        var cap = (it.caption && (it.caption[lang] || it.caption.en)) || '';
        var m;
        if (it.type === 'video') {
          m = doc.createElement('video');
          m.controls = true; m.muted = true; m.playsInline = true; m.preload = 'metadata';
          if (it.poster) m.poster = base + it.poster;
          m.src = base + it.src; m.setAttribute('aria-label', alt);
        } else {
          m = doc.createElement('img'); m.src = base + it.src; m.alt = alt; m.loading = 'lazy';
          m.width = 800; m.height = 600;
        }
        f.appendChild(m);
        if (cap) { var c = doc.createElement('figcaption'); c.textContent = cap; f.appendChild(c); }
        g.appendChild(f);
      });
    }
  }

  /* Quote form */
  var form = doc.getElementById('quote-form'), status = doc.getElementById('form-status');
  function say(kind, msg) { status.className = 'form-status show ' + kind; status.textContent = msg; }
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.elements['botcheck'] && form.elements['botcheck'].value) return; // honeypot: silently drop
      var zip = form.elements['zip'].value.trim();
      if (!form.checkValidity() || (zip && !/^\d{5}$/.test(zip))) { say('err', T.invalid); form.reportValidity && form.reportValidity(); return; }
      if (!cfg.formEndpoint) { say('info', T.notConfigured); return; }
      var btn = form.querySelector('button[type=submit]'); btn.disabled = true; say('info', T.sending);
      var fd = new FormData(form);
      fd.delete('botcheck');
      if (cfg.formAccessKey) fd.append('access_key', cfg.formAccessKey);
      fd.append('subject', 'New quote request - ' + (cfg.businessName || ''));
      fd.append('page_language', lang);
      fetch(cfg.formEndpoint, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); form.reset(); say('ok', T.ok); })
        .catch(function () { say('err', T.err); })
        .then(function () { btn.disabled = false; });
    });
  }

  /* ===================== MOTION ===================== */
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var motion = root.classList.contains('js-motion') && !reduce;
  var fine = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;
  var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };

  /* Header state + progress bar + parallax: one rAF-throttled scroll handler */
  var header = doc.querySelector('.site-header');
  var bar = doc.createElement('div'); bar.className = 'scroll-progress'; bar.setAttribute('aria-hidden', 'true');
  doc.body.appendChild(bar);
  var hero = doc.querySelector('.hero'), heroLogo = doc.querySelector('.hero-logo');
  var ticking = false;
  function onScroll() {
    var y = window.pageYOffset || root.scrollTop;
    var max = Math.max(1, root.scrollHeight - window.innerHeight);
    bar.style.transform = 'scaleX(' + Math.min(1, y / max).toFixed(4) + ')';
    if (header) header.classList.toggle('is-scrolled', y > 24);
    if (motion && hero) {
      var h = hero.offsetHeight;
      if (y < h + 100) {
        hero.style.setProperty('--py', (y * -0.12).toFixed(1) + 'px');
        if (heroLogo) heroLogo.style.setProperty('--py2', (y * 0.1).toFixed(1) + 'px');
      }
    }
    ticking = false;
  }
  function req() { if (!ticking) { ticking = true; raf(onScroll); } }
  window.addEventListener('scroll', req, { passive: true });
  window.addEventListener('resize', req, { passive: true });
  onScroll();

  /* Page fade between EN/ES (works with or without motion; no-op when reduced) */
  if (motion) {
    [].forEach.call(doc.querySelectorAll('a[hreflang]'), function (a) {
      a.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
        e.preventDefault();
        root.classList.add('page-leave');
        setTimeout(function () { window.location.href = a.href; }, 260);
      });
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) root.classList.remove('page-leave'); });
  }

  if (motion) {
    /* Hero: headline by words with mask */
    var h1 = doc.querySelector('.hero h1');
    if (h1) {
      var txt = h1.textContent.replace(/\s+/g, ' ').trim();
      h1.setAttribute('aria-label', txt);
      h1.textContent = '';
      txt.split(' ').forEach(function (w, i, arr) {
        var o = doc.createElement('span'); o.className = 'w'; o.setAttribute('aria-hidden', 'true');
        var inn = doc.createElement('span'); inn.textContent = w; inn.style.setProperty('--wi', i);
        o.appendChild(inn); h1.appendChild(o);
        if (i < arr.length - 1) h1.appendChild(doc.createTextNode(' '));
      });
      h1.classList.add('is-split');
    }
    [].forEach.call(doc.querySelectorAll('.hero-cta .btn'), function (b, i) { b.style.setProperty('--bi', i); });

    /* Marquee: fill to viewport width, duplicate once for a seamless loop */
    var track = doc.querySelector('.marquee-track'), grp = track && track.querySelector('.marquee-group');
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
      ['.segments, .form, .contact-list', 'fade', 0],
      ['.grid > .card, .steps > li, .areas li, .faq details, .reviews .card', 'fade', 1],
      ['.g-item', 'clip', 1],
      ['.site-footer .footer-grid > div', 'fade', 1]
    ];
    var targets = [];
    groups.forEach(function (gr) {
      [].forEach.call(doc.querySelectorAll(gr[0]), function (el) {
        if (el.hasAttribute('data-rv')) return;
        el.setAttribute('data-rv', gr[1]);
        if (gr[2]) {
          var idx = [].indexOf.call(el.parentNode.children, el);
          el.style.setProperty('--i', Math.min(idx, 7));
        } else if (gr[1] === 'mask') {
          el.style.setProperty('--i', el.matches('h2') ? 1 : el.matches('.lead') ? 2 : 0);
        }
        targets.push(el);
      });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    targets.forEach(function (el) { io.observe(el); });
    /* Failsafe: anything still hidden after load + a beat gets revealed */
    setTimeout(function () {
      var r = root.getBoundingClientRect();
      targets.forEach(function (el) {
        var b = el.getBoundingClientRect();
        if (b.top < window.innerHeight * 1.2 && !el.classList.contains('in')) { el.classList.add('in'); io.unobserve(el); }
      });
    }, 2500);

    /* Card tilt + glow (fine pointer only) */
    if (fine) {
      [].forEach.call(doc.querySelectorAll('.card:not(.review)'), function (c) {
        var pend = false, ev;
        c.addEventListener('pointermove', function (e) {
          ev = e; if (pend) return; pend = true;
          raf(function () {
            pend = false; var r = c.getBoundingClientRect();
            var x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
            c.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
            c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
            c.style.setProperty('--ry', ((x - .5) * 7).toFixed(2) + 'deg');
            c.style.setProperty('--rx', ((.5 - y) * 7).toFixed(2) + 'deg');
          });
        });
        c.addEventListener('pointerleave', function () { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
      });
      /* Magnetic buttons */
      [].forEach.call(doc.querySelectorAll('.btn'), function (b) {
        b.addEventListener('pointermove', function (e) {
          var r = b.getBoundingClientRect();
          var dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height;
          b.style.translate = (dx * 8).toFixed(1) + 'px ' + (dy * 6).toFixed(1) + 'px';
        });
        b.addEventListener('pointerleave', function () { b.style.translate = ''; });
      });
    }

    /* FAQ: animated height (native <details> kept for a11y / no-JS) */
    [].forEach.call(doc.querySelectorAll('.faq details'), function (d) {
      var sum = d.querySelector('summary'), anim = null;
      sum.addEventListener('click', function (e) {
        e.preventDefault();
        if (anim) anim.cancel();
        var start = d.offsetHeight, opening = !d.open, end;
        if (opening) { d.open = true; end = d.offsetHeight; }
        else { end = sum.offsetHeight + 2; }
        d.style.overflow = 'hidden';
        anim = d.animate({ height: [start + 'px', end + 'px'] }, { duration: 450, easing: 'cubic-bezier(.16,1,.3,1)' });
        anim.onfinish = anim.oncancel = function () {
          if (!opening) d.open = false;
          d.style.overflow = ''; anim = null;
        };
      });
    });

    /* WhatsApp label: show briefly once */
    var wf = doc.querySelector('.wa-float');
    if (wf) {
      setTimeout(function () { wf.classList.add('show-label'); }, 3500);
      setTimeout(function () { wf.classList.remove('show-label'); }, 9000);
    }
  }
  window.__motionReady = true;
})();
