# allin1-api — Worker de la API del panel de contenido

Cloudflare Worker `allin1-api`. Sirve en un solo origen (`admin.allin1jax.com`):

- el panel estático (carpeta `admin/`, como *assets* del Worker), y
- la API en `/api/*` (el Worker corre primero solo para `/api/*`, `assets.run_worker_first`).

El sitio público (GitHub Pages, `allin1jax.com`) lee el contenido con `GET /api/content`.
Este repo es **público**: aquí no hay secretos ni correos de personas.

## Arquitectura

```
Navegador (panel) --Bearer ID token de Firebase--> Worker allin1-api --> R2 (bucket allin1-media)
Sitio público ------GET /api/content (CORS)------> Worker allin1-api --> R2
Imágenes: media.allin1jax.com (dominio personalizado del bucket R2, solo lectura pública)
```

- `src/index.js` — router, límite de peticiones en memoria, cabeceras de seguridad en todas las respuestas.
- `src/auth.js` — verifica el ID token de Firebase con `jose` (RS256, JWKS de Google, `iss`/`aud` = `allin1-d68ac`, 60 s de tolerancia, `sub` obligatorio, `email_verified === true`, correo en `ALLOWED_EMAILS`). Si no se pueden obtener las claves responde **503** (falla cerrada). El token va solo en `Authorization: Bearer`; no hay cookies.
- `src/schema.js` — validador puro y estricto del contenido (claves desconocidas, `__proto__`, `<`/`>`, URLs de redes sociales por lista de dominios, límites de tamaño y cantidad).
- `src/handlers.js` — los endpoints. `src/history.js` — versiones, resumen de cambios, poda a 50. `src/quotas.js` — cuotas por usuario y día. `src/media.js` — firma de imagen, manifiesto de medios, huérfanos (función pura para v2). `src/r2.js` — claves y actualización atómica (`onlyIf` de R2). `src/ratelimit.js`, `src/http.js`.
- `admin/_headers` — mismas cabeceras de seguridad para los archivos estáticos del panel (esos no pasan por el Worker).

Todo lo guardado vive en R2: `content/current.json`, `content/v-<version>.json`, `content/media-manifest.json`, `content/quota/<hash-correo>/<AAAA-MM-DD>.json` y `media/<uuid>.<ext>`.

## Endpoints

| Método y ruta | Auth | Qué hace |
|---|---|---|
| `GET /api/content` | no | Contenido actual. `404 {"empty":true}` si aún no hay. `ETag` = `version`; `304` con `If-None-Match`; `Cache-Control: public, max-age=30, stale-while-revalidate=300`. CORS solo para `https://allin1jax.com` y `https://www.allin1jax.com` (con `Vary: Origin`). |
| `PUT /api/content` | sí | Guarda una versión nueva. Cabecera `If-Match: <version actual>` (o `none` si no existe). `409` "Alguien cambió el sitio hace un momento, recarga" si no coincide; `428` si falta; `422` con `errores:[{campo,mensaje}]`. El servidor fija `schemaVersion`, `version`, `updatedAt`, `updatedBy` y genera ids faltantes. |
| `GET /api/history` | sí | Hasta 50 versiones, más recientes primero: `version`, `updatedAt`, `updatedBy`, `resumen` (añadidos/quitados/modificados por sección), `actual`, `restauradaDe`. |
| `POST /api/restore` `{"version":"..."}` | sí | Crea una NUEVA versión copiando esa. Para deshacer, se restaura la versión anterior. |
| `POST /api/upload` | sí | Cuerpo binario crudo + `X-Kind: photo` (máx 8 MB) o `thumb` (máx 1 MB). Solo JPEG/PNG/WebP, detectado por la firma del archivo (el `Content-Type` del cliente se ignora). Devuelve `{key,size,contentType,kind}`. |
| `GET /api/me` | sí | Correo y cuotas restantes del día. |

No existe endpoint para borrar medios. La limpieza de huérfanos (nunca usados, más de 30 días) es la función pura `findOrphans` de `src/media.js`, solo para v2; lo marcado `used:true` nunca se considera huérfano (protege lo que está en el historial).

