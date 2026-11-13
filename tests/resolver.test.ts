import { test } from 'vitest';
import assert from 'node:assert/strict';
import { setToken } from '../src/lib/edit.js';
import { nodeAt } from '../src/lib/tree.js';
import { VALUES } from '../src/lib/schema.js';
import { valueAs } from '../src/lib/values.js';
import type { ResolverDoc, Tokens } from '../src/lib/types.js';
import { load, present, token } from './helpers.js';
import { ResolveError, resolve, contexts, defaultInputs, aliasTarget, flatten } from '../src/lib/resolver.js';
import { toHex } from '../src/lib/color.js';

const tree = (doc: ResolverDoc) => doc.sets.foundation.sources[0];

const colorAt = (doc: ResolverDoc, path: string) =>
  present(valueAs(VALUES.color, nodeAt(tree(doc), path)?.$value));
const colorOf = (tokens: Tokens, path: string) =>
  present(valueAs(VALUES.color, token(tokens, path).resolved));

test('dark overrides light', () => {
  const doc = load();
  assert.equal(
    toHex(colorOf(resolve(doc, { theme: 'dark' }), 'color.page.background')),
    colorAt(doc, 'color.neutral.950').hex,
  );
  assert.equal(toHex(colorOf(resolve(doc), 'color.page.background')), colorAt(doc, 'color.neutral.50').hex);
});

test('raw value keeps the alias, type is inherited', () => {
  const t = token(resolve(load()), 'color.primary.background');
  assert.equal(t.value, '{color.brand.600}');
  assert.equal(t.type, 'color');
});

test('chained alias', () => {
  let doc = load();
  doc = setToken(doc, 'color.link', { $value: '{color.primary.background}' });
  assert.equal(colorOf(resolve(doc), 'color.link').hex, colorAt(doc, 'color.brand.600').hex);
});

test('$ref pointer resolves like a curly alias', () => {
  let doc = load();
  doc = setToken(doc, 'color.ref', { $value: { $ref: '#/color/brand/600/$value' } });
  assert.deepEqual(token(resolve(doc), 'color.ref').resolved, colorAt(doc, 'color.brand.600'));
});

test('composite alias', () => {
  const t = present(valueAs(VALUES.typography, token(resolve(load()), 'typography.heading-1').resolved));
  assert.deepEqual(t.fontSize, { value: 3.0518, unit: 'rem' });
  assert.deepEqual(t.fontFamily, ['Merriweather', 'serif']);
});

test('cycle throws', () => {
  let doc = load();
  doc = setToken(doc, 'color.a', { $value: '{color.b}' });
  doc = setToken(doc, 'color.b', { $value: '{color.a}' });
  assert.throws(() => resolve(doc), /cycle/i);
});

test('missing target throws with path', () => {
  let doc = load();
  doc = setToken(doc, 'color.primary.background', { $value: '{color.nope}' });
  assert.throws(
    () => resolve(doc),
    (e) => e instanceof ResolveError && e.path === 'color.primary.background',
  );
});

test('$root keeps its segment in the key', () => {
  let doc = load();
  doc = setToken(doc, 'color.accent', { $root: { $value: '{color.brand.600}' } });
  assert.ok(flatten(tree(doc)).has('color.accent.$root'));
});

test('contexts and default inputs', () => {
  const doc = load();
  assert.deepEqual(
    contexts(doc).map((c) => [c.context, c.isDefault]),
    [
      ['light', true],
      ['dark', false],
    ],
  );
  assert.deepEqual(defaultInputs(doc), { theme: 'light' });
});

test('aliasTarget', () => {
  assert.equal(aliasTarget('{a.b}'), 'a.b');
  assert.equal(aliasTarget('a.b'), null);
  assert.equal(aliasTarget({ value: 1 }), null);
});

test('an unknown context falls back to the default one', () => {
  const doc = load();
  delete present(doc.modifiers?.theme).contexts.dark;
  assert.doesNotThrow(() => resolve(doc, { theme: 'dark' }));
  assert.equal(token(resolve(doc, { theme: 'dark' }), 'color.page.background').value, '{color.neutral.50}');
});
