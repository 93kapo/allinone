// Reglas puras para subir videos desde el panel.
export const MAX_VIDEO_BYTES = 95 * 1024 * 1024; // igual que el Worker (el plan gratis limita el cuerpo a 100 MB)
export const POSTER_MAX = 1280;

export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 100 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
}

// null = bien; 'empty' | 'toobig' | 'notvideo'
export function videoProblem(file) {
  if (!file || !(file.size > 0)) return 'empty';
  if (file.size > MAX_VIDEO_BYTES) return 'toobig';
  const type = file.type || '';
  const name = file.name || '';
  if (type && !/^video\//i.test(type)) return 'notvideo';
  if (!type && !/\.(mp4|mov|m4v|webm)$/i.test(name)) return 'notvideo';
  return null;
}
