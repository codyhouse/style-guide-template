import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseList, fontEntries, licenseUrl, fileUrl, fetchList } from '../js/lib/fontsource.js';

const fixture = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const detail = fixture('fontsource-merriweather.json');

test('parseList keeps what the picker needs', () => {
  const m = parseList(fixture('fontsource-list.json')).find((f) => f.id === 'merriweather');
  assert.deepEqual(Object.keys(m).sort(), ['category', 'defSubset', 'family', 'id', 'license', 'styles', 'weights']);
  assert.equal(m.family, 'Merriweather');
});

test('entries for chosen weights and styles', () => {
  const e = fontEntries(detail, { weights: [400, 700], styles: ['normal'] });
  assert.equal(e.length, 2);
  assert.equal(e[0].src, 'fonts/merriweather-latin-400-normal.woff2');
  assert.equal(e[0].url, detail.variants['400'].normal.latin.url.woff2);
  assert.equal(e[0].version, detail.npmVersion);
  assert.equal(e[0].unicodeRange, detail.unicodeRange.latin);
  assert.deepEqual([e[0].provider, e[0].fontsourceId, e[0].family], ['fontsource', 'merriweather', 'Merriweather']);
  assert.equal(fileUrl(e[0]), e[0].url);
});

test('missing variants are skipped', () => {
  assert.equal(fontEntries(detail, { weights: [950], styles: ['normal'] }).length, 0);
});

test('extra subsets are opt-in', () => {
  const e = fontEntries(detail, { weights: [400], styles: ['normal'], subsets: ['latin', 'cyrillic'] });
  assert.deepEqual(e.map((x) => x.subset), ['latin', 'cyrillic']);
});

test('license URL', () => {
  assert.equal(licenseUrl('merriweather', '5.3.0'), 'https://cdn.jsdelivr.net/npm/@fontsource/merriweather@5.3.0/LICENSE');
});

test('list is cached for a day', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; return { ok: true, json: async () => fixture('fontsource-list.json') }; };
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  await fetchList(fetchFn, storage);
  const second = await fetchList(fetchFn, storage);
  assert.equal(calls, 1);
  assert.ok(second.some((f) => f.id === 'merriweather'));
});
