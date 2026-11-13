import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseCssColor } from '../src/lib/color.js';
import { checkBrand } from '../src/lib/io.js';
import {
  addColor,
  addShade,
  generateShades,
  handSetShades,
  paletteColors,
  referencesTo,
  removeColor,
  removeShade,
  renameShade,
  setBase,
  setShade,
} from '../src/lib/palette.js';
import type { ResolverDoc } from '../src/lib/types.js';
import { nodeAt } from '../src/lib/tree.js';
import { present, preset, V } from './helpers.js';

const teal = present(parseCssColor('teal'));
const pink = present(parseCssColor('#ff3399'));
const colorOf = (doc: ResolverDoc, id: string) => present(paletteColors(doc, V).find((c) => c.id === id));
const shadeOf = (doc: ResolverDoc, id: string, name: string) =>
  present(colorOf(doc, id).shades.find((s) => s.name === name));
const foundationAt = (doc: ResolverDoc, path: string) => nodeAt(doc.sets.foundation.sources[0], path);
const darkTheme = (doc: ResolverDoc) => present(doc.modifiers?.theme?.contexts.dark[0]);
const valid = (doc: ResolverDoc) => assert.deepEqual(checkBrand(doc), []);

test('preset palettes keep their numeric scale and 600 as the base', () => {
  const brand = colorOf(preset(), 'brand');
  assert.equal(brand.shades.length, 11);
  assert.deepEqual(
    brand.shades.slice(0, 3).map((s) => s.name),
    ['50', '100', '200'],
  );
  assert.equal(present(brand.shades.find((s) => s.isBase)).name, '600');
  assert.ok(!paletteColors(preset(), V).some((c) => c.id === 'primary'));
});

test('a new color starts as one base shade', () => {
  const doc = addColor(preset(), 'accent', teal, V);
  const accent = colorOf(doc, 'accent');
  assert.deepEqual(
    accent.shades.map((s) => [s.name, s.isBase, s.byHand]),
    [['base', true, false]],
  );
  valid(doc);
});

test('named shades come before numeric ones', () => {
  let doc = addColor(preset(), 'accent', teal, V);
  doc = generateShades(doc, 'accent', V, 'keep');
  doc = addShade(doc, 'accent', 'light', pink, V);
  const names = colorOf(doc, 'accent').shades.map((s) => s.name);
  assert.deepEqual(names.slice(0, 3), ['base', 'light', '50']);
  assert.equal(names.length, 13);
  valid(doc);
});

test('editing a shade marks it as set by hand, editing the base does not', () => {
  let doc = setShade(preset(), 'brand', '300', pink, V);
  assert.equal(shadeOf(doc, 'brand', '300').byHand, true);
  doc = setShade(doc, 'brand', '600', teal, V);
  assert.equal(shadeOf(doc, 'brand', '600').byHand, false);
  assert.deepEqual(handSetShades(doc, 'brand', V), ['300']);
});

test('regenerating keeps hand-set shades unless told to overwrite them', () => {
  const edited = setShade(preset(), 'brand', '300', pink, V);
  const kept = generateShades(edited, 'brand', V, 'keep');
  assert.deepEqual(shadeOf(kept, 'brand', '300').color, pink);
  const overwritten = generateShades(edited, 'brand', V, 'overwrite');
  assert.notDeepEqual(shadeOf(overwritten, 'brand', '300').color, pink);
  assert.equal(shadeOf(overwritten, 'brand', '300').byHand, false);
  assert.deepEqual(handSetShades(overwritten, 'brand', V), []);
  valid(overwritten);
});

test("regenerating keeps a shade's CMYK and Pantone", () => {
  const doc = preset();
  present(foundationAt(doc, 'color.brand.300')).$extensions = { [V]: { pantone: 'Pantone 2728 C' } };
  const out = generateShades(doc, 'brand', V, 'overwrite');
  assert.deepEqual(foundationAt(out, 'color.brand.300')?.$extensions, { [V]: { pantone: 'Pantone 2728 C' } });
});

