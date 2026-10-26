// Qué cambió entre la lista cargada y la lista de trabajo (por id).
import { t } from '../i18n.js';

export function diffLists(base, next) {
  const a = new Map(base.map((x) => [x.id, JSON.stringify(x)]));
  const b = new Map(next.map((x) => [x.id, JSON.stringify(x)]));
  let added = 0, removed = 0, modified = 0;
  for (const [id, v] of b) { if (!a.has(id)) added++; else if (a.get(id) !== v) modified++; }
  for (const id of a.keys()) if (!b.has(id)) removed++;
  const common = (m, o) => [...m.keys()].filter((id) => o.has(id)).join();
  const moved = common(a, b) !== common(b, a);
  return { added, removed, modified, moved };
}

export function describeDiff(d) {
  const out = [];
  if (d.added) out.push(t('chAdded', { n: d.added }));
  if (d.removed) out.push(t('chRemoved', { n: d.removed }));
  if (d.modified) out.push(t('chModified', { n: d.modified }));
  if (d.moved) out.push(t('chMoved'));
  return out.join(', ');
}

export const hasChange = (d) => !!(d.added || d.removed || d.modified || d.moved);

// Cuántos cambios hay sin publicar (para el contador de la barra).
export function countChanges(base, next) {
  if (!base || !next) return 0;
  let n = 0;
  for (const k of ['gallery', 'beforeAfter', 'reviews']) {
    const d = diffLists(base[k], next[k]);
    n += d.added + d.removed + d.modified + (d.moved ? 1 : 0);
  }
  if (JSON.stringify(base.settings) !== JSON.stringify(next.settings)) n += 1;
  return n;
}
