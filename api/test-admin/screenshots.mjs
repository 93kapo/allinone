// Capturas del panel (claro/oscuro, 390x844 y 1280x800). Uso: node test-admin/screenshots.mjs <carpeta de salida> [prefijo]
import { launch } from './cdp.mjs';

const OUT = process.argv[2];
const BASE = process.env.BASE || 'http://localhost:8786';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64').toString('base64');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(scheme, w, h, mobile) {
  const b = await launch({ port: 9333 });
  const tag = `${scheme}-${w}`;
  await fetch(`${BASE}/__dev/reset`);
  try {
    await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
    await b.send('Fetch.enable', { patterns: [{ urlPattern: 'https://allin1jax.com/*' }, { urlPattern: 'https://i.ytimg.com/*' }] });
    b.on('Fetch.requestPaused', (p) => b.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'image/png' }], body: PNG }).catch(() => {}));
    await b.viewport(w, h, mobile);
    const shot = (n) => b.screenshot(`${OUT}/${n}-${tag}.png`);
    const txt = (x) => `[...document.querySelectorAll('button,a')].find(e => (e.textContent.trim() === ${JSON.stringify(x)} || (e.querySelector('.tile-title')||{}).textContent === ${JSON.stringify(x)}) && e.offsetParent !== null)`;
    const click = async (x) => { await b.waitFor(`!!(${txt(x)})`); await b.eval(`(${txt(x)}).click()`); await sleep(700); };
    const files = (n, w, h) => b.eval(`(async () => { const out = []; for (let i = 0; i < ${n}; i++) { const c = document.createElement('canvas'); c.width = ${w}; c.height = ${h}; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, ${h}); gr.addColorStop(0, 'hsl(' + (i * 60 + 200) + ',60%,55%)'); gr.addColorStop(1, 'hsl(' + (i * 60 + 260) + ',50%,35%)'); g.fillStyle = gr; g.fillRect(0, 0, ${w}, ${h}); g.fillStyle = '#fff'; g.font = 'bold ' + (${h} / 14) + 'px sans-serif'; g.fillText('ARRIBA ' + i, 40, ${h} / 10); g.fillText('ABAJO ' + i, 40, ${h} - 40); g.strokeStyle = '#fff'; g.lineWidth = 12; g.strokeRect(6, 6, ${w} - 12, ${h} - 12); const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9)); out.push(new File([blob], 'f' + i + '.jpg', { type: 'image/jpeg' })); } window.__files = out; return out.length; })()`);
    const put = (sel) => b.eval(`(() => { const l = [...document.querySelectorAll(${JSON.stringify(sel)})]; const inp = l[l.length - 1]; const dt = new DataTransfer(); for (const f of window.__files) dt.items.add(f); inp.files = dt.files; inp.dispatchEvent(new Event('change', {bubbles:true})); })()`);
    const setF = (lbl, v, idx = 0) => b.eval(`(() => { const lb = [...document.querySelectorAll('label')].filter(x => x.textContent.trim() === ${JSON.stringify(lbl)})[${idx}]; const i = document.getElementById(lb.htmlFor); i.focus(); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', {bubbles:true})); i.blur(); })()`);

    await b.goto(`${BASE}/?mock=1`); await sleep(2200); await shot('01-login');
    await b.eval(() => { document.getElementById('login-email').value = 'dueno@example.com'; });
    await click('Enviarme el enlace'); await sleep(900); await shot('02-login-enviado');
    await b.goto(`${BASE}/?mock=1&mockLink=dueno@example.com`); await sleep(1800); await shot('03-inicio');
    await click('Fotos y videos'); await sleep(500);
    await files(3, 3000, 2000); await click('Agregar fotos'); await put('input[type=file]');
    await sleep(500); await shot('04a-fotos-subiendo');
    await b.waitFor(() => document.querySelectorAll('article.card select').length >= 4, 30000); await sleep(1500);
    await b.eval(() => document.querySelectorAll('article.card select').forEach((s, i) => { if (i < 3) { s.value = ['interior', 'exterior', 'remodeling'][i]; s.dispatchEvent(new Event('change', { bubbles: true })); } }));
    await setF('Título en español (obligatorio)', 'Cocina moderna', 0); await setF('Título en español (obligatorio)', 'Fachada nueva', 1); await setF('Título en español (obligatorio)', 'Baño renovado', 2);
    await sleep(500); await shot('04-fotos');
    await b.eval(() => window.scrollTo(0, 99999)); await sleep(500); await shot('04b-fotos-abajo');
    await b.eval(() => window.scrollTo(0, 0));
    await click('← Inicio'); await click('Antes y después'); await sleep(400);
    await files(1, 2000, 3000); await click('Elegir foto'); await put('input[type=file]');
    await b.waitFor(() => [...document.querySelectorAll('button')].some(x => x.textContent.trim() === 'Cambiar foto'));
    await files(1, 2000, 3000); await click('Elegir foto'); await put('input[type=file]');
    await b.waitFor(() => [...document.querySelectorAll('button')].filter(x => x.textContent.trim() === 'Cambiar foto').length === 2);
    await setF('Título en español (obligatorio)', 'Puerta de madera', 0);
    await sleep(500); await shot('05-antes-despues');
    await click('Agregar este par'); await sleep(900); await b.eval(() => window.scrollTo(0, 420)); await sleep(400); await shot('05b-antes-despues-lista');
    await b.eval(() => window.scrollTo(0, 0));
    await click('← Inicio'); await click('Datos del negocio'); await sleep(400);
    await setF('Correo del negocio', 'info@example.com'); await setF('Facebook', 'http://facebook.com/x');
    await b.eval(() => document.querySelector('[role=switch]').click()); await sleep(500); await shot('06-datos');
    await setF('Facebook', 'https://www.facebook.com/allin1'); await b.eval(() => window.scrollTo(0, 0));
    await click('← Inicio'); await click('Reseñas'); await sleep(400); await click('Agregar una reseña');
    await setF('Nombre (ejemplo: María G., Mandarin)', 'María G., Mandarin'); await setF('Texto en español (obligatorio)', 'Excelente trabajo, muy puntuales y limpios.');
    await b.eval(() => { const s = document.querySelector('article.card select'); s.value = 'google'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await sleep(500); await shot('07-resenas');
    await click('← Inicio'); await sleep(500); await shot('08-inicio-con-cambios');
    await click('Publicar cambios'); await sleep(1500); await shot('09-vista-previa');
    await b.eval(() => window.scrollTo(0, 99999)); await sleep(500); await shot('09b-vista-previa-abajo');
    await click('Publicar ahora'); await sleep(500); await shot('10-publicado-a'); await sleep(1500); await shot('10-publicado');
  } finally { await b.close(); }
}
await run('light', 390, 844, true);
await run('dark', 390, 844, true);
await run('light', 1280, 800, false);
await run('dark', 1280, 800, false);
console.log('listo');
