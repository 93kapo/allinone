'use strict';
var test = require('node:test'), assert = require('node:assert/strict');
var fs = require('fs'), path = require('path'), vm = require('vm');

/* Load content.js exactly like a browser would: no module, no URL, a bare global with window. */
var ctx = {}; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'content.js'), 'utf8'), ctx, { filename: 'content.js' });
var C = ctx.AIOContent;
/* Arrays from the vm realm are not reference-equal to ours: compare through JSON. */
var same = function (a, b, m) { assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m); };
var MEDIA = 'https://media.allin1jax.com';

function base(over) {
  var o = { schemaVersion: 1, version: 'v1', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'a', settings: {}, gallery: [], beforeAfter: [], reviews: [] };
  for (var k in over) o[k] = over[k];
  return o;
}
function img(id, extra) { var o = { id: id, type: 'image', category: 'interior', src: 'assets/gallery/' + id + '.webp' }; for (var k in extra) o[k] = extra[k]; return o; }

test('content.js exposes AIOContent on window', function () { assert.equal(typeof C.validateContent, 'function'); });

test('safeSocial accepts allowed https hosts per network', function () {
  assert.equal(C.safeSocial('facebook', 'https://www.facebook.com/allin1'), 'https://www.facebook.com/allin1');
  assert.equal(C.safeSocial('facebook', 'https://m.facebook.com/x'), 'https://m.facebook.com/x');
  assert.equal(C.safeSocial('instagram', 'https://instagram.com/allin1/'), 'https://instagram.com/allin1/');
  assert.equal(C.safeSocial('google', 'https://maps.app.goo.gl/abc123'), 'https://maps.app.goo.gl/abc123');
  assert.equal(C.safeSocial('google', 'https://g.page/allin1'), 'https://g.page/allin1');
  assert.equal(C.safeSocial('google', 'https://www.google.com/maps/place/x'), 'https://www.google.com/maps/place/x');
  assert.equal(C.safeSocial('youtube', 'https://youtu.be/abcdefghijk'), 'https://youtu.be/abcdefghijk');
  assert.equal(C.safeSocial('youtube', 'https://www.youtube.com/@allin1'), 'https://www.youtube.com/@allin1');
  assert.equal(C.safeSocial('tiktok', 'https://www.tiktok.com/@allin1'), 'https://www.tiktok.com/@allin1');
});

test('safeSocial rejects dangerous or wrong URLs', function () {
  var bad = [
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x',
    'http://www.facebook.com/x', '//facebook.com/x', 'facebook.com/x', 'https:facebook.com',
    'https://evil.com/facebook.com', 'https://facebook.com.evil.com/x', 'https://evilfacebook.com/x', 'https://sub.facebook.com/x',
    'https://facebook.com:8080/x', 'https://facebook.com:443/x',
    'https://user:pass@facebook.com/x', 'https://facebook.com@evil.com/x', 'https://evil.com@facebook.com/x',
    'https://facebook.com\\@evil.com', 'https://facebook.com/x y', 'https://facebook.com/a\nb', 'https://.facebook.com/x', 'https://facebook.com./x',
    'https://', '', '   '
  ];
  bad.forEach(function (u) { assert.equal(C.safeSocial('facebook', u), '', JSON.stringify(u)); });
  assert.equal(C.safeSocial('facebook', 'https://instagram.com/x'), '', 'host of another network');
  assert.equal(C.safeSocial('twitter', 'https://facebook.com/x'), '', 'unknown network');
  assert.equal(C.safeSocial('facebook', null), '');
  assert.equal(C.safeSocial('facebook', { a: 1 }), '');
  assert.equal(C.safeSocial('__proto__', 'https://facebook.com/x'), '');
});

test('safeSocial normalizes uppercase scheme and host (never keeps a bad scheme)', function () {
  assert.equal(C.safeSocial('facebook', 'HTTPS://WWW.FACEBOOK.COM/Page'), 'https://www.facebook.com/Page');
  assert.equal(C.safeSocial('facebook', ' https://facebook.com/x '), 'https://facebook.com/x');
  assert.equal(C.safeSocial('facebook', 'HTTP://FACEBOOK.COM/x'), '');
});

