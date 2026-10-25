// Acceso real con Firebase Auth (correo y contraseña). El SDK se carga solo aquí, con versión fija.
// initializeAuth (sin resolvedor de ventanas emergentes) evita cargar iframes/scripts que el CSP bloquea.
import { firebaseConfig } from './firebase-config.js';

// En producción el enlace apunta a https://admin.allin1jax.com/ (en pruebas locales, a localhost).
const linkUrl = () => (location.hostname === 'localhost' ? `${location.origin}/` : 'https://admin.allin1jax.com/');

export async function createAuth() {
  const [appMod, authMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
  ]);
  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.initializeAuth(app, { persistence: [authMod.indexedDBLocalPersistence, authMod.browserLocalPersistence] });
  auth.languageCode = 'es';
  const view = (u) => (u ? { email: u.email || '', emailVerified: u.emailVerified === true } : null);
  return {
    mock: false,
    onChange(cb) { authMod.onAuthStateChanged(auth, (u) => cb(view(u))); },
    // Enlace por correo (sin contraseña). El enlace vuelve a esta misma página.
    sendLink(email) { return authMod.sendSignInLinkToEmail(auth, email, { url: linkUrl(), handleCodeInApp: true }); },
    isLink() { return authMod.isSignInWithEmailLink(auth, location.href); },
    async completeLink(email) { const r = await authMod.signInWithEmailLink(auth, email, location.href); return view(r.user); },
    signOut() { return authMod.signOut(auth); },
    async getToken(force = false) { return auth.currentUser ? auth.currentUser.getIdToken(force) : null; },
  };
}
