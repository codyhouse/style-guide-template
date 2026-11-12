import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { BrandMeta } from '../src/lib/types.js';
import * as E from '../src/lib/edit.js';
import { resolve } from '../src/lib/resolver.js';
import { oklch } from '../src/lib/color.js';

const V = 'com.example.styleguide';
const load = () => JSON.parse(readFileSync(new URL('./fixtures/minimal.resolver.json', import.meta.url), 'utf8'));

test('setHue regenerates 11 shades and keeps shade extensions', () => {
  const doc = load();
  const out = E.setHue(doc, 'brand', oklch(0.6, 0.15, 30));
  const brand = E.foundation(out).color.brand;
  assert.equal(Object.keys(brand).filter((k) => !k.startsWith('$')).length, 11);
  assert.equal(brand['600'].$value.components[2], 30);
  assert.deepEqual(brand['600'].$extensions, E.foundation(doc).color.brand['600'].$extensions);
  assert.equal(E.foundation(doc).color.brand['50'], undefined, 'input not mutated');
});

test('setRole in light writes the foundation, in dark writes the dark context', () => {
  let doc = E.setRole(load(), 'light', 'primary.foreground', '{color.neutral.900}');
  assert.equal(resolve(doc).get('color.primary.foreground').value, '{color.neutral.900}');
  doc = E.setRole(doc, 'dark', 'primary.foreground', '{color.neutral.50}');
  assert.equal(resolve(doc, { theme: 'dark' }).get('color.primary.foreground').value, '{color.neutral.50}');
  assert.equal(resolve(doc).get('color.primary.foreground').value, '{color.neutral.900}');
});

test('setToken writes a path, creating groups', () => {
  const doc = E.setToken(load(), 'radius.lg', { $value: { value: 12, unit: 'px' } });
  assert.deepEqual(E.foundation(doc).radius.lg.$value, { value: 12, unit: 'px' });
});

test('removeHue', () => {
  assert.equal(E.foundation(E.removeHue(load(), 'brand')).color.brand, undefined);
});

test('asset groups: add with a unique id, rename, move, remove', () => {
  let meta: BrandMeta = { assetGroups: [{ id: 'logos', label: 'Logos', items: [] }], fontFiles: [] };
  meta = E.addGroup(meta, 'Logos');
  assert.deepEqual(meta.assetGroups.map((g) => g.id), ['logos', 'logos-2']);
  meta = E.renameGroup(meta, 'logos-2', 'Patterns');
  assert.equal(meta.assetGroups[1].label, 'Patterns');
  meta = E.moveGroup(meta, 'logos-2', -1);
  assert.deepEqual(meta.assetGroups.map((g) => g.id), ['logos-2', 'logos']);
  meta = E.removeGroup(meta, 'logos');
  assert.deepEqual(meta.assetGroups.map((g) => g.id), ['logos-2']);
});

test('items: add, update, move, remove', () => {
  let meta: BrandMeta = { assetGroups: [{ id: 'g', label: 'G', items: [] }], fontFiles: [] };
  meta = E.addItems(meta, 'g', [{ label: 'a', src: 'g/a.svg' }, { label: 'b', src: 'g/b.svg' }]);
  meta = E.updateItem(meta, 'g', 'g/a.svg', { description: 'first' });
  meta = E.moveItem(meta, 'g', 'g/b.svg', -1);
  assert.deepEqual(meta.assetGroups[0].items.map((i) => i.src), ['g/b.svg', 'g/a.svg']);
  assert.equal(meta.assetGroups[0].items[1].description, 'first');
  meta = E.removeItem(meta, 'g', 'g/a.svg');
  assert.deepEqual(meta.assetGroups[0].items.map((i) => i.src), ['g/b.svg']);
});

test('font files are deduplicated by src', () => {
  let meta: BrandMeta = { assetGroups: [], fontFiles: [] };
  meta = E.addFontFiles(meta, ['fonts/a.woff2', 'fonts/a.woff2', 'fonts/b.woff2'].map((src) => ({ src, family: 'A', weight: 400, style: 'normal' })));
  assert.equal(meta.fontFiles.length, 2);
  assert.equal(E.removeFontFile(meta, 'fonts/a.woff2').fontFiles.length, 1);
});

test('uniquePath avoids existing session paths', () => {
  assert.equal(E.uniquePath('g/a.svg', new Set(['g/a.svg', 'g/a-2.svg'])), 'g/a-3.svg');
});

test('fontFromFileName guesses family, weight and style', () => {
  assert.deepEqual(E.fontFromFileName('Inter-BoldItalic.woff2'), { family: 'Inter', weight: 700, style: 'italic' });
  assert.deepEqual(E.fontFromFileName('my_font.ttf'), { family: 'my font', weight: 400, style: 'normal' });
});

test('setHue keeps the typed color and records which shade it is', async () => {
  const { parseCssColor } = await import('../src/lib/color.js');
  const out = E.setHue(load(), 'brand', parseCssColor('#f0941d'), V);
  const brand = E.foundation(out).color.brand;
  assert.equal(brand.$extensions[V].base, '300');
  assert.equal(brand['300'].$value.hex, '#f0941d');
});
