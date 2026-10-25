// Convierte errores de la API y de Firebase en mensajes sencillos en español.
import { t } from '../i18n.js';

// ctx: 'publish' | 'restore' | 'upload' | 'load' | 'other'
export function apiErrorMessage({ status = 0, body = null, network = false } = {}, ctx = 'other') {
  if (network || !status) return ctx === 'upload' ? t('errUploadPhoto') : ctx === 'video' ? t('errUploadVideo') : t('errNetwork');
  if (ctx === 'video') {
    if (status === 413) return t('videoBig');
    if (status === 415) return t('err415Video');
    if (status === 411) return t('errUploadVideo');
    if (status === 429 && /llegaste al l[ií]mite/i.test(body && typeof body.error === 'string' ? body.error : '')) return t('err429Video');
  }
  const text = body && typeof body.error === 'string' ? body.error : '';
  switch (status) {
    case 401: return t('err401');
    case 403: return t('err403');
    case 404: return ctx === 'restore' ? t('err404Restore') : t('errGeneric');
    case 409: return ctx === 'restore' ? t('err409Restore') : t('err409Publish');
    case 413: return t('err413');
    case 415: return t('err415');
    case 422: return t('err422');
    case 428: return t('err428');
    case 429: return /llegaste al l[ií]mite/i.test(text) ? t('err429Quota') : t('err429Rate');
    case 503: return t('err503');
    case 507: return t('err507');
    default: return status >= 500 ? t('err5xx') : t('errGeneric');
  }
}
