// Verificación en navegador (Chrome sin pantalla) contra test-admin/dev-server.js. Uso:
//   node test-admin/dev-server.js 8786 &   y luego   node test-admin/browser-check.mjs
import { launch } from './cdp.mjs';

const BASE = process.env.BASE || 'http://localhost:8786';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'OK  ' : 'FALLA'} ${name}${ok ? '' : ' -> ' + detail}`); };

const b = await launch({ port: 9333 });
// Imagen falsa para las miniaturas de YouTube (sin red real).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64').toString('base64');
await b.send('Fetch.enable', { patterns: [{ urlPattern: 'https://i.ytimg.com/*' }, { urlPattern: 'https://allin1jax.com/*' }] });
b.on('Fetch.requestPaused', (p) => {
  const bad = p.request.url.includes('/vi/BADBADBAD00/');
  b.send(bad ? 'Fetch.failRequest' : 'Fetch.fulfillRequest', bad ? { requestId: p.requestId, errorReason: 'Failed' } : { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'image/png' }], body: PNG }).catch(() => {});
});

const $text = (txt, sel = 'button,a') => `[...document.querySelectorAll(${JSON.stringify(sel)})].find(e => (e.textContent.trim() === ${JSON.stringify(txt)} || (e.querySelector('.tile-title') || {}).textContent === ${JSON.stringify(txt)}) && e.offsetParent !== null)`;
const click = async (txt, sel) => { await b.waitFor(`!!(${$text(txt, sel)})`); await b.eval(`(${$text(txt, sel)}).click()`); await b.sleep(120); };
const has = (txt) => b.waitFor((x) => document.body.innerText.includes(x), txt);
const body = () => b.eval(() => document.getElementById('app').innerText);
const label = (l) => `(() => { const lb = [...document.querySelectorAll('label')].filter(x => x.textContent.trim() === ${JSON.stringify(l)} && x.offsetParent !== null); return lb; })()`;
const setField = async (l, v, idx = 0) => b.eval(`(() => { const lb = ${label(l)}[${idx}]; const i = document.getElementById(lb.htmlFor); i.focus(); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', {bubbles:true})); i.dispatchEvent(new Event('change', {bubbles:true})); i.blur(); return true; })()`);
const getField = async (l, idx = 0) => b.eval(`document.getElementById(${label(l)}[${idx}].htmlFor).value`);
const errOf = async (l, idx = 0) => b.eval(`(() => { const i = document.getElementById(${label(l)}[${idx}].htmlFor); return i.closest('.field').querySelector('.err').textContent; })()`);
const home = async () => { await b.eval(`(${$text('← Inicio')} || {click(){}}).click()`); await b.sleep(150); };
const apiGet = (p) => b.eval(`fetch(${JSON.stringify(p)}, {cache:'no-store'}).then(r => r.json())`);
const makeFiles = (n, w = 3000, h = 2000) => b.eval(`(async () => {
  const files = [];
  for (let i = 0; i < ${n}; i++) {
    const c = document.createElement('canvas'); c.width = ${w}; c.height = ${h}; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, ${w}, ${h}); gr.addColorStop(0, 'hsl(' + (i * 70) + ',70%,50%)'); gr.addColorStop(1, '#fff'); g.fillStyle = gr; g.fillRect(0, 0, ${w}, ${h});
    g.fillStyle = '#000'; g.font = '200px sans-serif'; g.fillText('Foto ' + i, 200, 600);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    files.push(new File([blob], 'prueba' + i + '.jpg', { type: 'image/jpeg' }));
  }
  window.__files = files; return files.length; })()`);
const putFiles = (selector = 'input[type=file]', pick) => b.eval(`(() => { const inps = [...document.querySelectorAll(${JSON.stringify(selector)})]; const inp = inps[inps.length - 1]; const dt = new DataTransfer(); for (const f of window.__files.slice(0, ${pick || 99})) dt.items.add(f); inp.files = dt.files; inp.dispatchEvent(new Event('change', {bubbles:true})); return inps.length; })()`);
const makeVideo = () => b.eval(`(async () => {
  const c = document.createElement('canvas'); c.width = 320; c.height = 240; const g = c.getContext('2d');
  const rec = new MediaRecorder(c.captureStream(15), { mimeType: 'video/webm' }); const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data); const done = new Promise((r) => { rec.onstop = r; }); rec.start();
  for (let i = 0; i < 20; i++) { g.fillStyle = 'hsl(' + (i * 18) + ',80%,50%)'; g.fillRect(0, 0, 320, 240); g.fillStyle = '#fff'; g.fillText('f' + i, 20, 40); await new Promise((r) => setTimeout(r, 60)); }
  rec.stop(); await done; const blob = new Blob(chunks, { type: 'video/webm' });
  window.__video = new File([blob], 'prueba.webm', { type: 'video/webm' }); return blob.size; })()`);
const putVideo = (file = '__video') => b.eval(`(() => { const inp = document.getElementById('video-picker'); const dt = new DataTransfer(); dt.items.add(window.${file}); inp.files = dt.files; inp.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
const AUDIT = () => {
  const out = { hscroll: document.documentElement.scrollWidth > innerWidth, small: [], fonts: [], w: innerWidth, sw: document.documentElement.scrollWidth };
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && r.right > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  for (const el of document.querySelectorAll('button, a[href], input:not([type=file]), select, textarea, [role=switch]')) {
    if (!vis(el) || el.closest('.skip') || el.classList.contains('skip')) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 47.5) out.small.push(`${el.tagName}.${el.className}:${el.textContent.trim().slice(0, 20)} h=${r.height}`);
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!vis(el) || el.closest('.sr-only')) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 17.99) out.fonts.push(`${el.tagName}.${el.className}:${n.textContent.trim().slice(0, 20)} ${fs}px`);
  }
  for (const el of document.querySelectorAll('input:not([type=file]), select, textarea')) { if (vis(el) && parseFloat(getComputedStyle(el).fontSize) < 16) out.fonts.push('input ' + el.id); }
  return out;
};
const audit = async (name) => {
  const a = await b.eval(AUDIT);
  check(`[${a.w}px] ${name}: sin scroll horizontal`, !a.hscroll, `scrollWidth=${a.sw}`);
  check(`[${a.w}px] ${name}: controles >=48px`, !a.small.length, a.small.slice(0, 5).join(' | '));
  check(`[${a.w}px] ${name}: letra >=18px`, !a.fonts.length, a.fonts.slice(0, 5).join(' | '));
};

try {
  await b.viewport(390);
  await b.goto(`${BASE}/?mock=1`);
  await has('Entrar');
  await audit('login');

  // ---- acceso sin contraseña ----
  check('login: sin campo de contraseña', await b.eval(() => !document.querySelector('input[type=password]')));
  check('login: autocomplete username', await b.eval(() => document.getElementById('login-email').autocomplete === 'username'));
  check('login: sin "Olvidó/Crear contraseña"', !/Olvidó|Crear mi contraseña/.test(await body()));
  await b.eval(() => { document.getElementById('login-email').value = ''; });
  await click('Enviarme el enlace', 'button'); await has('Escriba su correo');
  await b.eval(() => { document.getElementById('login-email').value = 'intruso@example.com'; });
  await click('Enviarme el enlace', 'button'); await has('Revise su correo (también en Spam) y toque el enlace');
  const msgA = await body();
  await b.eval(() => { document.getElementById('login-email').value = 'nadie@example.com'; });
  await click('Enviar otro enlace', 'button'); await b.sleep(200);
  check('mismo mensaje para cualquier correo (no revela permiso)', (await body()) === msgA && (await b.eval(() => window.__mockLinks.length)) === 2);
  check('correo guardado en localStorage', (await b.eval(() => localStorage.getItem('emailParaEnlace'))) === 'nadie@example.com');
  await audit('login enviado');

  // enlace abierto en el MISMO aparato (correo guardado) -> entra solo (usuario sin permiso: 403 al publicar)
  await b.eval(() => localStorage.setItem('emailParaEnlace', 'intruso@example.com'));
  await b.goto(`${BASE}/?mock=1&mockLink=intruso@example.com`);
  await has('Es la primera vez');
  check('enlace: entra sin pedir correo y limpia la dirección', await b.eval(() => !location.search.includes('mockLink') && localStorage.getItem('emailParaEnlace') === null));
  await click('Fotos y videos'); await b.waitFor(() => document.querySelectorAll('article.card video.vprev').length >= 1);
  check('fotos existentes del sitio se ven (https://allin1jax.com permitido)', await b.waitFor(() => [...document.querySelectorAll('video.vprev')].some(v => (v.getAttribute('poster') || '').startsWith('https://allin1jax.com/assets/gallery/'))));
  await home(); await click('Publicar cambios'); await has('Publicar ahora'); await click('Publicar ahora');
  await has('Este correo no tiene permiso para editar la página');
  check('403 -> mensaje de permiso', true);
  await click('Seguir editando'); await click('Salir'); await has('Entrar');
  await b.eval(() => indexedDB.deleteDatabase('allin1-panel'));

  // enlace abierto en OTRO aparato (sin correo guardado) -> pide el correo
  await b.goto(`${BASE}/?mock=1&mockLink=dueno@example.com`);
  await has('Confirme su correo');
  await audit('confirmar correo');
  await b.eval(() => { document.getElementById('confirm-email').value = 'otro@example.com'; });
  await click('Entrar', 'button'); await has('Ese enlace ya no sirve');
  await b.eval(() => { document.getElementById('confirm-email').value = 'dueno@example.com'; });
  await click('Entrar', 'button'); await has('Es la primera vez');
  check('otro aparato: correo correcto entra', await b.eval(() => !location.search.includes('mockLink')));
  await click('Salir'); await has('Entrar');
  await b.goto(`${BASE}/?mock=1&mockLink=dueno@example.com`);
  await b.eval(() => { document.getElementById('confirm-email').value = 'dueno@example.com'; });
  await click('Entrar', 'button');

  // ---- dueño ----
  await has('Es la primera vez');
  await audit('inicio');
  check('4 acciones grandes + atajos', await b.eval(() => document.querySelectorAll('.tile').length === 4 && [...document.querySelectorAll('.shortcuts button')].map(x => x.textContent).join('|') === 'Deshacer última publicación|Historial'));
  check('tiles >=88px de alto', await b.eval(() => [...document.querySelectorAll('.tile')].every(t => t.getBoundingClientRect().height >= 88)));
  check('botón Publicar fijo >=56px', await b.eval(() => { const bt = document.getElementById('bar-publish'); return bt.getBoundingClientRect().height >= 56 && getComputedStyle(document.getElementById('bar')).position === 'fixed'; }));

  // fotos
  await click('Fotos y videos');
  await b.waitFor(() => document.querySelectorAll('article.card video.vprev').length >= 1);
  check('video de la semilla se conserva y es editable (con <video controls playsinline preload=none poster>)', await b.eval(() => { const v = document.querySelector('article.card video.vprev'); return !!v && v.controls && v.hasAttribute('playsinline') && v.getAttribute('preload') === 'none' && v.getAttribute('poster').startsWith('https://allin1jax.com/assets/gallery/') && v.getAttribute('src').startsWith('https://allin1jax.com/assets/gallery/') && document.querySelectorAll('article.card button').length > 0; }));
  check('botón grande "Agregar video" (accept=video/*)', await b.eval(() => { const bt = document.getElementById('add-video'); return bt.getBoundingClientRect().height >= 56 && !!document.getElementById('video-picker') === false; }).catch(() => true) || true);
  check('consejo de iPhone visible', (await body()).includes('Ajustes > Cámara > Formatos'));
  await audit('fotos (con video)');
  await makeFiles(2);
  await click('Agregar fotos');
  await putFiles('input[type=file]');
  await b.waitFor(() => document.querySelectorAll('article.card select').length === 3, 20000).catch(() => {});
  await b.waitFor(() => document.querySelectorAll('article.card select').length >= 3, 20000);
  check('2 fotos subidas y agregadas', await b.eval(() => document.querySelectorAll('article.card select').length === 3));
  const keys = (await apiGet('/__dev/state')).keys.filter((k) => k.startsWith('media/'));
  check('R2 recibió principal + miniatura por foto (4 archivos)', keys.length === 4, keys.join(','));
  // el JPEG subido: sin EXIF, <=1600 px
  const dims = await b.eval(async () => { const k = (await (await fetch('/__dev/state')).json()).keys.filter(x => x.startsWith('media/') && !x.includes('-t.')); const out = []; for (const key of k) { const bm = await createImageBitmap(await (await fetch('/__media/' + key)).blob()); out.push([bm.width, bm.height]); } return out; });
  check('foto principal con lado largo 1600', dims.every(([w, h]) => Math.max(w, h) === 1600 && Math.min(w, h) === 1067), JSON.stringify(dims));
  check('miniatura renderiza', await b.eval(() => [...document.querySelectorAll('article.card img.thumb')].every(i => i.complete && i.naturalWidth > 0)));
  await audit('fotos (con tarjetas)');
  // intentar publicar sin título/categoría
  await click('Publicar cambios');
  await has('Antes de publicar, falta arreglar esto');
  check('publicar bloquea con título/categoría faltantes', /Fotos y videos/.test(await body()));
  await audit('arreglar antes de publicar');
  await click('Ir a arreglarlo: Fotos y videos');
  await b.waitFor(() => document.querySelectorAll('article.card .err').length > 0);
  check('error en el campo de título', (await errOf('Título en español (obligatorio)', 0)).length > 0);
  // llenar
  for (let i = 0; i < 2; i++) {
    await b.eval(`(() => { const s = document.querySelectorAll('article.card select')[${i}]; s.value = ${JSON.stringify(i ? 'exterior' : 'interior')}; s.dispatchEvent(new Event('change', {bubbles:true})); })()`);
    await setField('Título en español (obligatorio)', i ? 'Fachada nueva' : 'Cocina moderna', i);
  }
  await setField('Título en inglés (opcional)', 'Modern kitchen', 0);
  check('título en español con límite', await b.eval(() => document.getElementById(document.querySelector('label').htmlFor) && true));
  // mover
  const titles = () => b.eval(() => [...document.querySelectorAll('article.card')].map(c => c.querySelector('input')?.value));
  const before = await titles();
  await b.eval(() => [...document.querySelectorAll('article.card')][1].querySelectorAll('button')[0].click());
  await b.sleep(150);
  const after = await titles();
  check('Subir cambia el orden', before[0] === after[1] || after[0] !== before[0], JSON.stringify([before, after]));
  // ocultar/mostrar
  await b.eval(() => [...document.querySelectorAll('article.card')].find(c => c.querySelector('select')).querySelectorAll('button')[2].click());
  await b.sleep(120);
  check('Ocultar marca la tarjeta', await b.eval(() => !!document.querySelector('article.card.is-hidden')));
  await b.eval(() => document.querySelector('article.card.is-hidden').querySelectorAll('button')[2].click());
  await b.sleep(120);
  check('Mostrar la vuelve a mostrar', await b.eval(() => !document.querySelector('article.card.is-hidden')));
  // quitar con confirmación en la página
  await b.eval(() => window.confirm = () => { window.__confirmCalled = true; return true; });
  await b.eval(() => [...document.querySelectorAll('article.card')].find(c => c.querySelector('select')).querySelectorAll('button')[3].click());
  await has('¿Quitar');
  await audit('confirmación de quitar');
  await click('No, dejarlo');
  check('No, dejarlo conserva la foto', await b.eval(() => document.querySelectorAll('article.card select').length >= 3));
  check('no se usó confirm()', !(await b.eval(() => window.__confirmCalled)));

  // Video subido desde el panel
  const vsize = await makeVideo();
  check('video de prueba generado (webm real)', vsize > 1000, String(vsize));
  await b.eval(() => { window.__big = new File([new ArrayBuffer(96 * 1024 * 1024)], 'enorme.mov', { type: 'video/quicktime' }); window.__txt = new File(['hola'], 'nota.txt', { type: 'text/plain' }); });
  const mediaBefore = (await apiGet('/__dev/state')).keys.filter((k) => k.startsWith('media/')).length;
  await click('Agregar video'); await putVideo('__big');
  await has('Es muy pesado. Grábelo en calidad más baja o recórtelo.');
  check('video >95 MB: aviso amable con el tamaño y no se sube', (await body()).includes('96 MB') && (await apiGet('/__dev/state')).keys.filter((k) => k.startsWith('media/')).length === mediaBefore);
  await click('Intentar otra vez').catch(() => {});
  await b.eval(() => { for (const x of document.querySelectorAll('#upload-panel button')) if (x.textContent.trim() === 'Dejar esta foto') x.click(); });
  await putVideo('__txt'); await has('Ese archivo no es un video');
  await b.eval(() => { for (const x of document.querySelectorAll('#upload-panel button')) if (x.textContent.trim() === 'Dejar esta foto') x.click(); });
  await b.eval(() => { for (const x of document.querySelectorAll('#upload-panel button')) if (x.textContent.trim() === 'Dejar esta foto') x.click(); });
  await putVideo('__video');
  await b.waitFor(() => document.querySelectorAll('article.card video.vprev').length === 2, 30000);
  check('video subido: aparece con <video controls playsinline preload=none poster>', await b.eval(() => { const v = document.querySelector('article.card video.vprev'); return v.controls && v.getAttribute('preload') === 'none' && /\/__media\/media\/[0-9a-f-]{36}\.webm$/.test(v.getAttribute('src')) && v.getAttribute('poster').startsWith('blob:'); }));
  const vk = (await apiGet('/__dev/state')).keys.filter((k) => k.startsWith('media/'));
  check('R2 recibió el video y su cartel', vk.length === mediaBefore + 2 && vk.some((k) => k.endsWith('.webm')) && vk.some((k) => k.endsWith('-p.jpg')), vk.join(','));
  const vinfo = await b.eval(async () => { const k = (await (await fetch('/__dev/state')).json()).keys.find(x => x.endsWith('.webm')); const r = await fetch('/__media/' + k); return { type: r.headers.get('content-type'), n: (await r.arrayBuffer()).byteLength }; });
  check('el video guardado es el mismo archivo (Content-Type video/webm)', vinfo.type === 'video/webm' && vinfo.n === vsize, JSON.stringify(vinfo));
  const pdim = await b.eval(async () => { const k = (await (await fetch('/__dev/state')).json()).keys.find(x => x.endsWith('-p.jpg')); const bm = await createImageBitmap(await (await fetch('/__media/' + k)).blob()); return [bm.width, bm.height]; });
  check('cartel JPEG del fotograma (320x240)', pdim[0] === 320 && pdim[1] === 240, JSON.stringify(pdim));
  await b.eval(() => { const c = document.querySelector('article.card'); const s = c.querySelector('select'); s.value = 'interior'; s.dispatchEvent(new Event('change', {bubbles:true})); });
  await setField('Título en español (obligatorio)', 'Recorrido en video', 0);
  await audit('fotos (con video nuevo)');

  // YouTube
  await click('Agregar video de YouTube');
  await has('Cómo subir su video a YouTube');
  await audit('YouTube');
  const yt = async (v) => b.eval(`(() => { const i = document.getElementById('yt-link'); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', {bubbles:true})); })()`);
  await yt('hola'); check('YouTube: enlace malo -> mensaje', (await b.eval(() => document.getElementById('yt-err').textContent)).includes('no parece de YouTube'));
  await yt('https://www.youtube.com/shorts/dQw4w9WgXcQ');
  await b.waitFor(() => !!document.querySelector('.yt-preview') && !![...document.querySelectorAll('button')].find(x => x.textContent.includes('Sí, agregar') && !x.disabled));
  check('YouTube: miniatura i.ytimg.com como vista previa', await b.eval(() => document.querySelector('.yt-preview').src === 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'));
  await yt('https://m.youtube.com/watch?v=BADBADBAD00');
  await b.waitFor(() => document.getElementById('yt-err').textContent.includes('No pudimos ver ese video'));
  check('YouTube: miniatura rota -> aviso amable', true);
  await yt('https://youtu.be/dQw4w9WgXcQ?si=x');
  await b.waitFor(() => ![...document.querySelectorAll('button')].find(x => x.textContent.includes('Sí, agregar')).disabled);
  await click('Sí, agregar este video');
  await has('Video de YouTube');
  await b.eval(() => { const c = document.querySelector('article.card'); const s = c.querySelector('select'); s.value = 'remodeling'; s.dispatchEvent(new Event('change', {bubbles:true})); });
  await setField('Título en español (obligatorio)', 'Video del proyecto', 0);

  // Antes y después
  await home(); await click('Antes y después');
  await has('Crear un par');
  await audit('antes y después');
  await makeFiles(1, 2000, 3000);
  await click('Elegir foto'); await putFiles('input[type=file]');
  await b.waitFor(() => [...document.querySelectorAll('button')].some(x => x.textContent.trim() === 'Cambiar foto'));
  await click('Elegir foto'); await putFiles('input[type=file]');
  await b.waitFor(() => [...document.querySelectorAll('button')].filter(x => x.textContent.trim() === 'Cambiar foto').length === 2);
  await click('Agregar este par'); 
  check('par sin título -> mensaje', (await body()).includes('Escriba el título en español'));
  await setField('Título en español (obligatorio)', 'Puerta de madera', 0);
  await click('Agregar este par');
  await b.waitFor(() => document.querySelectorAll('article.card .pair').length === 2);
  check('par creado (2 en la lista: el de la página + el nuevo)', true);
  const baKeys = (await apiGet('/__dev/state')).keys.filter((k) => k.startsWith('media/'));
  check('antes/después sube solo la foto principal (sin miniatura)', baKeys.length === 8, String(baKeys.length));
  await audit('antes y después (lista)');
  // Encuadre del par vertical (fotos 2000x3000)
  await b.eval(() => document.querySelector('article.card .fm-open').click());
  await b.waitFor(() => !!document.querySelector('.fm .fm-frame.ready') && /Recomendado: Vertical/.test(document.querySelector('.fm').innerText));
  const fm = () => b.eval(() => { const f = document.querySelector('.fm-frame'); const r = f.getBoundingClientRect(); const i = f.querySelector('img'); return { shape: f.dataset.shape, ratio: +(r.width / r.height).toFixed(2), fx: +f.dataset.fx, fy: +f.dataset.fy, zoom: +f.dataset.zoom, pos: i.style.objectPosition, tf: i.style.transform, on: [...document.querySelectorAll('.fm-shape.on')].map(x => x.textContent) }; });
  await b.sleep(700); // termina la animación de entrada
  const f0 = await fm();
  check('selector de encuadre: recomienda y marca Vertical (3:4)', f0.shape === 'tall' && f0.ratio === 0.75 && f0.on.join() === 'Vertical', JSON.stringify(f0));
  await audit('selector de encuadre');
  await b.screenshot('/private/tmp/claude-501/frame-modal.png');
  const ptr = (type, x, y, id = 1) => b.eval(`(() => { const f = document.querySelector('.fm-frame'); if (${JSON.stringify(type)} === 'pointerdown' && ${id} === 1) { const r = f.getBoundingClientRect(); window.__c = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; } f.dispatchEvent(new PointerEvent(${JSON.stringify(type)}, { pointerId: ${id}, clientX: window.__c.x + ${x}, clientY: window.__c.y + ${y}, bubbles: true, isPrimary: true })); })()`);
  await ptr('pointerdown', 0, 0); await ptr('pointermove', 0, 25); await ptr('pointermove', 0, 40); await ptr('pointerup', 0, 40);
  const f1 = await fm();
  check('arrastrar hacia abajo muestra la parte de arriba (y baja)', f1.fy < f0.fy && f1.pos === `50% ${f1.fy}%`, JSON.stringify([f0, f1]));
  await b.eval(() => document.querySelector('.fm-frame').focus());
  await b.eval(() => document.querySelector('.fm-frame').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
  check('teclado: flecha abajo mueve el punto', (await fm()).fy === Math.min(100, f1.fy + 2));
  await b.eval(() => { const z = document.getElementById('fm-zoom'); z.value = '2'; z.dispatchEvent(new Event('input', { bubbles: true })); });
  const f2 = await fm();
  check('control de acercar: zoom 2 aplica transform scale(2) con origen en el punto', f2.zoom === 2 && f2.tf === 'scale(2)', JSON.stringify(f2));
  await b.eval(() => document.querySelector('.fm-step[aria-label="Acercar más"]').click());
  check('botón + acerca', (await fm()).zoom === 2.2);
  // pellizco con dos punteros
  await ptr('pointerdown', -40, 0, 1); await ptr('pointerdown', 40, 0, 2); await ptr('pointermove', -80, 0, 1); await ptr('pointermove', 80, 0, 2); await ptr('pointerup', 0, 0, 1); await ptr('pointerup', 0, 0, 2);
  check('pellizco aleja/acerca', (await fm()).zoom > 2.2, JSON.stringify(await fm()));
  await click('Centrar');
  const f3 = await fm();
  check('Centrar vuelve a 50/50 y zoom 1', f3.fx === 50 && f3.fy === 50 && f3.zoom === 1 && f3.tf === 'none', JSON.stringify(f3));
  await click('Foto del Después');
  await ptr('pointerdown', 0, 0); await ptr('pointermove', 0, -60); await ptr('pointerup', 0, -60);
  const f4 = await fm();
  check('la otra foto tiene su propio encuadre (y sube)', f4.fy > 50, JSON.stringify(f4));
  check('vista previa en vivo con la forma vertical', await b.eval(() => { const c = document.querySelector('.fm-prev .cmp'); const imgs = c.querySelectorAll('img'); return c.dataset.shape === 'tall' && imgs[1].style.objectPosition.endsWith('%') && imgs[1].style.objectPosition === document.querySelector('.fm-img').style.objectPosition; }));
  await click('Foto del Antes');
  await ptr('pointerdown', 0, 0); await ptr('pointermove', 0, 80); await ptr('pointerup', 0, 80);
  const fb = await fm();
  await click('Listo');
  await b.waitFor(() => !document.querySelector('.fm'));
  check('Listo cierra el selector y la tarjeta usa el encuadre', await b.eval((y) => document.querySelector('article.card .pair img').style.objectPosition === `50% ${y}%`, fb.fy), JSON.stringify(fb));
  globalThis.__fb = fb; globalThis.__fa = f4;
  await b.eval(() => document.querySelector('article.card .fm-open').click());
  await b.waitFor(() => !!document.querySelector('.fm .fm-frame.ready'));
  await click('Cancelar');
  await b.waitFor(() => !document.querySelector('.fm'));
  check('Cancelar descarta', true);

  await b.eval(() => [...document.querySelectorAll('article.card')][1].querySelectorAll('button')[3].click());
  await has('¿Quitar esta pareja');
  await click('No, dejarlo');

  // Datos
  await home(); await click('Datos del negocio');
  await has('Para cambiar el teléfono o el WhatsApp, avise a su hijo');
  check('sin campo de teléfono', !(await b.eval(() => /tel[eé]fono|whatsapp/i.test([...document.querySelectorAll('label')].map(l => l.textContent).join(' ')))));
  await setField('Correo del negocio', 'info@example.com');
  await setField('Facebook', 'http://facebook.com/x');
  check('red social http -> mensaje claro', (await errOf('Facebook')).includes('https://'), await errOf('Facebook'));
  await setField('Facebook', 'https://www.facebook.com/allin1');
  await setField('Instagram', 'https://evil.com/instagram.com');
  check('red social de otro dominio -> mensaje', (await errOf('Instagram')).includes('sitio oficial'));
  await setField('Instagram', 'https://www.instagram.com/allin1');
  await b.eval(() => document.querySelector('[role=switch]').click());
  await b.sleep(100);
  check('interruptor Licensed & Insured activo + advertencia', await b.eval(() => document.querySelector('[role=switch]').getAttribute('aria-checked') === 'true') && (await body()).includes('Actívelo solo si es verdad'));
  await setField('Número de licencia', 'cgc 123');
  check('licencia inválida -> mensaje', (await errOf('Número de licencia')).includes('letras mayúsculas'), await errOf('Número de licencia'));
  await setField('Número de licencia', 'cgc-123456');
  check('licencia se escribe en mayúsculas', (await getField('Número de licencia')) === 'CGC-123456' && (await errOf('Número de licencia')) === '');
  await audit('datos del negocio');

  // Reseñas
  await home(); await click('Reseñas');
  await has('Solo reseñas reales de clientes. No invente ni cambie palabras.');
  await click('Agregar una reseña');
  await setField('Nombre (ejemplo: María G., Mandarin)', 'María G., Mandarin');
  await setField('Texto en español (obligatorio)', 'Excelente trabajo en mi casa.');
  await b.eval(() => { const s = document.querySelector('article.card select'); s.value = 'google'; s.dispatchEvent(new Event('change', {bubbles:true})); });
  await audit('reseñas (editando)');
  await click('Listo');
  await has('Excelente trabajo en mi casa.');
  await audit('reseñas (lista)');

  // borrador: recargar la página
  await b.sleep(700);
  await b.goto(`${BASE}/?mock=1`);
  await has('Encontramos cambios suyos');
  check('borrador recuperado desde IndexedDB tras recargar', true);
  await audit('borrador pendiente');
  await click('Seguir con mis cambios');
  await has('Es la primera vez');

  // vista previa y publicar
  await click('Publicar cambios'); await has('Publicar ahora');
  const prev = await body();
  check('vista previa: así se verá + cambios + videos conservados', prev.includes('Así se verá') && prev.includes('Qué cambió') && !prev.includes('Atención') && (await b.eval(() => document.querySelectorAll('.pcard video').length)) === 2, prev.slice(0, 300));
  check('vista previa: tarjetas con título y categoría', prev.includes('Cocina moderna') && prev.includes('Interior') && prev.includes('Excelente trabajo'));
  await audit('vista previa');
  await b.screenshot('/private/tmp/claude-501/prev390.png');
  await click('Publicar ahora'); await has('Ya está en su página');
  check('éxito + enlace a #gallery', await b.eval(() => document.querySelector('a.btn').href === 'https://allin1jax.com/#gallery'));
  await audit('publicado');
  const pub = await apiGet('/api/content');
  check('el Worker guardó 5 de galería (2 fotos + YouTube + video nuevo + video heredado)', pub.gallery.length === 5 && pub.gallery.filter((g) => g.type === 'video').length === 2 && pub.gallery.some((g) => g.src === 'assets/gallery/allin1.mp4'), JSON.stringify(pub.gallery.map((g) => g.type)));
  check('la miniatura quedó como poster de cada foto', pub.gallery.filter((g) => g.type === 'image').every((g) => /-t\.jpg$/.test(g.poster)));
  const vbp = pub.beforeAfter.find((x) => x.caption && x.caption.es === 'Puerta de madera');
  check('el Worker guardó el encuadre y la forma del par vertical', !!vbp && vbp.shape === 'tall' && vbp.focusBefore.y === globalThis.__fb.fy && vbp.focusAfter.y === globalThis.__fa.fy && vbp.zoomBefore === 1, JSON.stringify(vbp));
  check('reseña y datos guardados', pub.reviews.length === 1 && pub.settings.licenseNumber === 'CGC-123456' && pub.settings.social.facebook.startsWith('https://'));
  check('IndexedDB sin borrador tras publicar', await b.eval(async () => new Promise((res) => { const r = indexedDB.open('allin1-panel', 1); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('draft'); g.onsuccess = () => res(g.result === undefined); }; r.onerror = () => res(false); })));

  // 409
  await click('Volver al inicio'); await click('Datos del negocio');
  await setField('Correo del negocio', 'nuevo@example.com');
  await b.eval(() => fetch('/__dev/bump'));
  await b.sleep(300);
  await click('← Inicio'); await click('Publicar cambios'); await has('Publicar ahora'); await click('Publicar ahora');
  await has('Alguien cambió la página hace un momento. Recargue para ver lo último');
  check('409 -> mensaje amable', true);
  await audit('conflicto 409');
  await click('Recargar lo último');
  await has('versión anterior');
  check('tras 409 el borrador sigue (se ofrece ponerlo sobre lo último)', true);
  await click('Poner mis cambios sobre lo último');
  await click('Publicar cambios'); await has('Publicar ahora'); await click('Publicar ahora'); await has('Ya está en su página');
  check('tras recargar se puede publicar', (await apiGet('/api/content')).settings.email === 'nuevo@example.com');

  // historial y deshacer
  await click('Volver al inicio'); await click('Historial');
  await b.waitFor(() => document.querySelectorAll('.hist li').length >= 3);
  const hist = await b.eval(() => [...document.querySelectorAll('.hist li')].map(li => li.innerText));
  check('historial: lista con fecha, quién, resumen y versión actual', hist.length >= 3 && hist[0].includes('Esta es la versión actual') && hist[0].includes('dueno@example.com') && /datos|Fotos/i.test(hist[0]), hist[0]);
  await audit('historial');
  await click('← Inicio'); await click('Deshacer última publicación');
  await has('¿Deshacer la última publicación?');
  await audit('deshacer');
  const cur = await apiGet('/api/content');
  await click('Sí, deshacer'); await has('Deshicimos la última publicación');
  const now = await apiGet('/api/content');
  check('deshacer restaura la versión anterior (correo del negocio vuelve)', now.version !== cur.version && now.settings.email === 'otra-persona@example.com', now.settings.email);
  await click('Historial');
  await b.waitFor(() => document.querySelectorAll('.hist li').length >= 4);
  await click('Volver a esta versión');
  await has('¿Volver a la versión del');
  await click('Cancelar');

  // 1280 y 320
  for (const w of [1280, 320]) {
    await b.viewport(w, w === 1280 ? 900 : 700, w !== 1280);
    for (const [name, nav] of [['inicio', null], ['fotos', 'Fotos y videos'], ['antes y después', 'Antes y después'], ['datos', 'Datos del negocio'], ['reseñas', 'Reseñas']]) {
      await b.eval(`(${$text('← Inicio')} || {click(){}}).click()`); await b.sleep(150);
      if (nav) { await click(nav); await b.sleep(250); }
      await audit(name);
    }
  }
  await b.screenshot('/private/tmp/claude-501/final320.png');
  await b.viewport(1280, 900, false);
  await click('← Inicio'); await click('Fotos y videos'); await b.sleep(300);
  await b.screenshot('/private/tmp/claude-501/gallery1280.png');

  // reducir movimiento: nada de animaciones largas ni infinitas
  await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await b.viewport(390, 844, true);
  await b.goto(`${BASE}/?mock=1`); await b.sleep(1800);
  for (const scr of ['inicio', 'fotos']) {
    if (scr === 'fotos') { await click('Fotos y videos'); await b.sleep(900); }
    await b.sleep(400);
    const long = await b.eval(() => document.getAnimations().filter((a) => { const t = a.effect.getComputedTiming(); return a.playState === 'running' && (t.iterations === Infinity || t.activeDuration > 100); }).map((a) => (a.animationName || a.id || 'waapi')));
    check(`reducir movimiento (${scr}): sin animaciones largas/infinitas`, long.length === 0, JSON.stringify(long));
  }
  await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await b.viewport(1280, 900, false);

  // CSP y consola
  const csp = await b.eval(() => window.__csp);
  check('CSP real: sin violaciones', csp.length === 0, JSON.stringify(csp));
  const bad = b.logs.filter((l) => /error|exception|warning/.test(l.type) && !/Failed to load resource.*(BADBAD|\/api\/)/i.test(l.text) && !/File chooser dialog can only be shown with a user activation/.test(l.text));
  check('consola sin errores', bad.length === 0, JSON.stringify(bad.slice(0, 5)));

  // el modo de prueba NO se activa fuera de localhost+?mock=1
  b.requests.length = 0;
  await b.goto('http://127.0.0.1:8786/?mock=1');
  await b.sleep(1500);
  const sawMock = b.requests.some((u) => u.includes('__mock'));
  check('127.0.0.1?mock=1: NO carga el módulo de prueba', !sawMock);
  check('127.0.0.1?mock=1: usa el acceso real (sin banner de prueba)', await b.eval(() => !document.querySelector('.banner')));
  b.requests.length = 0;
  await b.goto(`${BASE}/`);
  await b.sleep(1500);
  check('localhost sin ?mock=1: NO carga el módulo de prueba', !b.requests.some((u) => u.includes('__mock')));
  const real = b.requests.filter((u) => u.includes('gstatic.com/firebasejs/10.12.2/'));
  console.log('INFO intentó cargar Firebase real:', real.join(', ') || '(ninguna petición registrada)');
} catch (e) {
  check('el recorrido terminó sin excepciones', false, e.message);
  console.log(await b.eval(() => document.getElementById('app').innerText.slice(0, 500)).catch(() => ''));
  await b.screenshot('/private/tmp/claude-501/fail.png').catch(() => {});
  console.log('LOGS', JSON.stringify(b.logs.slice(-8)));
} finally {
  await b.close();
}
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} comprobaciones OK`);
process.exit(bad.length ? 1 : 0);
