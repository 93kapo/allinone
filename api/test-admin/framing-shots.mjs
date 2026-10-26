// Capturas del selector de encuadre y del comparador del SITIO con dos fotos verticales con marcas arriba y abajo.
// Uso: node test-admin/framing-shots.mjs <carpeta de salida>   (con el dev-server en 8786)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';

const OUT = process.argv[2];
const BASE = 'http://localhost:8786';
const WEB = resolve(fileURLToPath(new URL('../../web', import.meta.url)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };
const site = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = join(WEB, normalize(p === '/' ? '/index.html' : p));
    if (!f.startsWith(WEB)) { res.writeHead(403); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(await readFile(f));
  } catch { res.writeHead(404); res.end('no'); }
}).listen(8787);

async function run(w, h, mobile) {
  await fetch(`${BASE}/__dev/reset`);
  const b = await launch({ port: 9333 });
  try {
    await b.send('Fetch.enable', { patterns: [{ urlPattern: 'https://admin.allin1jax.com/*' }, { urlPattern: 'https://media.allin1jax.com/*' }, { urlPattern: 'https://allin1jax.com/*' }, { urlPattern: 'https://*.google*' }, { urlPattern: 'https://fonts.*' }] });
    b.on('Fetch.requestPaused', async (p) => {
      try {
        const u = new URL(p.request.url);
        let r = null;
        if (u.hostname === 'admin.allin1jax.com') r = await fetch(`${BASE}${u.pathname}`);
        else if (u.hostname === 'media.allin1jax.com') r = await fetch(`${BASE}/__media${u.pathname}`);
        if (r && r.ok) {
          const buf = Buffer.from(await r.arrayBuffer());
          await b.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: r.headers.get('content-type') || 'application/octet-stream' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: buf.toString('base64') });
        } else await b.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'Failed' });
      } catch { await b.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'Failed' }).catch(() => {}); }
    });
    await b.viewport(w, h, mobile);
    const shot = (n) => b.screenshot(`${OUT}/${n}-${w}.png`);
    const txt = (x) => `[...document.querySelectorAll('button,a')].find(e => (e.textContent.trim() === ${JSON.stringify(x)} || (e.querySelector('.tile-title')||{}).textContent === ${JSON.stringify(x)}) && e.offsetParent !== null)`;
    const click = async (x) => { await b.waitFor(`!!(${txt(x)})`); await b.eval(`(${txt(x)}).click()`); await sleep(600); };
    const files = (n) => b.eval(`(async () => { const out = []; for (let i = 0; i < ${n}; i++) { const W = 1500, H = 2250; const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, i ? '#2E8B57' : '#B5651D'); gr.addColorStop(1, i ? '#BFE8CF' : '#F2D2A9'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.fillRect(0, 0, W, 150); g.fillRect(0, H - 150, W, 150); g.fillStyle = '#000'; g.font = 'bold 110px sans-serif'; g.fillText(${'i'} ? 'DESPUÉS - ARRIBA' : 'ANTES - ARRIBA', 60, 112); g.fillText(i ? 'DESPUÉS - ABAJO' : 'ANTES - ABAJO', 60, H - 40); g.fillStyle = '#12333A'; g.beginPath(); g.arc(W / 2, H / 2, 420, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 140px sans-serif'; g.fillText('CENTRO', W / 2 - 250, H / 2 + 50); const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9)); out.push(new File([blob], 'v' + i + '.jpg', { type: 'image/jpeg' })); } window.__files = out; })()`);
    const put = (i) => b.eval(`(() => { const l = [...document.querySelectorAll('input[type=file]')]; const inp = l[l.length - 1]; const dt = new DataTransfer(); dt.items.add(window.__files[${i}]); inp.files = dt.files; inp.dispatchEvent(new Event('change', {bubbles:true})); })()`);
    const ptr = (type, x, y, id = 1) => b.eval(`(() => { const f = document.querySelector('.fm-frame'); if (${JSON.stringify(type)} === 'pointerdown' && ${id} === 1) { const r = f.getBoundingClientRect(); window.__c = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; } f.dispatchEvent(new PointerEvent(${JSON.stringify(type)}, { pointerId: ${id}, clientX: window.__c.x + ${x}, clientY: window.__c.y + ${y}, bubbles: true, isPrimary: true })); })()`);

    await b.goto(`${BASE}/?mock=1`); await sleep(1500);
    await b.eval(() => { document.getElementById('login-email').value = 'dueno@example.com'; });
    await click('Enviarme el enlace');
    await b.goto(`${BASE}/?mock=1&mockLink=dueno@example.com`); await sleep(1800);
    await click('Antes y después'); await sleep(400);
    await files(2);
    await click('Elegir foto'); await put(0);
    await b.waitFor(() => [...document.querySelectorAll('button')].some(x => x.textContent.trim() === 'Cambiar foto'));
    await click('Elegir foto'); await put(1);
    await b.waitFor(() => [...document.querySelectorAll('button')].filter(x => x.textContent.trim() === 'Cambiar foto').length === 2);
    await b.eval(() => { const lb = [...document.querySelectorAll('label')].find(x => x.textContent.trim() === 'Título en español (obligatorio)'); const i = document.getElementById(lb.htmlFor); i.value = 'Puerta vertical'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await click('Agregar este par'); await sleep(900);
    await b.eval(() => document.querySelector('article.card').scrollIntoView()); await sleep(300); await shot('f1-tarjeta-par-vertical');
    await b.eval(() => document.querySelector('article.card .fm-open').click());
    await b.waitFor(() => !!document.querySelector('.fm .fm-frame.ready')); await sleep(900);
    await shot('f2-selector-inicial');
    // mover el "antes" para ver la parte de arriba y el "después" acercado hacia el centro
    await b.eval(() => { const f = document.querySelector('.fm-frame'); window.__n = []; for (const t of ['pointerdown', 'pointermove', 'pointerup']) f.addEventListener(t, (e) => window.__n.push(t + ':' + Math.round(e.clientY) + ':' + e.pointerId)); });
    await ptr('pointerdown', 0, 0); await ptr('pointermove', 0, 30); await ptr('pointermove', 0, 90); await ptr('pointerup', 0, 90);
    console.log(w, 'tras arrastrar:', JSON.stringify(await b.eval(() => { const f = document.querySelector('.fm-frame'); const r = f.getBoundingClientRect(); return { fy: f.dataset.fy, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), ev: window.__n, dims: document.querySelector('.fm-img').naturalWidth + 'x' + document.querySelector('.fm-img').naturalHeight }; })));
    await sleep(300); await shot('f3-selector-antes-arriba');
    await click('Foto del Después');
    await b.eval(() => { const z = document.getElementById('fm-zoom'); z.value = '1.6'; z.dispatchEvent(new Event('input', { bubbles: true })); });
    await sleep(300); await shot('f4-selector-despues-zoom');
    await click('Listo'); await sleep(900);
    await click('← Inicio'); await click('Publicar cambios'); await sleep(1200);
    await b.eval(() => document.querySelector('.cmp') && document.querySelector('.cmp').scrollIntoView({ block: 'center' })); await sleep(1500);
    await shot('f5-vista-previa-comparador');
    await click('Publicar ahora'); await sleep(1500);
    // el SITIO real con ese contenido
    await b.goto('http://localhost:8787/'); await sleep(2500);
    await b.eval(() => { const g = document.getElementById('ba-grid'); if (g) g.scrollIntoView({ block: 'center' }); }); await sleep(2000);
    await shot('f6-sitio-comparador');
    console.log(w, 'sitio:', JSON.stringify(await b.eval(() => [...document.querySelectorAll('#ba-grid .ba')].map(e => { const r = e.getBoundingClientRect(); return { shape: e.dataset.shape, w: Math.round(r.width), h: Math.round(r.height), imgs: [...e.querySelectorAll('img')].map(i => i.style.objectPosition + ' ' + i.style.transform) }; }))));
  } finally { await b.close(); }
}
if (!process.argv[3]) await run(390, 844, true);
await run(1280, 800, false);
site.close();
console.log('listo');
