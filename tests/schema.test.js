import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateResolver, toResolver, isResolver } from '../js/lib/schema.js';

const load = () => JSON.parse(readFileSync(new URL('./fixtures/minimal.resolver.json', import.meta.url), 'utf8'));
const tree = (doc) => doc.sets.foundation.sources[0];

test('minimal fixture is valid', () => {
  assert.deepEqual(validateResolver(load()).errors, []);
});

test('wrong version', () => {
  const r = validateResolver({ ...load(), version: '1' });
  assert.equal(r.ok, false);
  assert.match(r.errors[0].message, /2025\.10/);
});

test('missing $type is an error', () => {
  const doc = load();
  delete tree(doc).spacing.$type;
  const r = validateResolver(doc);
  assert.ok(r.errors.some((e) => e.path.endsWith('spacing.md') && /\$type/.test(e.message)), JSON.stringify(r.errors));
});

test('$type inherited from group is valid', () => {
  const doc = load();
  tree(doc).radius.lg = { $value: { value: 12, unit: 'px' } };
  assert.equal(validateResolver(doc).ok, true);
});

test('bad dimension unit', () => {
  const doc = load();
  tree(doc).spacing.md.$value.unit = 'em';
  assert.ok(validateResolver(doc).errors.some((e) => /px\|rem/.test(e.message)));
});

test('bad color space', () => {
  const doc = load();
  tree(doc).color.brand['700'].$value.colorSpace = 'cmyk';
  assert.ok(validateResolver(doc).errors.some((e) => e.path.endsWith('color.brand.700') && /colorSpace/.test(e.message)));
});

test('unknown $ key is an error', () => {
  const doc = load();
  tree(doc).color.$foo = 1;
  assert.ok(validateResolver(doc).errors.some((e) => /\$foo/.test(e.message)));
});

test('resolutionOrder must point at existing sets and modifiers', () => {
  const doc = load();
  doc.resolutionOrder.push({ $ref: '#/sets/nope' });
  assert.ok(validateResolver(doc).errors.some((e) => /#\/sets\/nope/.test(e.message)));
});

test('foreign tokens and $root are valid', () => {
  const doc = load();
  tree(doc).color.accent = { $root: { $value: '{color.brand.600}' }, light: { $value: '{color.brand.700}' } };
  tree(doc).size = { $type: 'dimension', huge: { $value: { value: 100, unit: 'rem' } } };
  assert.deepEqual(validateResolver(doc).errors, []);
});

test('plain tokens become a resolver', () => {
  const r = toResolver({ color: { $type: 'color' } }, 'X');
  assert.equal(isResolver(r), true);
  assert.equal(r.version, '2025.10');
  assert.equal(r.name, 'X');
  assert.deepEqual(Object.keys(r.modifiers.theme.contexts), ['light', 'dark']);
  assert.deepEqual(r.sets.foundation.sources, [{ color: { $type: 'color' } }]);
  assert.equal(validateResolver(r).ok, true);
});

test('a resolver passes through toResolver unchanged', () => {
  const doc = load();
  assert.equal(toResolver(doc, 'X'), doc);
});

test('color components must have three entries', () => {
  const doc = load();
  tree(doc).color.brand['700'].$value.components = [0.5];
  assert.ok(validateResolver(doc).errors.some((e) => /components/.test(e.message)));
});

test('border and transition sub-values are validated', () => {
  const doc = load();
  tree(doc).border = { $type: 'border', bad: { $value: { color: '{color.brand.600}', width: { value: 1, unit: 'px' }, style: 'solid;}html{x:y' } } };
  tree(doc).transition = { $type: 'transition', bad: { $value: { duration: { value: 1, unit: 'em' }, delay: { value: 0, unit: 'ms' }, timingFunction: [0, 0, 1, 1] } } };
  const errors = validateResolver(doc).errors;
  assert.ok(errors.some((e) => e.path.endsWith('border.bad')));
  assert.ok(errors.some((e) => e.path.endsWith('transition.bad')));
});

test('names with { } . are rejected (DTCG)', () => {
  const doc = load();
  tree(doc).color['a{b'] = { $value: '{color.brand.600}' };
  assert.ok(validateResolver(doc).errors.some((e) => /name/.test(e.message)));
});
