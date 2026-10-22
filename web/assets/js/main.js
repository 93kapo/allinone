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
      sending: 'Sending...',
      notConfigured: 'The online form is not connected yet. Please call us at ' + (cfg.phone || '') + ' for your free estimate.',
      ok: 'Thank you! We received your request and will contact you soon.',
      err: 'Something went wrong. Please try again or call us at ' + (cfg.phone || '') + '.',
      invalid: 'Please fill in the required fields (name, phone, service) and use a 5-digit ZIP code.'
    },
    es: {
      phPhoto: 'Espacio para foto', phVideo: 'Espacio para video',
      phHint: 'Aquí irá la foto o el video corto de un proyecto',
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

  /* Mobile nav */
  var tgl = doc.getElementById('nav-toggle'), nav = doc.getElementById('main-nav');
  if (tgl && nav) {
    tgl.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      tgl.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('open'); tgl.setAttribute('aria-expanded', 'false'); }
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
})();
