#!/usr/bin/env node
/* Builds assets/content-seed.json from the CURRENT embedded site data (site-config.js + gallery-data.js).
   No dependencies: runs the browser files inside node:vm.   Usage: node web/tools/make-seed.js [outfile] */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var web = path.join(__dirname, '..');
var out = process.argv[2] || path.join(web, 'assets', 'content-seed.json');

var ctx = { window: {} };
ctx.window = ctx; vm.createContext(ctx);
['site-config.js', 'assets/js/gallery-data.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(web, f), 'utf8'), ctx, { filename: f, timeout: 2000 });
});
var cfg = ctx.SITE_CONFIG || {};
function copy(o) { return JSON.parse(JSON.stringify(o)); }

var seed = {
  schemaVersion: 1,
  version: 'seed-1',
  updatedAt: new Date().toISOString(),
  updatedBy: 'make-seed',
  settings: {
    email: cfg.email || '',
    social: { facebook: '', instagram: '', google: '', youtube: '', tiktok: '' },
    showLicensed: cfg.showLicensed === true,
    licenseNumber: cfg.licenseNumber || ''
  },
  gallery: (ctx.GALLERY_ITEMS || []).map(function (it, i) {
    var o = { id: 'g' + (i + 1), type: it.type, category: it.category || '', src: it.src || '' };
    if (it.poster) o.poster = it.poster;
    o.caption = copy(it.caption || { es: '', en: '' });
    o.alt = copy(it.alt || { es: '', en: '' });
    o.hidden = false;
    return o;
  }),
  beforeAfter: (ctx.BEFORE_AFTER || []).map(function (it, i) {
    return { id: 'b' + (i + 1), before: it.before, after: it.after, alt: copy(it.alt || { es: '', en: '' }), caption: copy(it.caption || { es: '', en: '' }), hidden: false };
  }),
  reviews: (cfg.reviews || []).map(function (r, i) {
    return { id: 'r' + (i + 1), name: r.name, text: copy(r.text || { es: '', en: '' }), source: '', date: '', hidden: false };
  })
};
['facebook', 'instagram', 'google', 'youtube', 'tiktok'].forEach(function (k) { seed.settings.social[k] = (cfg.social && cfg.social[k]) || ''; });

fs.writeFileSync(out, JSON.stringify(seed, null, 2) + '\n');
console.log('wrote ' + out + ': ' + seed.gallery.length + ' gallery, ' + seed.beforeAfter.length + ' before/after, ' + seed.reviews.length + ' reviews');