Esquema del contenido: raíz `{schemaVersion:1, version, updatedAt, updatedBy, settings, gallery, beforeAfter, reviews}`; límites: 256 KB, 300 elementos en galería, 30 en antes/después, 30 reseñas. Fotos: clave `media/<uuid>.<ext>` que exista en el manifiesto, o ruta `assets/gallery/<nombre>.(jpg|jpeg|png|webp)` del sitio. No hay teléfono ni WhatsApp editables en v1. Los errores salen en español, por campo (por ejemplo `gallery[2].caption.es`).

Variables (todas opcionales salvo las dos primeras): `FIREBASE_PROJECT_ID` (en `wrangler.jsonc`), `ALLOWED_EMAILS` (**secret**), `MAX_BUCKET_MB` (4000), `QUOTA_FILES_PER_DAY` (40), `QUOTA_MB_PER_DAY` (80), `ADMIN_DISABLED` (`"1"` = interruptor de emergencia: todo lo autenticado responde 503).

## Cómo correr las pruebas

```
cd api
npm install
npm test            # node:test, sin red: R2 simulado, claves RSA de WebCrypto y JWKS simulado
npm run check       # wrangler deploy --dry-run: valida configuración y empaquetado (no despliega)
```

## PASOS HUMANOS (nada de esto se hizo desde el código)

1. **Cloudflare**: crear el bucket R2 `allin1-media` (`npx wrangler r2 bucket create allin1-media`). Activar el **dominio personalizado `media.allin1jax.com`** en ese bucket (solo lectura pública). No activar `r2.dev`.
2. **Secret**: `npx wrangler secret put ALLOWED_EMAILS` y pegar los correos separados por comas (por ejemplo `a@x.com,b@y.com`). Nunca en el repo.
3. **Desplegar** (lo hace una persona, `npx wrangler deploy`) y luego añadir el dominio **`admin.allin1jax.com`** al Worker (Workers > allin1-api > Settings > Domains, o descomentar `routes` en `wrangler.jsonc`).
4. **Firebase** (proyecto `allin1-d68ac`): Authentication > Settings > Authorized domains > añadir `admin.allin1jax.com`. Dejar activo solo correo y contraseña.
5. **Usuarios**: crear en Firebase Authentication un usuario por persona (correo + contraseña propia, y verificar el correo: el Worker exige `email_verified`). Cada correo también debe estar en `ALLOWED_EMAILS`.
6. **WAF de Cloudflare — regla de rate limiting real** (por ejemplo `/api/*`: 60 peticiones por minuto por IP y `/api/upload`: 10 por minuto por IP). El limitador del Worker es solo en memoria de cada *isolate*: defensa mínima, no sustituye al WAF.
7. **Facturación**: R2 y Workers tienen capa gratuita, pero pueden cobrar al pasarse. Poner alertas de facturación y de uso en Cloudflare. El tope `MAX_BUCKET_MB` cuenta solo los archivos de `media/` registrados en el manifiesto (no las versiones JSON, que son pequeñas).
8. Cuando el panel real esté listo, reemplazar `admin/index.html` (marcador) y mantener `admin/_headers`. El CSP no permite estilos ni scripts en línea: usar archivos `.css` y `.js` propios.

## Qué NO está probado

- **Cloudflare real**: no se desplegó nada ni se corrió `wrangler dev`; solo `wrangler deploy --dry-run` (configuración y empaquetado válidos).
- **R2 real**: las pruebas usan un R2 simulado. Se comprobó contra el R2 local de miniflare (vía `getPlatformProxy`, simulador de Cloudflare) que `put` con `onlyIf` (`etagMatches` / `etagDoesNotMatch:"*"`) devuelve `null` al fallar la condición y escribe cuando se cumple, y que `list({include:['customMetadata']})` devuelve los metadatos. Aun así no es el R2 real: comprobarlo en el primer despliegue.
- **JWKS real de Google**: probado con un JWKS simulado y con `fetch` simulado hacia el resolvedor remoto de `jose`; no contra `googleapis.com`.
- **Tokens reales de Firebase** (incluido que traigan `email_verified`).
- **Límites del plan gratuito** (CPU, tamaño de petición, operaciones de R2) y el comportamiento de `_headers` en los assets desplegados.
- Concurrencia: probada con el R2 simulado (condición atómica); en R2 real depende de su semántica de precondiciones.
- Las cuotas por día usan fecha UTC. Los objetos de cuota viejos no se limpian (uno pequeño por usuario y día).
