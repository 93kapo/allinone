// Acceso FALSO solo para pruebas locales (?mock=1 en localhost). Lo sirve test-admin/dev-server.js en
// /__mock/auth-mock.js; NO está dentro de admin/ y por lo tanto nunca se despliega.
// Contraseña de todos: prueba123. Usuarios: dueno@example.com, sinverificar@example.com, intruso@example.com
const USERS = { 'dueno@example.com': true, 'sinverificar@example.com': false, 'intruso@example.com': true };
const KEY = 'mock-user';

export async function createAuth() {
  let user = null;
  try { user = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { user = null; }
  const listeners = [];
  const view = () => (user ? { email: user.email, emailVerified: user.emailVerified } : null);
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(user)); } catch { /* nada */ } };
  const notify = () => listeners.forEach((f) => f(view()));
  window.__mockResets = [];
  window.__mockVerifications = 0;
  return {
    mock: true,
    onChange(cb) { listeners.push(cb); setTimeout(() => cb(view()), 0); },
    async signIn(email, password) {
      if (!(email in USERS) || password !== 'prueba123') { const e = new Error('x'); e.code = 'auth/invalid-credential'; throw e; }
      user = { email, emailVerified: USERS[email] };
      save(); notify();
      return view();
    },
    async sendReset(email) { window.__mockResets.push(email); },
    async sendVerification() { window.__mockVerifications++; },
    async refreshUser() {
      if (user && sessionStorage.getItem('mock-confirmed') === '1') { user.emailVerified = true; save(); }
      return view();
    },
    async signOut() { user = null; save(); sessionStorage.removeItem(KEY); },
    async getToken() {
      if (!user) return null;
      const r = await fetch(`/__dev/token?email=${encodeURIComponent(user.email)}&verified=${user.emailVerified ? 1 : 0}`);
      return (await r.json()).token;
    },
  };
}
