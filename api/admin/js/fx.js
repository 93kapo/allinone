// Efectos de interfaz: avisos (toast), diálogos, animación FLIP, confeti y contadores.
// Solo se anima transform/opacity. Con "reducir movimiento" no hay movimiento: solo fundidos.
import { h, $ } from './dom.js';
import { icon } from './icons.js';

export const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const EASE = 'cubic-bezier(.22,.9,.3,1)';

// Animación segura (si el navegador no soporta WAAPI, no pasa nada).
export function anim(el, frames, opts) {
  if (!el || !el.animate) return null;
  try { return el.animate(frames, { easing: EASE, fill: 'both', ...opts }); } catch { return null; }
}

// ---- Avisos ----
export function toast(text, { kind = 'info', actionLabel = '', onAction = null, ms = 4500 } = {}) {
  const root = $('#toasts');
  if (!root) return () => {};
  const close = () => { if (!el.isConnected) return; clearTimeout(timer); const a = anim(el, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(12px)' }], { duration: reduced() ? 1 : 200 }); const done = () => el.remove(); a ? (a.onfinish = done) : done(); };
  const el = h('div', { class: `toast toast-${kind}` },
    h('span', { class: 'toast-ico' }, icon(kind === 'error' ? 'alert' : 'check', { size: 22 })),
    h('span', { class: 'toast-text' }, text),
    actionLabel ? h('button', { class: 'toast-act', type: 'button', onclick: () => { close(); if (onAction) onAction(); } }, actionLabel) : null);
  root.append(el);
  anim(el, [{ opacity: 0, transform: 'translateY(16px) scale(.98)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: reduced() ? 1 : 320 });
  const timer = setTimeout(close, ms);
  return close;
}

// ---- Diálogo (hoja inferior en el teléfono, centrado en pantallas grandes) ----
let openDlg = null;
export function closeDialog() { if (openDlg) openDlg.close(false); }
export function dialog({ title, text, buttons }) {
  closeDialog();
  const root = $('#dialog-root');
  const prev = document.activeElement;
  const inertEls = ['#app', '.top', '#bar'].map((q) => $(q)).filter(Boolean);
  const back = h('div', { class: 'backdrop' });
  const panel = h('div', { class: 'sheet', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title || text, tabindex: '-1' },
    h('span', { class: 'grab', 'aria-hidden': 'true' }),
    title ? h('h2', { class: 'sheet-title' }, title) : null,
    h('p', { class: 'sheet-text' }, text),
    h('div', { class: 'stack' }, buttons.map((b) => h('button', { class: `btn btn-big ${b.cls || 'btn-secondary'}`, type: 'button', onclick: () => { api.close(true); if (b.onClick) b.onClick(); } }, b.label))));
  const wrap = h('div', { class: 'dlg' }, back, panel);
  const api = {
    close(ok) {
      if (openDlg !== api) return;
      openDlg = null;
      for (const e of inertEls) e.inert = false;
      document.removeEventListener('keydown', onKey, true);
      const a = anim(panel, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(24px)', opacity: 0 }], { duration: reduced() ? 1 : 180 });
      anim(back, [{ opacity: 1 }, { opacity: 0 }], { duration: reduced() ? 1 : 180 });
      const done = () => wrap.remove();
      a ? (a.onfinish = done) : done();
      if (prev && prev.isConnected) { try { prev.focus({ preventScroll: true }); } catch { /* nada */ } }
      if (!ok && buttons[buttons.length - 1].onClick && ok === false && api.cancelCb) api.cancelCb();
    },
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); api.close(false); const last = buttons[buttons.length - 1]; if (last && last.onClick) last.onClick(); }
    if (e.key === 'Tab') {
      const f = [...panel.querySelectorAll('button')];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
    }
  };
  back.addEventListener('click', () => { api.close(false); const last = buttons[buttons.length - 1]; if (last && last.onClick) last.onClick(); });
  root.append(wrap);
  for (const e of inertEls) e.inert = true;
  document.addEventListener('keydown', onKey, true);
  openDlg = api;
  anim(back, [{ opacity: 0 }, { opacity: 1 }], { duration: reduced() ? 1 : 220 });
  anim(panel, [{ transform: 'translateY(28px) scale(.98)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: reduced() ? 1 : 320 });
  (panel.querySelector('button') || panel).focus({ preventScroll: true });
  return api;
}

// ---- FLIP: las tarjetas se deslizan a su nueva posición ----
export function snapshot() {
  const m = new Map();
  for (const el of document.querySelectorAll('[data-id]')) m.set(el.dataset.id, el.getBoundingClientRect());
  return m;
}
export function playFlip(first) {
  if (reduced()) return;
  for (const el of document.querySelectorAll('[data-id]')) {
    const a = first.get(el.dataset.id);
    if (!a) continue;
    const b = el.getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    anim(el, [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }], { duration: 340 });
  }
}

// ---- Confeti de marca (ligero, 1.2 s) ----
const COLORS = ['#38C0D9', '#4E7D85', '#12333A', '#8EE3F2', '#FFFFFF'];
export function confetti({ x = innerWidth / 2, y = innerHeight / 3, count = 22, ms = 1200 } = {}) {
  if (reduced()) return;
  const root = $('#fx-root');
  if (!root) return;
  for (let i = 0; i < count; i++) {
    const p = h('i', { class: 'confetti', 'aria-hidden': 'true' });
    p.style.background = COLORS[i % COLORS.length];
    p.style.left = `${x}px`; p.style.top = `${y}px`;
    if (i % 3 === 0) p.style.borderRadius = '50%';
    root.append(p);
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = 90 + Math.random() * 130;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 60;
    const a = anim(p, [
      { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 540 - 270}deg) scale(1)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${dx * 1.15}px,${dy + 120}px) rotate(${Math.random() * 720 - 360}deg) scale(.6)`, opacity: 0 },
    ], { duration: ms, delay: Math.random() * 120 });
    if (a) a.onfinish = () => p.remove(); else p.remove();
  }
}

// ---- Contador animado ----
export function countUp(el, to, ms = 700) {
  if (reduced() || to <= 0) { el.textContent = String(to); return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