test('resolveSrc: relative paths get the base (root and /es/)', function () {
  assert.equal(C.resolveSrc('', 'assets/gallery/a.jpg', MEDIA), 'assets/gallery/a.jpg');
  assert.equal(C.resolveSrc('../', 'assets/gallery/a.jpg', MEDIA), '../assets/gallery/a.jpg');
  assert.equal(C.resolveSrc('../', 'assets/gallery/a.jpg'), '../assets/gallery/a.jpg');
});

test('resolveSrc: media/ keys resolve against mediaOrigin, never get the base', function () {
  assert.equal(C.resolveSrc('../', 'media/abc.webp', MEDIA), MEDIA + '/media/abc.webp');
  assert.equal(C.resolveSrc('../', 'media/abc.webp', MEDIA + '/'), MEDIA + '/media/abc.webp');
  assert.equal(C.resolveSrc('../', 'media/abc.webp', ''), '');
  assert.equal(C.resolveSrc('../', 'media/../secret', MEDIA), '');
});

test('resolveSrc: absolute https from mediaOrigin only; never "../https://"', function () {
  assert.equal(C.resolveSrc('../', MEDIA + '/media/a.webp', MEDIA), MEDIA + '/media/a.webp');
  assert.equal(C.resolveSrc('', MEDIA + '/x/a.webp', MEDIA), MEDIA + '/x/a.webp');
  assert.equal(C.resolveSrc('../', 'https://evil.com/a.webp', MEDIA), '');
  assert.equal(C.resolveSrc('../', 'https://media.allin1jax.com.evil.com/a.webp', MEDIA), '');
  assert.equal(C.resolveSrc('../', 'https://media.allin1jax.com@evil.com/a.webp', MEDIA), '');
  assert.equal(C.resolveSrc('../', 'http://media.allin1jax.com/a.webp', MEDIA), '');
  assert.equal(C.resolveSrc('../', MEDIA + '/a.webp', ''), '');
  assert.equal(C.resolveSrc('../', MEDIA + '/../a.webp', MEDIA), '');
});

test('resolveSrc rejects scheme-like and protocol-relative inputs', function () {
  ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:image/png;base64,AAAA', '//evil.com/a.jpg', '\\\\evil.com\\a.jpg', '/etc/passwd',
    '../secret.jpg', 'assets/../../x.jpg', 'a b.jpg', '', '   ', 'blob:https://x/y', 'file:///etc/passwd', 'assets//x.jpg', 'a.jpg?x=1', null, undefined, 42, {}
  ].forEach(function (s) { assert.equal(C.resolveSrc('../', s, MEDIA), '', JSON.stringify(s)); });
});