test('the base shade itself is never regenerated', () => {
  const doc = setShade(preset(), 'brand', '600', pink, V);
  assert.deepEqual(shadeOf(generateShades(doc, 'brand', V, 'overwrite'), 'brand', '600').color, pink);
});

test('references are found in every theme', () => {
  const refs = referencesTo(preset(), 'brand', ['600']);
  assert.ok(refs.some((r) => r.context === 'foundation' && r.path === 'color.primary.background'));
  assert.ok(referencesTo(preset(), 'brand', ['400']).some((r) => r.context === 'dark theme'));
});

test('renaming a shade repoints every alias to it', () => {
  const doc = renameShade(preset(), 'brand', '600', 'main', V);
  assert.equal(foundationAt(doc, 'color.primary.background')?.$value, '{color.brand.main}');
  assert.equal(shadeOf(doc, 'brand', 'main').isBase, true);
  assert.deepEqual(referencesTo(doc, 'brand', ['600']), []);
  valid(doc);
});

test('removing a shade inlines its color where it was used', () => {
  const before = preset();
  const color = foundationAt(before, 'color.brand.400')?.$value;
  const doc = removeShade(before, 'brand', '400', V);
  assert.ok(!colorOf(doc, 'brand').shades.some((s) => s.name === '400'));
  assert.ok(JSON.stringify(darkTheme(doc)).includes(JSON.stringify(color)));
  assert.deepEqual(referencesTo(doc, 'brand', ['400']), []);
  valid(doc);
});

test('the base shade cannot be removed', () => {
  const doc = removeShade(preset(), 'brand', '600', V);
  assert.ok(colorOf(doc, 'brand').shades.some((s) => s.name === '600'));
});

test('removing a color inlines all of its shades', () => {
  const doc = removeColor(preset(), 'brand');
  assert.ok(!paletteColors(doc, V).some((c) => c.id === 'brand'));
  assert.deepEqual(referencesTo(doc, 'brand'), []);
  valid(doc);
});

test('any shade can become the base', () => {
  const doc = setBase(preset(), 'brand', '400', V);
  assert.equal(shadeOf(doc, 'brand', '400').isBase, true);
  assert.equal(shadeOf(doc, 'brand', '600').isBase, false);
});

test('$ref pointers count as references too', () => {
  const doc = preset();
  present(foundationAt(doc, 'color')).link = { $value: { $ref: '#/color/brand/500/$value' } };
  assert.ok(referencesTo(doc, 'brand', ['500']).some((r) => r.path === 'color.link'));
  const renamed = renameShade(doc, 'brand', '500', 'mid', V);
  assert.equal(foundationAt(renamed, 'color.link')?.$value, '{color.brand.mid}');
  valid(renamed);
  const removed = removeShade(doc, 'brand', '500', V);
  assert.deepEqual(foundationAt(removed, 'color.link')?.$value, foundationAt(doc, 'color.brand.500')?.$value);
  valid(removed);
});

test('references in other sets and modifiers are found', () => {
  const doc = preset();
  doc.sets.extra = { sources: [{ color: { $type: 'color', note: { $value: '{color.brand.500}' } } }] };
  doc.modifiers = {
    ...doc.modifiers,
    density: {
      contexts: { compact: [{ color: { $type: 'color', tint: { $value: '{color.brand.500}' } } }] },
    },
  };
  const where = new Set(referencesTo(doc, 'brand', ['500']).map((r) => r.context));
  assert.ok(where.has('extra set'));
  assert.ok(where.has('density compact'));
});

test('edits never mutate the input', () => {
  const doc = preset();
  const snapshot = JSON.stringify(doc);
  addColor(doc, 'accent', teal, V);
  setShade(doc, 'brand', '300', pink, V);
  renameShade(doc, 'brand', '600', 'main', V);
  removeShade(doc, 'brand', '400', V);
  removeColor(doc, 'brand');
  generateShades(doc, 'brand', V, 'overwrite');
  assert.equal(JSON.stringify(doc), snapshot);
});
