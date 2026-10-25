// El modo de prueba (?mock=1) SOLO se puede activar en localhost. En producción siempre es false.
export function isMockAllowed(loc) {
  if (!loc || typeof loc.hostname !== 'string') return false;
  if (loc.hostname !== 'localhost') return false;
  return new URLSearchParams(loc.search || '').get('mock') === '1';
}
