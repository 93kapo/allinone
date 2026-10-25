// De dónde sale cada imagen en el panel.
// media/<uuid>.jpg  -> <mediaBase>/media/<uuid>.jpg   (dominio de medios)
// assets/gallery/x  -> <siteBase>/assets/gallery/x     (sitio público) o null si siteBase está vacío
export function mediaUrl(ref, { mediaBase, siteBase }) {
  if (typeof ref !== 'string' || !ref) return null;
  if (ref.startsWith('media/') && !ref.includes('..')) return `${mediaBase}/${ref}`;
  if (ref.startsWith('assets/') && !ref.includes('..')) return siteBase ? `${siteBase}/${ref}` : null;
  return null;
}
