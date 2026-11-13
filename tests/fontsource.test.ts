import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as z from 'zod/mini';
import { fixture, present } from './helpers.js';
import { fontDetail } from '../src/lib/schema.js';
import { fontFiles, fontsource, parseList } from '../src/adapters/fontsource.js';
import { memoryKeyValueStore } from '../src/adapters/memory.js';

const detail = z.parse(fontDetail, fixture('fontsource-merriweather.json'));
const listResponse = async () => ({
  ok: true,
  status: 200,
  json: async () => fixture('fontsource-list.json'),
});
const latin = { weights: [400, 700], styles: ['normal'], subsets: ['latin'] };

test('parseList keeps what the picker needs', () => {
  const m = present(parseList(fixture('fontsource-list.json')).find((f) => f.id === 'merriweather'));
  assert.deepEqual(
    Object.keys(m).sort((a, b) => a.localeCompare(b)),
    ['category', 'defSubset', 'family', 'id', 'license', 'styles', 'weights'],
  );
  assert.equal(m.family, 'Merriweather');
});

test('files for chosen weights and styles', () => {
  const files = fontFiles(detail, latin);
  assert.equal(files.length, 2);
  assert.equal(files[0].src, 'fonts/merriweather-latin-400-normal.woff2');
  assert.equal(files[0].version, detail.npmVersion);
  assert.equal(files[0].unicodeRange, detail.unicodeRange?.latin);
  assert.deepEqual(
    [files[0].provider, files[0].fontsourceId, files[0].family],
    ['fontsource', 'merriweather', 'Merriweather'],
  );
  assert.equal(fontsource().fileUrl(files[0]), detail.variants?.['400']?.normal?.latin?.url?.woff2);
});

test('missing variants are skipped', () => {
  assert.equal(fontFiles(detail, { ...latin, weights: [950] }).length, 0);
});

test('extra subsets are opt-in', () => {
  const files = fontFiles(detail, { ...latin, weights: [400], subsets: ['latin', 'cyrillic'] });
  assert.deepEqual(
    files.map((x) => x.subset),
    ['latin', 'cyrillic'],
  );
});

test('license URL', () => {
  assert.equal(
    fontsource().licenseUrl({
      family: 'Merriweather',
      weight: 400,
      style: 'normal',
      src: 'fonts/merriweather.woff2',
      fontsourceId: 'merriweather',
      version: '5.3.0',
    }),
    'https://cdn.jsdelivr.net/npm/@fontsource/merriweather@5.3.0/LICENSE',
  );
});

test('list is cached for a day', async () => {
  let calls = 0;
  const fetch = async () => {
    calls++;
    return listResponse();
  };
  const fonts = fontsource({ fetch, cache: memoryKeyValueStore() });
  await fonts.list();
  const second = await fonts.list();
  assert.equal(calls, 1);
  assert.ok(second.some((f) => f.id === 'merriweather'));
});

test('a corrupt cache is refetched and a full storage drops it', async () => {
  const cache = memoryKeyValueStore();
  cache.setItem('styleguide:fontsource-list', '{not json');
  const full = {
    ...cache,
    setItem: () => {
      throw new Error('quota');
    },
  };
  const list = await fontsource({ fetch: listResponse, cache: full }).list();
  assert.ok(list.some((f) => f.id === 'merriweather'));
  assert.equal(cache.getItem('styleguide:fontsource-list'), null);
});
