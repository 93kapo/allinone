// Acceso sin contraseña: la persona escribe su correo y toca el enlace que le llega.
import { h } from './dom.js';
import { t } from './i18n.js';
import { app, register, announce } from './app.js';

export const EMAIL_KEY = 'emailParaEnlace';
export const hooks = { enter: async () => {}, completeLink: async () => {} };

const errBox = (text) => h('p', { class: 'msg msg-error', role: 'alert' }, text);
const okBox = (text) => h('p', { class: 'msg msg-ok', role: 'status' }, text);
const store = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
export const savedEmail = () => { try { return localStorage.getItem(EMAIL_KEY) || ''; } catch { return ''; } };
export const forgetEmail = () => store(EMAIL_KEY, null);

function sendError(err) {
  const c = err && err.code;
  if (c === 'auth/network-request-failed') return t('loginNetwork');
  if (c === 'auth/too-many-requests') return t('loginTooMany');
  if (c === 'auth/invalid-email') return t('badEmail');
  return t('loginGeneric');
}

const emailInput = (id, value) => {
  const i = h('input', { id, type: 'email', name: 'username', autocomplete: 'username', inputmode: 'email', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false' });
  i.value = value || '';
  return i;
};

register('login', (p) => {
  const email = emailInput('login-email', p.email || savedEmail());
  const out = h('div');
  if (p.error) out.append(errBox(p.error));
  const btn = h('button', { class: 'btn btn-primary btn-big', type: 'submit' }, t('sendMeLink'));
  const form = h('form', { novalidate: true }, h('div', { class: 'field' }, h('label', { for: 'login-email' }, t('email')), email), out, btn);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    out.replaceChildren();
    const e = email.value.trim();
    if (!e) { out.append(errBox(t('needEmail'))); return; }
    btn.disabled = true; btn.textContent = t('sending');
    try {
      await app.auth.sendLink(e);
      store(EMAIL_KEY, e);
      // Mismo mensaje para cualquier correo: no revelamos si tiene permiso.
      out.append(okBox(t('linkSent')));
      announce(t('linkSent'));
      btn.textContent = t('linkResend');
    } catch (err) {
      out.append(errBox(sendError(err)));
      btn.textContent = t('sendMeLink');
    }
    btn.disabled = false;
  });
  return h('div', null, h('h1', null, t('loginTitle')), h('p', null, t('loginIntro')), form);
});

// El enlace se abrió en otro aparato: no sabemos el correo, hay que pedirlo.
register('confirm', (p) => {
  const email = emailInput('confirm-email', '');
  const out = h('div');
  if (p.error) out.append(errBox(p.error));
  const btn = h('button', { class: 'btn btn-primary btn-big', type: 'submit' }, t('confirmBtn'));
  const form = h('form', { novalidate: true }, h('div', { class: 'field' }, h('label', { for: 'confirm-email' }, t('email')), email), out, btn);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const e = email.value.trim();
    if (!e) { out.replaceChildren(errBox(t('needEmail'))); return; }
    btn.disabled = true; btn.textContent = t('sending');
    try { await hooks.completeLink(e); } catch { out.replaceChildren(errBox(t('linkBad'))); btn.disabled = false; btn.textContent = t('confirmBtn'); }
  });
  return h('div', null, h('h1', null, t('confirmTitle')), h('p', null, t('confirmIntro')), form,
    h('a', { class: 'btn-link', href: location.pathname }, t('backToLogin')));
});
