import { test } from 'vitest';
import assert from 'node:assert/strict';
import { present } from './helpers.js';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import {
  classify,
  parseBrandJson,
  loadZip,
  saveJson,
  slug,
  exportLayout,
  buildExport,
  readme,
} from '../src/lib/io.js';
import { resolve } from '../src/lib/resolver.js';
import { brandMeta } from '../src/lib/assets.js';

const V = 'com.example.styleguide';
const load = () =>
  JSON.parse(readFileSync(new URL('./fixtures/minimal.resolver.json', import.meta.url), 'utf8'));
const bytes = (s) => new TextEncoder().encode(s);
const text = (b) => new TextDecoder().decode(b);
const ctx = (over = {}) => ({
  vendor: V,
  hostedUrl: 'https://styleguide.example.com',
  files: new Map([['patterns/dots.svg', bytes('<svg/>')]]),
  library: new Set(['logos/primary.svg']),
  fetchBytes: async (url) => bytes(`bytes of ${url}`),
  ...over,
});

test('classify', () => {
  assert.equal(classify('a.resolver.json'), 'resolver');
  assert.equal(classify('a.tokens.json'), 'tokens');
  assert.equal(classify('brand.json'), 'tokens');
  assert.equal(classify('kit.ZIP'), 'zip');
  assert.equal(classify('a.WOFF2'), 'font');
  assert.equal(classify('logo.svg'), 'image');
  assert.equal(classify('deck.pdf'), 'file');
});

test('slug', () => {
  assert.equal(slug('Brand Name'), 'brand-name');
  assert.equal(slug('  !!  '), 'brand');
});

test('invalid JSON reports it', () => {
  assert.match(parseBrandJson('{', 'x.json').errors[0].message, /JSON/);
});

test('schema and alias errors are reported with paths', () => {
  const doc = load();
  doc.sets.foundation.sources[0].color.primary.background.$value = '{color.nope}';
  const r = parseBrandJson(JSON.stringify(doc), 'x.resolver.json');
  assert.ok(
    r.errors.some((e) => e.path === 'color.primary.background'),
    JSON.stringify(r.errors),
  );
});

test('a plain tokens file loads as a resolver named after the file', () => {
  const r = parseBrandJson(JSON.stringify(load().sets.foundation.sources[0]), 'acme.tokens.json');
  assert.deepEqual(r.errors, []);
  assert.equal(present(r.doc).name, 'acme');
});

test('saveJson', () => {
  const s = saveJson({ version: '2025.10', sets: {}, resolutionOrder: [] });
  assert.equal(s, '{\n  "version": "2025.10",\n  "sets": {},\n  "resolutionOrder": []\n}\n');
});

test('export layout: one folder per group, fonts in fonts/, duplicates numbered', () => {
  const layout = exportLayout({
    assetGroups: [{ id: 'logos', items: [{ src: 'a/logo.svg' }, { src: 'b/logo.svg' }] }],
    fontFiles: [{ src: 'x/m.woff2', family: 'M', weight: 400, style: 'normal' }],
  });
  assert.deepEqual(
    [...layout],
    [
      ['a/logo.svg', 'logos/logo.svg'],
      ['b/logo.svg', 'logos/logo-2.svg'],
      ['x/m.woff2', 'fonts/m.woff2'],
    ],
  );
});

test('zip contents', async () => {
  const names = Object.keys(unzipSync((await buildExport(load(), ctx())).zip));
  for (const n of [
    'README.md',
    'css/theme.css',
    'brand-name.resolver.json',
    'logos/primary.svg',
    'patterns/dots.svg',
    'fonts/merriweather-latin-700-normal.woff2',
    'fonts/merriweather-LICENSE.txt',
  ])
    assert.ok(names.includes(n), n);
});

test('theme.css points fonts at ../fonts', async () => {
  const css = text(unzipSync((await buildExport(load(), ctx())).zip)['css/theme.css']);
  assert.match(css, /url\("\.\.\/fonts\/merriweather-latin-700-normal\.woff2"\)/);
});

