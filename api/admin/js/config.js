// Configuración pública del panel (nada secreto).
export const MEDIA_BASE = 'https://media.allin1jax.com'; // dominio de medios (solo lectura pública)
// Fotos que ya viven en el sitio (assets/gallery/...). El CSP del panel hoy NO permite imágenes de
// allin1jax.com; si se agrega https://allin1jax.com a img-src (admin/_headers y src/http.js), poner aquí 'https://allin1jax.com'.
export const SITE_IMG_BASE = '';
export const SITE_GALLERY_URL = 'https://allin1jax.com/#gallery';
export const FIREBASE_VERSION = '10.12.2';