test('YouTube ids, thumbnail and embed', function () {
  assert.equal(C.youtubeThumb('dQw4w9WgXcQ'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(C.youtubeEmbed('dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0');
  ['', 'short', 'dQw4w9WgXcQ1', 'dQw4w9WgXc!', 'dQw4w9WgX/Q', '../../evil123', 'dQw4w9 WgXc', null, undefined, 12345678901, ['dQw4w9WgXcQ']].forEach(function (id) {
    assert.equal(C.youtubeThumb(id), '', JSON.stringify(id));
    assert.equal(C.youtubeEmbed(id), '', JSON.stringify(id));
  });
  assert.equal(C.youtubeEmbed('abc_DEF-123').indexOf('https://www.youtube-nocookie.com/embed/'), 0);
});

test('validateContent: rejects non-objects, wrong schemaVersion, missing version', function () {
  [null, undefined, 5, 'x', [], true].forEach(function (v) { assert.equal(C.validateContent(v), null); });
  assert.equal(C.validateContent(base({ schemaVersion: 2 })), null);
  assert.equal(C.validateContent(base({ schemaVersion: '1' })), null);
  assert.equal(C.validateContent(base({ version: '' })), null);
  assert.equal(C.validateContent(base({ version: {} })), null);
  assert.equal(C.validateContent(base({ version: 7 })).version, '7');
});

test('validateContent: unknown keys are ignored and not copied', function () {
  var c = C.validateContent(base({ evil: 1, __proto__: { x: 1 }, settings: { foo: 'bar', email: 'a@b.co' }, gallery: [img('g1', { onclick: 'x()', extra: 1 })] }));
  assert.ok(c);
  assert.equal(c.evil, undefined);
  assert.equal(c.settings.foo, undefined);
  assert.equal(c.settings.email, 'a@b.co');
  assert.equal(c.gallery[0].onclick, undefined);
  assert.equal(c.gallery[0].extra, undefined);
});

test('validateContent: wrong types never throw and fall back safely', function () {
  var c = C.validateContent(base({ settings: 'x', gallery: 'x', beforeAfter: 5, reviews: { a: 1 } }));
  same([c.gallery, c.beforeAfter, c.reviews], [[], [], []]);
  assert.equal(c.settings.email, '');
  assert.equal(c.settings.showLicensed, false);
  c = C.validateContent(base({ settings: { email: 42, showLicensed: 'true', licenseNumber: 5, social: { facebook: 7, instagram: ['x'] } } }));
  assert.equal(c.settings.email, ''); assert.equal(c.settings.showLicensed, false); assert.equal(c.settings.licenseNumber, ''); assert.equal(c.settings.social.facebook, '');
  c = C.validateContent(base({ settings: { email: 'not an email' } })); assert.equal(c.settings.email, '');
  c = C.validateContent(base({ settings: { email: 'a@b.co"><img' } })); assert.equal(c.settings.email, '');
});

test('validateContent: social links go through safeSocial', function () {
  var c = C.validateContent(base({ settings: { social: { facebook: 'javascript:alert(1)', instagram: 'https://instagram.com/x', google: 'http://g.page/x', youtube: 'https://evil.com', tiktok: 'https://tiktok.com/@x' } } }));
  assert.deepEqual(JSON.parse(JSON.stringify(c.settings.social)), { facebook: '', instagram: 'https://instagram.com/x', google: '', youtube: '', tiktok: 'https://tiktok.com/@x' });
});

test('validateContent: duplicate ids dropped (first wins), invalid elements discarded', function () {
  var c = C.validateContent(base({ gallery: [
    img('a'), img('a', { src: 'assets/gallery/other.webp' }), null, 'x', 5, [],
    { id: 'no-type', src: 'x.jpg' }, { id: 'bad type', type: 'image', src: 'x.jpg' }, { id: 'weird', type: 'gif', src: 'x.gif' },
    { id: 'nosrc', type: 'image' }, { id: 'yt-bad', type: 'youtube', youtubeId: 'nope' }, { id: 'yt-ok', type: 'youtube', youtubeId: 'dQw4w9WgXcQ' },
    { id: 'leg', type: 'video', src: 'assets/gallery/allin1.mp4', poster: 'assets/gallery/p.jpg' }, img('cat', { category: 'bogus' }), { type: 'image', src: 'x.jpg' }
  ] }));
  same(c.gallery.map(function (g) { return g.id; }), ['a', 'yt-ok', 'leg', 'cat']);
  assert.equal(c.gallery[0].src, 'assets/gallery/a.webp');
  assert.equal(c.gallery[3].category, '');
  var d = C.validateContent(base({
    beforeAfter: [{ id: 'x', before: 'a.jpg', after: 'b.jpg' }, { id: 'x', before: 'c.jpg', after: 'd.jpg' }, { id: 'y', before: 'a.jpg' }, { id: 'z', after: 'a.jpg' }],
    reviews: [{ id: 'r1', name: 'Ann', text: { en: 'Great' } }, { id: 'r1', name: 'Dup', text: { en: 'x' } }, { id: 'r2', name: '', text: { en: 'x' } }, { id: 'r3', name: 'Bob', text: {} }, { id: 'r4', name: 'Eve', text: { es: 'Bien' }, date: '2026-13' }, { id: 'r5', name: 'Zed', text: { es: 'Ok' }, date: '2026-03' }]
  }));
  same(d.beforeAfter.map(function (b) { return b.id; }), ['x']);
  assert.equal(d.beforeAfter[0].before, 'a.jpg');
  same(d.reviews.map(function (r) { return r.id; }), ['r1', 'r4', 'r5']);
  assert.equal(d.reviews[1].date, ''); assert.equal(d.reviews[2].date, '2026-03');
});

test('validateContent: accepts the shipped seed file', function () {
  var seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'content-seed.json'), 'utf8'));
  var c = C.validateContent(seed);
  assert.ok(c);
  assert.equal(c.gallery.length, seed.gallery.length);
  assert.equal(c.beforeAfter.length, seed.beforeAfter.length);
  assert.equal(c.gallery[0].type, 'video');
});

