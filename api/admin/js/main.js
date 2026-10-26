// Arranque del panel. El modo de prueba (?mock=1) solo existe en localhost: en producción
// isMockAllowed() es siempre false y el módulo falso nunca se descarga.
import { h, $ } from './dom.js';
import { anim, reduced } from './fx.js';
import { t } from './i18n.js';
import { isMockAllowed } from './lib/mockgate.js';
import { MEDIA_BASE } from './config.js';
import { app, go, render, updateBar, announce } from './app.js';
import { S, setBase, normalize, loadDraft, clearDraft, saveNow, saveDraft, notify } from './store.js';
import { createApi } from './api.js';
import { apiErrorMessage } from './lib/errors.js';
import { hooks, savedEmail, forgetEmail } from './screens-auth.js';
import './screens-gallery.js';
import './screens-ba.js';
import './screens-forms.js';
import { startPublish } from './screens-publish.js';

const mock = isMockAllowed(location);

// Efecto de toque (ripple) en los botones: solo transform/opacity y se omite con "reducir movimiento".
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest && e.target.closest('.btn, .tile');
  if (!b || b.disabled || reduced()) return;
  const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 1.2;
  const dot = h('span', { class: 'ripple', 'aria-hidden': 'true' });
  dot.style.width = dot.style.height = `${d}px`;
  dot.style.left = `${e.clientX - r.left - d / 2}px`; dot.style.top = `${e.clientY - r.top - d / 2}px`;
  b.append(dot);
  const a = anim(dot, [{ transform: 'scale(0)', opacity: .22 }, { transform: 'scale(1)', opacity: 0 }], { duration: 520 });
  if (a) a.onfinish = () => dot.remove(); else dot.remove();
}, { passive: true });
app.mediaBase = mock ? '/__media' : MEDIA_BASE;

async function loadAll() {
  go('loading');
  let content = null, first = false;
  try {
    content = await app.api.getContent();
    if (!content) {
      first = true;
      const r = await fetch('seed.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('seed');
      content = await r.json();
    }
  } catch (e) {
    go('fatal', { text: apiErrorMessage(e && e.status !== undefined ? e : { network: true }, 'load'), retry: loadAll });
    return;
  }
  const version = first ? 'none' : content.version;
  S.baseVersion = version;
  const draft = await loadDraft();
  if (draft && JSON.stringify(normalize(draft.state)) !== JSON.stringify(normalize(content))) {
    go('draft', { content, first, draft, version });
    return;
  }
  if (draft) await clearDraft();
  setBase(content, { first });
  go('home');
}
app.reload = loadAll;

let entered = '';
let linkPending = false;
let loginError = '';

hooks.completeLink = async (email) => {
  const user = await app.auth.completeLink(email);
  forgetEmail(); linkPending = false;
  history.replaceState({}, '', location.pathname); // el enlace no debe quedarse en la barra
  await hooks.enter(user);
};
hooks.enter = async (user) => {
  if (!user) { go('login'); return; }
  $('#signout').hidden = false;
  if (entered === user.email) return;
  entered = user.email; S.email = user.email;
  $('#signout').hidden = false;
  await loadAll();
};

async function boot() {
  let auth;
  try {
    auth = await (isMockAllowed(location) ? import('/__mock/auth-mock.js') : import('./auth-real.js')).then((m) => m.createAuth());
  } catch {
    go('fatal', { text: t('sdkError'), retry: () => location.reload() });
    return;
  }
  app.auth = auth;
  app.api = createApi(auth);
  if (mock) document.body.prepend(h('p', { class: 'banner' }, t('testMode')));
  $('#signout').addEventListener('click', async () => {
    await saveNow();
    try { await auth.signOut(); } catch { /* nada */ }
    entered = ''; S.state = null; S.email = ''; $('#signout').hidden = true;
    go('login');
  });
  $('#bar-publish').addEventListener('click', startPublish);
  S.listeners.add(updateBar);
  addEventListener('pagehide', () => { saveNow(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
  if (auth.isLink()) {
    linkPending = true;
    const em = savedEmail();
    if (em) { try { await hooks.completeLink(em); } catch { linkPending = false; loginError = t('linkBad'); history.replaceState({}, '', location.pathname); } } else go('confirm', {});
  }
  auth.onChange((user) => {
    if (!user) { if (linkPending) return;
      entered = ''; S.state = null; $('#signout').hidden = true; go('login', { error: loginError }); loginError = ''; return; }
    hooks.enter(user);
  });
}
go('loading');
boot();
