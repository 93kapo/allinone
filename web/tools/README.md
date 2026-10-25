# web/tools

Development helpers. They are NOT published (the Pages workflow copies only the site files) and need no dependencies (Node 18+).

## make-seed.js

    node web/tools/make-seed.js [outfile]

Reads `site-config.js` and `assets/js/gallery-data.js` inside `node:vm` and writes `web/assets/content-seed.json`
(default) with the CURRENT embedded content, in the schema that `assets/js/content.js` accepts and the API serves:

    {schemaVersion:1, version, updatedAt, updatedBy,
     settings:{email, social:{facebook,instagram,google,youtube,tiktok}, showLicensed, licenseNumber},
     gallery:[{id, type:'image'|'youtube'|'video', category, src, youtubeId, poster, w, h, caption:{es,en}, alt:{es,en}, hidden}],
     beforeAfter:[{id, before, after, alt:{es,en}, caption:{es,en}, hidden}],
     reviews:[{id, name, text:{es,en}, source, date:'YYYY-MM', hidden}]}

Notes:
- The current gallery video (`assets/gallery/allin1.mp4`) is stored as `type: "video"`. That type is LEGACY: it is not part of the
  editable v1 schema (image/youtube only). The admin panel v1 must preserve `video` items as read-only (keep them, show them, do not edit or drop them).
  The public site renders them (poster in the grid, `<video>` in the lightbox).
- Image/video paths are relative to the site root (`assets/gallery/...`), `media/<key>` keys (resolved against `MEDIA_ORIGIN`),
  or absolute `https://` URLs from `MEDIA_ORIGIN` only.
- Social links are empty in the seed (same as `site-config.js`).
- Phone and WhatsApp are NOT editable in this phase; they stay in the HTML / `site-config.js`.

## Tests

    node --test web/tests/
