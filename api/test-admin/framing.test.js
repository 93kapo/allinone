import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { frameStyle, recommendShape, dragFocus, pinchZoom, stepZoom, normFocus, normZoom, isCentered, framingFields, clamp } from '../admin/js/lib/framing.js';
import { validateState } from '../admin/js/lib/validate.js';
import { normalize } from '../admin/js/store.js';

test('encuadre: valores por defecto y límites', () => {
  assert.deepEqual(normFocus(undefined), { x: 50, y: 50 });
  assert.deepEqual(normFocus({ x: -5, y: 140.6 }), { x: 0, y: 100 });
  assert.deepEqual(normFocus({ x: 'a', y: 1 }), { x: 50, y: 50 });
  assert.equal(normZoom(undefined), 1); assert.equal(normZoom(0.2), 1); assert.equal(normZoom(9), 3); assert.equal(normZoom(1.234), 1.23); assert.equal(normZoom(NaN), 1);
  assert.equal(stepZoom(1, -0.2), 1); assert.equal(stepZoom(2.9, 0.2), 3); assert.equal(stepZoom(1, 0.2), 1.2);
  assert.equal(isCentered({ x: 50, y: 50 }, 1), true); assert.equal(isCentered({ x: 49, y: 50 }, 1), false); assert.equal(isCentered(undefined, 2), false);
});

test('recomendación de forma según las fotos reales', () => {
  const v = { w: 2000, h: 3000 }, hz = { w: 3000, h: 2000 }, sq = { w: 1000, h: 1040 };
  assert.equal(recommendShape([v, v]), 'tall');
  assert.equal(recommendShape([v, hz]), 'wide');
  assert.equal(recommendShape([hz, hz]), 'wide');
  assert.equal(recommendShape([sq, sq]), 'square');
  assert.equal(recommendShape([v, null]), 'tall');
  assert.equal(recommendShape([]), 'wide');
  assert.equal(recommendShape([{ w: 1000, h: 1100 }]), 'square'.length ? recommendShape([{ w: 1000, h: 1100 }]) : '');
});

test('arrastrar: la foto sigue al dedo y nunca sale de 0-100', () => {
  const frame = { w: 300, h: 225 }, img = { w: 2000, h: 3000 }; // foto vertical en marco horizontal: solo se mueve en vertical
  const down = dragFocus({ focus: { x: 50, y: 50 }, dx: 0, dy: 40, frame, img, zoom: 1 });
  assert.equal(down.x, 50); assert.ok(down.y < 50, 'arrastrar hacia abajo muestra la parte de arriba');
  const up = dragFocus({ focus: { x: 50, y: 50 }, dx: 0, dy: -40, frame, img, zoom: 1 });
  assert.ok(up.y > 50);
  assert.equal(dragFocus({ focus: { x: 50, y: 5 }, dx: 0, dy: 9999, frame, img }).y, 0);
  assert.equal(dragFocus({ focus: { x: 50, y: 95 }, dx: 0, dy: -9999, frame, img }).y, 100);
  const wide = dragFocus({ focus: { x: 50, y: 50 }, dx: 30, dy: 0, frame: { w: 300, h: 300 }, img: { w: 3000, h: 2000 } });
  assert.ok(wide.x < 50);
  // sin sobrante no se mueve; con acercamiento sí
  assert.equal(dragFocus({ focus: { x: 50, y: 50 }, dx: 30, dy: 0, frame: { w: 300, h: 400 }, img: { w: 300, h: 400 } }).x, 50);
  assert.ok(dragFocus({ focus: { x: 50, y: 50 }, dx: 30, dy: 0, frame: { w: 300, h: 400 }, img: { w: 300, h: 400 }, zoom: 2 }).x < 50);
  assert.deepEqual(dragFocus({ focus: undefined, dx: 0, dy: 0, frame, img: null }), { x: 50, y: 50 });
});

test('pellizcar', () => {
  assert.equal(pinchZoom(1, 100, 200), 2); assert.equal(pinchZoom(1, 100, 900), 3); assert.equal(pinchZoom(2, 100, 10), 1); assert.equal(pinchZoom(2, 0, 50), 2);
  assert.equal(clamp(5, 0, 3), 3);
});

test('el CSS de encuadre del panel es idéntico al del sitio (content.js)', () => {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../../web/assets/js/content.js', import.meta.url), 'utf8'), ctx);
  const site = ctx.AIOContent.frameStyle;
  for (const [f, z] of [[undefined, undefined], [{ x: 0, y: 100 }, 1], [{ x: 33, y: 71 }, 2.5], [{ x: 120, y: -3 }, 1.234], [{ x: 'a' }, 9], [{ x: 50, y: 50 }, 3]]) {
    assert.deepEqual(frameStyle(f, z), JSON.parse(JSON.stringify(site(f, z))), JSON.stringify([f, z]));
  }
});

test('el estado conserva el encuadre y el payload lo envía; el Worker lo acepta', () => {
  const st = normalize({ settings: {}, gallery: [{ id: 'g', type: 'image', category: 'interior', src: 'assets/gallery/a.jpg', w: 10, h: 10, caption: { es: 'x' }, focus: { x: 10, y: 90 } }],
    beforeAfter: [{ id: 'b', before: 'assets/gallery/a.jpg', after: 'assets/gallery/b.jpg', caption: { es: 'Puerta' }, focusBefore: { x: 20, y: 30 }, zoomAfter: 1.5, shape: 'tall' }], reviews: [] });
  assert.deepEqual(st.beforeAfter[0].focusBefore, { x: 20, y: 30 }); assert.equal(st.beforeAfter[0].zoomAfter, 1.5); assert.equal(st.beforeAfter[0].shape, 'tall');
  assert.equal('focusAfter' in st.beforeAfter[0], false);
  assert.deepEqual(st.gallery[0].focus, { x: 10, y: 90 });
  const r = validateState(st, new Date('2026-10-24T12:00:00Z'));
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.payload.beforeAfter[0].focusBefore, { x: 20, y: 30 });
  assert.equal(r.payload.beforeAfter[0].shape, 'tall');
  assert.deepEqual(r.payload.gallery[0].focus, { x: 10, y: 90 });
  assert.deepEqual(framingFields({ shape: 'weird', zoomBefore: 'x' }), {});
});
