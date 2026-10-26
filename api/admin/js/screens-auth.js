// Acceso sin contraseña: la persona escribe su correo y toca el enlace que le llega.
import { h, s } from './dom.js';
import { t } from './i18n.js';
import { app, register, announce } from './app.js';
import { icon } from './icons.js';

export const EMAIL_KEY = 'emailParaEnlace';
export const hooks = { enter: async () => {}, completeLink: async () => {} };

const store = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
export const savedEmail = () => { try { return localStorage.getItem(EMAIL_KEY) || ''; } catch { return ''; } };
export const forgetEmail = () => store(EMAIL_KEY, null);

const errBox = (text) => h('div', { class: 'msg msg-error', role: 'alert' }, icon('alert', { size: 22 }), h('p', null, text));

function sendError(err) {
  const c = err && err.code;
  if (c === 'auth/network-request-failed') return t('loginNetwork');
  if (c === 'auth/too-many-requests') return t('loginTooMany');
  if (c === 'auth/invalid-email') return t('badEmail');
  return t('loginGeneric');
}

// Ícono de la marca que se "dibuja" y luego se funde con el ícono real.
function mark() {
  const P = (d) => s('path', { d, pathLength: '1' });
  const draw = s('svg', { class: 'draw', viewBox: '0 0 263 300', 'aria-hidden': 'true' },
    P('M150 292V14L243 86V292'), P('M12 292V162L112 92V150'), P('M62 292V200L148 150V292'),
    s('circle', { cx: 92, cy: 244, r: 7, pathLength: '1' }));
  return h('div', { class: 'mark', 'aria-hidden': 'true' }, draw, h('img', { src: 'assets/icon-teal.png', alt: '', width: 263, height: 300 }));
}

function hero(card) {
  return h('div', { class: 'hero' },
    h('i', { class: 'shape s1', 'aria-hidden': 'true' }), h('i', { class: 'shape s2', 'aria-hidden': 'true' }),
    h('i', { class: 'shape s3', 'aria-hidden': 'true' }), h('i', { class: 'shape s4', 'aria-hidden': 'true' }),
    mark(),
    h('p', { class: 'hero-title' }, h('b', null, 'All In One'), h('span', null, t('heroSub'))),
    card);
}

function emailField(id, value, label) {
  const i = h('input', { id, type: 'email', name: 'username', autocomplete: 'username', inputmode: 'email', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', placeholder: ' ' });
  i.value = value || '';
  return { input: i, node: h('div', { class: 'field float' }, h('div', { class: 'control' }, i, h('label', { for: id }, label))) };
}

function busy(btn, on, text) {
  btn.disabled = on;
  btn.replaceChildren(...(on ? [h('span', { class: 'spin', 'aria-hidden': 'true' }), text] : [text]));
}

register('login', (p) => {
  const { input: email, node: emailNode } = emailField('login-email', p.email || savedEmail(), t('email'));
  const out = h('div', { 'aria-live': 'polite' });
  if (p.error) out.append(errBox(p.error));
  const btn = h('button', { class: 'btn btn-primary btn-big', type: 'submit' }, t('sendMeLink'));
  const form = h('form', { novalidate: true }, emailNode, out, btn);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    out.replaceChildren();
    const e = email.value.trim();
    if (!e) { out.append(errBox(t('needEmail'))); email.focus(); return; }
    busy(btn, true, t('sending'));
    try {
      await app.auth.sendLink(e);
      store(EMAIL_KEY, e);
      // Mismo mensaje para cualquier correo: no revelamos si tiene permiso.
      const chk = s('svg', { class: 'bigcheck', viewBox: '0 0 76 76', 'aria-hidden': 'true' }, s('circle', { cx: 38, cy: 38, r: 36 }), s('path', { d: 'M22 39l11 11 21-23' }));
      out.append(h('div', { class: 'sent', role: 'status' }, chk, h('p', null, t('linkSent'))));
      announce(t('linkSent'));
      busy(btn, false, t('linkResend'));
    } catch (err) {
      out.append(errBox(sendError(err)));
      busy(btn, false, t('sendMeLink'));
    }
  });
  return hero(h('div', { class: 'hero-card' }, h('h1', null, t('loginTitle')), h('p', { class: 'lead' }, t('loginIntro')), form));
});

// El enlace se abrió en otro aparato: no sabemos el correo, hay que pedirlo.
register('confirm', (p) => {
  const { input: email, node: emailNode } = emailField('confirm-email', '', t('email'));
  const out = h('div', { 'aria-live': 'polite' });
  if (p.error) out.append(errBox(p.error));
  const btn = h('button', { class: 'btn btn-primary btn-big', type: 'submit' }, t('confirmBtn'));
  const form = h('form', { novalidate: true }, emailNode, out, btn);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const e = email.value.trim();
    if (!e) { out.replaceChildren(errBox(t('needEmail'))); return; }
    busy(btn, true, t('sending'));
    try { await hooks.completeLink(e); } catch { out.replaceChildren(errBox(t('linkBad'))); busy(btn, false, t('confirmBtn')); }
  });
  return hero(h('div', { class: 'hero-card' }, h('h1', null, t('confirmTitle')), h('p', { class: 'lead' }, t('confirmIntro')), form,
    h('a', { class: 'btn-link', href: location.pathname }, t('backToLogin'))));
});