test('round trip', async () => {
  const doc = load();
  const { zip } = await buildExport(doc, ctx());
  const back = loadZip(zip);
  assert.deepEqual(back.errors, []);
  const loaded = present(back.doc);
  assert.deepEqual(resolve(loaded), resolve(doc));
  assert.deepEqual(
    brandMeta(loaded, V).assetGroups.map((g) => g.id),
    ['logos', 'patterns'],
  );
  assert.equal(text(back.files.get('patterns/dots.svg')), '<svg/>');
  assert.equal(back.files.has('README.md'), false);
  assert.equal(back.files.has('css/theme.css'), false);
});

test('foreign tokens and extensions round-trip unchanged', async () => {
  const doc = load();
  const t = doc.sets.foundation.sources[0];
  t.color.accent = { $root: { $value: '{color.brand.600}', $extensions: { 'org.tool.x': { k: 1 } } } };
  doc.sets.foundation.$extensions['org.tool.x'] = { keep: true };
  const back = present(loadZip((await buildExport(doc, ctx())).zip).doc);
  assert.deepEqual(back.sets.foundation.sources[0].color.accent, t.color.accent);
  assert.deepEqual(back.sets.foundation.$extensions?.['org.tool.x'], { keep: true });
});

test('a failed download is a warning listed in the README', async () => {
  const fetchBytes = async (url) => {
    if (url.includes('merriweather@')) throw new Error('offline');
    return bytes('x');
  };
  const { zip, warnings } = await buildExport(load(), ctx({ fetchBytes }));
  assert.ok(warnings.some((w) => /merriweather-latin-700-normal\.woff2/.test(w)));
  assert.match(text(unzipSync(zip)['README.md']), /merriweather-latin-700-normal\.woff2/);
});

test('a missing asset is a warning, export still works', async () => {
  const { zip, warnings } = await buildExport(load(), ctx({ files: new Map() }));
  assert.ok(warnings.some((w) => /patterns\/dots\.svg/.test(w)));
  assert.equal('patterns/dots.svg' in unzipSync(zip), false);
});

test('README has the hosted URL and a contrast table with warnings', () => {
  const md = readme(load(), {
    hostedUrl: 'https://styleguide.example.com',
    contrast: [
      {
        context: 'light',
        fg: 'color.primary.foreground',
        bg: 'color.primary.background',
        label: 'primary text',
        ratio: 3.2,
        min: 4.5,
        pass: false,
      },
    ],
    missing: [],
    failedDownloads: [],
  });
  assert.match(md, /^# Brand Name/);
  assert.match(md, /https:\/\/styleguide\.example\.com/);
  assert.match(md, /\| light \| primary text \| 3\.2 \| 4\.5 \| warning \|/);
});

test('a file that breaks in any theme is rejected at load', () => {
  const doc = load();
  doc.modifiers.theme.contexts.dark = [
    { color: { page: { background: { $type: 'color', $value: '{color.nope}' } } } },
  ];
  assert.ok(parseBrandJson(JSON.stringify(doc), 'x.resolver.json').errors.length);
});

test('a file with broken brand metadata is rejected at load', () => {
  const doc = load();
  doc.sets.foundation.$extensions[V].fontFiles = [{ family: 'A' }];
  assert.ok(parseBrandJson(JSON.stringify(doc), 'x.resolver.json').errors.some((e) => /src/.test(e.message)));
});

test('a resolver without a foundation set is rejected with a clear message', () => {
  const doc = load();
  doc.sets = { base: doc.sets.foundation };
  doc.resolutionOrder[0] = { $ref: '#/sets/base' };
  assert.match(parseBrandJson(JSON.stringify(doc), 'x.resolver.json').errors[0].message, /foundation/);
});

test('a corrupt ZIP is an error, not a throw', () => {
  const r = loadZip(new Uint8Array([1, 2, 3]));
  assert.ok(r.errors.length);
});