test('toGalleryItems keeps order, drops hidden and unresolvable items, resolves URLs', function () {
  var c = C.validateContent(base({ gallery: [
    img('one'), img('two', { hidden: true }), img('three', { src: 'media/k.webp' }), img('four', { src: 'https://evil.com/a.jpg' }),
    { id: 'yt', type: 'youtube', youtubeId: 'dQw4w9WgXcQ', category: 'exterior', caption: { es: 'Video', en: 'Video' } },
    { id: 'leg', type: 'video', src: 'assets/gallery/allin1.mp4', poster: 'assets/gallery/p.jpg' },
    img('six', { src: MEDIA + '/media/z.webp', poster: 'https://evil.com/p.jpg' })
  ] }));
  var items = C.toGalleryItems(c, { base: '../', mediaOrigin: MEDIA });
  same(items.map(function (i) { return i.id; }), ['one', 'three', 'yt', 'leg', 'six']);
  assert.equal(items[0].src, '../assets/gallery/one.webp');
  assert.equal(items[1].src, MEDIA + '/media/k.webp');
  assert.equal(items[2].embed, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0');
  assert.equal(items[2].thumb, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(items[3].poster, '../assets/gallery/p.jpg');
  assert.equal(items[4].poster, '');
  assert.equal(items[4].src, MEDIA + '/media/z.webp');
  same(C.toGalleryItems(null, {}), []);
});

test('toBeforeAfter and toReviews', function () {
  var c = C.validateContent(base({
    beforeAfter: [{ id: 'a', before: 'x/b.jpg', after: 'x/a.jpg' }, { id: 'b', before: 'x/b.jpg', after: 'x/a.jpg', hidden: true }, { id: 'c', before: 'javascript:1', after: 'x/a.jpg' }, { id: 'd', before: 'media/b.jpg', after: 'media/a.jpg' }],
    reviews: [{ id: 'r1', name: 'Ann', text: { en: 'Great job' }, source: 'Google', date: '2026-03' }, { id: 'r2', name: 'Bob', text: { es: 'Bien', en: 'Fine' }, hidden: true }, { id: 'r3', name: 'Eva', text: { es: 'Excelente', en: 'Excellent' } }]
  }));
  var ba = C.toBeforeAfter(c, { base: '../', mediaOrigin: MEDIA });
  same(ba.map(function (b) { return b.id; }), ['a', 'd']);
  assert.equal(ba[0].before, '../x/b.jpg'); assert.equal(ba[1].after, MEDIA + '/media/a.jpg');
  var es = C.toReviews(c, 'es'), en = C.toReviews(c, 'en');
  same(es.map(function (r) { return r.id; }), ['r1', 'r3']);
  assert.equal(es[0].text, 'Great job', 'falls back to the other language');
  assert.equal(es[1].text, 'Excelente'); assert.equal(en[1].text, 'Excellent');
  assert.equal(es[0].dateLabel, 'marzo de 2026'); assert.equal(en[0].dateLabel, 'March 2026');
  assert.equal(es[1].dateLabel, '');
  assert.equal(C.formatReviewDate('2026-00', 'en'), '');
});
