import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brandMeta, withBrandMeta, allSrcs, resolveAsset, missingAssets, matchDropped } from '../src/lib/assets.js';

const V = 'com.example.styleguide';
const load = () => JSON.parse(readFileSync(new URL('./fixtures/minimal.resolver.json', import.meta.url), 'utf8'));
const font = { family: 'M', weight: 400, style: 'normal', subset: 'latin', src: 'fonts/m.woff2', provider: 'fontsource', fontsourceId: 'm', version: '1.0.0' };

test('resolution order: session, library, fontsource, missing', () => {
  const ctx = { session: new Map([['logos/a.svg', new Uint8Array()]]), library: new Set(['logos/a.svg', 'logos/b.svg']) };
  assert.equal(resolveAsset({ src: 'logos/a.svg' }, ctx).source, 'session');
  assert.deepEqual(resolveAsset({ src: 'logos/b.svg' }, ctx), { source: 'library', url: 'library/logos/b.svg' });
  assert.equal(resolveAsset(font, ctx).source, 'fontsource');
  assert.match(resolveAsset(font, ctx).url, /^https:\/\/cdn\.jsdelivr\.net\//);
  assert.equal(resolveAsset({ src: 'logos/c.svg' }, ctx).source, 'missing');
});

test('missingAssets and allSrcs', () => {
  const meta = brandMeta(load(), V);
  assert.deepEqual(allSrcs(meta).map((s) => [s.src, s.kind]), [
    ['logos/primary.svg', 'asset'], ['patterns/dots.svg', 'asset'], ['fonts/merriweather-latin-700-normal.woff2', 'font'],
  ]);
  assert.deepEqual(missingAssets(meta, { session: new Map(), library: new Set(['logos/primary.svg']) }), ['patterns/dots.svg']);
});

test('dropped files match by basename, case-insensitive', () => {
  const file = new File([], 'A.SVG');
  const r = matchDropped(['logos/a.svg'], [file]);
  assert.equal(r.matched.get('logos/a.svg'), file);
  assert.deepEqual(r.unmatched, []);
});

test('colliding names are ambiguous, nothing assigned', () => {
  const r = matchDropped(['logos/logo.svg', 'icons/logo.svg'], [new File([], 'logo.svg'), new File([], 'other.png')]);
  assert.equal(r.matched.size, 0);
  assert.deepEqual(r.ambiguous, [{ name: 'logo.svg', candidates: ['logos/logo.svg', 'icons/logo.svg'] }]);
  assert.deepEqual(r.unmatched.map((f) => f.name), ['other.png']);
});

test('a file saved under another origin key is read and moved, other extensions kept', () => {
  const doc = load();
  const ext = doc.sets.foundation.$extensions;
  ext['com.other.site'] = ext[V];
  delete ext[V];
  ext['org.tool.x'] = { keep: true };
  const meta = brandMeta(doc, V);
  assert.equal(meta.assetGroups.length, 2);
  const out = withBrandMeta(doc, V, meta);
  assert.deepEqual(Object.keys(out.sets.foundation.$extensions).sort(), [V, 'org.tool.x']);
  assert.equal(doc.sets.foundation.$extensions['com.other.site'] !== undefined, true, 'input not mutated');
});

test('empty meta when nothing is set', () => {
  const doc = load();
  delete doc.sets.foundation.$extensions;
  assert.deepEqual(brandMeta(doc, V), { assetGroups: [], fontFiles: [] });
});

test('srcs that are not plain relative paths are treated as missing', () => {
  const ctx = { session: new Map(), library: new Set(['../secret.svg', 'https://evil.example/x.svg', '/abs.svg']) };
  for (const src of ['../secret.svg', 'https://evil.example/x.svg', '/abs.svg', 'logos/../../x.svg', 'javascript:alert(1)']) {
    assert.equal(resolveAsset({ src }, ctx).source, 'missing', src);
  }
});

test('brand metadata is validated', async () => {
  const { validateBrandMeta } = await import('../src/lib/assets.js');
  assert.deepEqual(validateBrandMeta({ assetGroups: [{ id: 'logos', label: 'L', items: [{ label: 'a', src: 'logos/a.svg' }] }], fontFiles: [] }), []);
  const bad = validateBrandMeta({
    assetGroups: [{ id: 'x"y', items: [] }, { id: 'ok' }, { id: '../up', items: [] }],
    fontFiles: [{ family: 'A' }],
  });
  assert.ok(bad.some((e) => /x"y/.test(e.message)));
  assert.ok(bad.some((e) => /items/.test(e.message)));
  assert.ok(bad.some((e) => /\.\.\/up/.test(e.message)));
  assert.ok(bad.some((e) => /src/.test(e.message)));
});

test('adoptVendor moves every foreign extension (tokens and groups) to this site', async () => {
  const { adoptVendor } = await import('../src/lib/assets.js');
  const doc = load();
  const t = doc.sets.foundation.sources[0];
  const move = (o) => { o['com.other.site'] = o[V]; delete o[V]; };
  move(doc.sets.foundation.$extensions);
  move(t.color.brand['600'].$extensions);
  move(t.spacing.$extensions);
  const out = adoptVendor(doc, V);
  assert.deepEqual(out.sets.foundation.sources[0].color.brand['600'].$extensions[V].pantone, 'PANTONE 2727 C');
  assert.ok(out.sets.foundation.sources[0].spacing.$extensions[V].scale);
  assert.ok(brandMeta(out, V).assetGroups.length);
  assert.equal(JSON.stringify(out).includes('com.other.site'), false);
});
