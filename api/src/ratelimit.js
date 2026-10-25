// Limitador básico EN MEMORIA del isolate. Defensa mínima: cada isolate cuenta por separado
// y se reinicia al reciclarse. La regla real va en el WAF de Cloudflare (ver README).

export function createLimiter(now = () => Date.now()) {
  const map = new Map();
  function prune(t) {
    if (map.size < 5000) return;
    for (const [k, v] of map) if (t - v.start > v.win) map.delete(k);
  }
  return {
    // Cuenta un intento. true = permitido.
    hit(key, limit, win = 60_000) {
      const t = now();
      prune(t);
      let e = map.get(key);
      if (!e || t - e.start > win) { e = { start: t, count: 0, win }; map.set(key, e); }
      e.count++;
      return e.count <= limit;
    },
    // Consulta sin contar. true = ya se pasó del límite.
    over(key, limit, win = 60_000) {
      const e = map.get(key);
      return !!e && now() - e.start <= win && e.count >= limit;
    },
  };
}
