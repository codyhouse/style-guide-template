import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, contexts, defaultInputs, aliasTarget, flatten } from '../js/lib/resolver.js';
import { toHex } from '../js/lib/color.js';

const load = () => JSON.parse(readFileSync(new URL('./fixtures/minimal.resolver.json', import.meta.url), 'utf8'));
const tree = (doc) => doc.sets.foundation.sources[0];

test('dark overrides light', () => {
  const doc = load();
  const n = tree(doc).color.neutral;
  assert.equal(toHex(resolve(doc, { theme: 'dark' }).get('color.page.background').resolved), n['950'].$value.hex);
  assert.equal(toHex(resolve(doc).get('color.page.background').resolved), n['50'].$value.hex);
});

test('raw value keeps the alias, type is inherited', () => {
  const t = resolve(load()).get('color.primary.background');
  assert.equal(t.value, '{color.brand.600}');
  assert.equal(t.type, 'color');
});

test('chained alias', () => {
  const doc = load();
  tree(doc).color.link = { $value: '{color.primary.background}' };
  assert.equal(resolve(doc).get('color.link').resolved.hex, tree(doc).color.brand['600'].$value.hex);
});

test('$ref pointer resolves like a curly alias', () => {
  const doc = load();
  tree(doc).color.ref = { $value: { $ref: '#/color/brand/600/$value' } };
  assert.deepEqual(resolve(doc).get('color.ref').resolved, tree(doc).color.brand['600'].$value);
});

test('composite alias', () => {
  const t = resolve(load()).get('typography.heading-1').resolved;
  assert.deepEqual(t.fontSize, { value: 3.0518, unit: 'rem' });
  assert.deepEqual(t.fontFamily, ['Merriweather', 'serif']);
});

test('cycle throws', () => {
  const doc = load();
  tree(doc).color.a = { $value: '{color.b}' };
  tree(doc).color.b = { $value: '{color.a}' };
  assert.throws(() => resolve(doc), /cycle/i);
});

test('missing target throws with path', () => {
  const doc = load();
  tree(doc).color.primary.background.$value = '{color.nope}';
  assert.throws(() => resolve(doc), (e) => e.path === 'color.primary.background');
});

test('$root keeps its segment in the key', () => {
  const doc = load();
  tree(doc).color.accent = { $root: { $value: '{color.brand.600}' } };
  assert.ok(flatten(tree(doc)).has('color.accent.$root'));
});

test('contexts and default inputs', () => {
  const doc = load();
  assert.deepEqual(contexts(doc).map((c) => [c.context, c.isDefault]), [['light', true], ['dark', false]]);
  assert.deepEqual(defaultInputs(doc), { theme: 'light' });
});

test('aliasTarget', () => {
  assert.equal(aliasTarget('{a.b}'), 'a.b');
  assert.equal(aliasTarget('a.b'), null);
  assert.equal(aliasTarget({ value: 1 }), null);
});

test('an unknown context falls back to the default one', () => {
  const doc = load();
  delete doc.modifiers.theme.contexts.dark;
  assert.doesNotThrow(() => resolve(doc, { theme: 'dark' }));
  assert.equal(resolve(doc, { theme: 'dark' }).get('color.page.background').value, '{color.neutral.50}');
});
