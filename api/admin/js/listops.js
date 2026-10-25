// Operaciones puras sobre listas de elementos con `id`. Siempre devuelven una lista NUEVA.
const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function makeId(existing, rand = Math.random) {
  const used = existing instanceof Set ? existing : new Set(existing);
  for (;;) {
    let id = 'n';
    for (let i = 0; i < 10; i++) id += ALPHA[Math.floor(rand() * ALPHA.length)];
    if (!used.has(id)) return id;
  }
}

export const ids = (list) => list.map((x) => x.id);

export function addItem(list, item, { atStart = false } = {}) {
  if (list.some((x) => x.id === item.id)) throw new Error('id repetido');
  return atStart ? [item, ...list] : [...list, item];
}

function swap(list, id, delta) {
  const i = list.findIndex((x) => x.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return list.slice();
  const out = list.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
export const moveUp = (list, id) => swap(list, id, -1);
export const moveDown = (list, id) => swap(list, id, 1);

export const removeItem = (list, id) => list.filter((x) => x.id !== id);
export const updateItem = (list, id, patch) => list.map((x) => (x.id === id ? { ...x, ...patch } : x));
export const toggleHidden = (list, id) => list.map((x) => (x.id === id ? { ...x, hidden: !x.hidden } : x));

// Cambia el título. Si la descripción (alt) era una copia automática del título, se limpia
// para que el servidor la vuelva a generar con el título nuevo.
export function setCaption(item, lang, value) {
  const caption = { es: '', en: '', ...(item.caption || {}) };
  const alt = { es: '', en: '', ...(item.alt || {}) };
  if (lang === 'es' && alt.es === caption.es) alt.es = '';
  if (lang === 'en' && (alt.en === caption.en || alt.en === caption.es)) alt.en = '';
  if (lang === 'es' && alt.en === caption.es) alt.en = '';
  caption[lang] = value;
  return { ...item, caption, alt };
}
