// Pantallas de acceso: Entrar, olvidé / crear contraseña, confirmar correo.
import { h } from './dom.js';
import { t } from './i18n.js';
import { app, register, go, announce } from './app.js';
import { authErrorMessage } from './lib/errors.js';

export const hooks = { enter: async () => {} }; // main.js lo reemplaza: entrar al panel con un usuario verificado

function errBox(text) { return h('p', { class: 'msg msg-error', role: 'alert' }, text); }

register('login', (p) => {
  const box = h('div');
  const email = h('input', { id: 'login-email', type: 'email', name: 'username', autocomplete: 'username', inputmode: 'email', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', required: true });
  const pw = h('input', { id: 'login-pw', type: 'password', name: 'password', autocomplete: 'current-password', required: true });
  if (p.email) email.value = p.email;
  const show = h('button', { class: 'btn btn-secondary btn-small', type: 'button', 'aria-pressed': 'false', onclick: () => {
    const on = pw.type === 'password';
    pw.type = on ? 'text' : 'password';
    show.setAttribute('aria-pressed', on ? 'true' : 'false');
    show.textContent = on ? t('hidePassword') : t('showPassword');
  } }, t('showPassword'));
  const out = h('div');
  const btn = h('button', { class: 'btn btn-primary btn-big', type: 'submit' }, t('enter'));
  const form = h('form', { novalidate: true, autocomplete: 'on' },
    h('div', { class: 'field' }, h('label', { for: 'login-email' }, t('email')), email),
    h('div', { class: 'field' }, h('label', { for: 'login-pw' }, t('password')), h('div', { class: 'pw' }, pw, show)),
    out, btn);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    out.replaceChildren();
    const e = email.value.trim();
    if (!e || !pw.value) { out.append(errBox(t('loginNeedBoth'))); return; }
    btn.disabled = true; btn.textContent = t('entering');
    try {
      const user = await app.auth.signIn(e, pw.value);
      pw.value = '';
      if (user && !user.emailVerified) { try { await app.auth.sendVerification(); } catch { /* se puede reenviar luego */ } }
      await hooks.enter(user);
    } catch (err) {
      out.append(errBox(authErrorMessage(err && err.code)));
      announce(authErrorMessage(err && err.code));
      btn.disabled = false; btn.textContent = t('enter');
    }
  });
  box.append(
    h('h1', null, t('loginTitle')), h('p', null, t('loginIntro')), form,
    h('div', { class: 'stack' },
      h('button', { class: 'btn-link', type: 'button', onclick: () => go('reset', { mode: 'forgot', email: email.value.trim() }) }, t('forgot')),
      h('button', { class: 'btn-link', type: 'button', onclick: () => go('reset', { mode: 'create', email: email.value.trim() }) }, t('createPassword'))));
  return box;
});

register('reset', (p) => {
  const create = p.mode === 'create';
  const email = h('input', { id: 'reset-email', type: 'email', name: 'username', autocomplete: 'username', inputmode: 'email', autocapitalize: 'none', spellcheck: 'false' });
  email.value = p.email || '';
  const out = h('div');
  const btn = h('button', { class: 'btn btn-primary btn-big', type: 'submit' }, t('sendLink'));
  const form = h('form', { novalidate: true }, h('div', { class: 'field' }, h('label', { for: 'reset-email' }, t('email')), email), out, btn);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    out.replaceChildren();
    const e = email.value.trim();
    if (!e) { out.append(errBox(t('needEmail'))); return; }
    btn.disabled = true; btn.textContent = t('sending');
    try { await app.auth.sendReset(e); } catch (err) {
      // Siempre el mismo mensaje: no revelamos si el correo existe (solo avisamos si no hay internet).
      if (err && err.code === 'auth/network-request-failed') { out.append(errBox(t('loginNetwork'))); btn.disabled = false; btn.textContent = t('sendLink'); return; }
    }
    out.append(h('p', { class: 'msg msg-ok', role: 'status' }, t('resetDone')));
    btn.textContent = t('sendLink'); btn.disabled = false;
    announce(t('resetDone'));
  });
  return h('div', null,
    h('h1', null, create ? t('createTitle') : t('resetTitle')),
    h('p', null, create ? t('createIntro') : t('resetIntro')), form,
    h('button', { class: 'btn-link', type: 'button', onclick: () => go('login', { email: email.value.trim() }) }, t('backToLogin')));
});

register('verify', (p) => {
  const out = h('div');
  const again = h('button', { class: 'btn btn-secondary btn-big', type: 'button', onclick: async () => {
    out.replaceChildren();
    try { await app.auth.sendVerification(); out.append(h('p', { class: 'msg msg-ok', role: 'status' }, t('verifySent'))); } catch { out.append(errBox(t('errNetwork'))); }
  } }, t('verifyResend'));
  const retry = h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: async () => {
    out.replaceChildren();
    try {
      const u = await app.auth.refreshUser();
      if (u && u.emailVerified) { await hooks.enter(u); return; }
      out.append(h('p', { class: 'msg msg-warn', role: 'status' }, t('verifyStill')));
    } catch { out.append(errBox(t('errNetwork'))); }
  } }, t('verifyRetry'));
  return h('div', null, h('h1', null, t('verifyTitle')), h('p', { class: 'msg msg-warn' }, t('verifyBody')), out, h('div', { class: 'stack' }, retry, again));
});
