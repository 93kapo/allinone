// Acceso real con Firebase Auth (correo y contraseña). El SDK se carga solo aquí, con versión fija.
// initializeAuth (sin resolvedor de ventanas emergentes) evita cargar iframes/scripts que el CSP bloquea.
import { firebaseConfig } from './firebase-config.js';

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
    async signIn(email, password) { const r = await authMod.signInWithEmailAndPassword(auth, email, password); return view(r.user); },
    sendReset(email) { return authMod.sendPasswordResetEmail(auth, email); },
    async sendVerification() { if (auth.currentUser) await authMod.sendEmailVerification(auth.currentUser); },
    async refreshUser() { if (!auth.currentUser) return null; await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); return view(auth.currentUser); },
    signOut() { return authMod.signOut(auth); },
    async getToken(force = false) { return auth.currentUser ? auth.currentUser.getIdToken(force) : null; },
  };
}
