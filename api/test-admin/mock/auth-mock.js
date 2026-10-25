// Acceso FALSO solo para pruebas locales (?mock=1 en localhost). Lo sirve test-admin/dev-server.js en
// /__mock/auth-mock.js; NO está dentro de admin/ y por lo tanto nunca se despliega.
// "Enlace por correo" simulado: sendLink() guarda el correo en window.__mockLinks; el enlace de prueba es
//   /?mock=1&mockLink=<correo>   (lo abre la prueba). Usuarios: dueno@example.com (con permiso), intruso@example.com (sin permiso).
const KEY = 'mock-user';

export async function createAuth() {
  let user = null;
  try { user = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { user = null; }
  const listeners = [];
  const params = new URLSearchParams(location.search);
  const view = () => (user ? { email: user.email, emailVerified: true } : null);
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(user)); } catch { /* nada */ } };
  window.__mockLinks = [];
  return {
    mock: true,
    onChange(cb) { listeners.push(cb); setTimeout(() => cb(view()), 0); },
    async sendLink(email) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { const e = new Error('x'); e.code = 'auth/invalid-email'; throw e; }
      window.__mockLinks.push(email);
    },
    isLink() { return params.has('mockLink'); },
    async completeLink(email) {
      if (email.toLowerCase() !== (params.get('mockLink') || '').toLowerCase()) { const e = new Error('x'); e.code = 'auth/invalid-email'; throw e; }
      user = { email }; save();
      listeners.forEach((f) => f(view()));
      return view();
    },
    async signOut() { user = null; try { sessionStorage.removeItem(KEY); } catch { /* nada */ } },
    async getToken() {
      if (!user) return null;
      const r = await fetch(`/__dev/token?email=${encodeURIComponent(user.email)}&verified=1`);
      return (await r.json()).token;
    },
  };
}
