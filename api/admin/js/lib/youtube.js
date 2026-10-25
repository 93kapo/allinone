// Extrae el código de 11 caracteres de un enlace de YouTube. Devuelve null si no es válido.
export const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'youtube-nocookie.com']);

export function parseYouTubeId(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  if (!s || s.length > 300 || /\s/.test(s)) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  const parts = u.pathname.split('/').filter(Boolean);
  let id = null;
  if (host === 'youtu.be') id = parts[0];
  else if (HOSTS.has(host)) {
    if (parts[0] === 'watch') id = u.searchParams.get('v');
    else if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) id = parts[1];
  }
  return id && YT_ID_RE.test(id) ? id : null;
}

export const youtubeThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
