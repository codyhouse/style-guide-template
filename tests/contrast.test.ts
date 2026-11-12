import { test } from 'vitest';
import assert from 'node:assert/strict';
import { present } from './helpers.js';
import { readFileSync } from 'node:fs';
import { checkContrast, requiredPairs, ROLES } from '../src/lib/contrast.js';
import { resolve } from '../src/lib/resolver.js';

const load = () => JSON.parse(readFileSync(new URL('./fixtures/minimal.resolver.json', import.meta.url), 'utf8'));
const tree = (doc) => doc.sets.foundation.sources[0];
const srgb = (v) => ({ colorSpace: 'srgb', components: [v, v, v] });

test('eleven roles', () => assert.equal(ROLES.length, 11));

test('a failing pair is reported per context', () => {
  const doc = load();
  tree(doc).color.primary = { foreground: { $value: srgb(1) }, background: { $value: srgb(0x77 / 255) } };
  const light = checkContrast(doc).filter((r) => r.context === 'light' && r.fg === 'color.primary.foreground');
  assert.deepEqual(light.map((r) => [r.ratio, r.min, r.pass]), [[4.48, 4.5, false]]);
});

test('a dark override can fix it', () => {
  const doc = load();
  tree(doc).color.primary = { foreground: { $value: srgb(1) }, background: { $value: srgb(0x77 / 255) } };
  doc.modifiers.theme.contexts.dark.push({ color: { primary: { background: { $type: 'color', $value: srgb(0) } } } });
  const dark = present(checkContrast(doc).find((r) => r.context === 'dark' && r.fg === 'color.primary.foreground'));
  assert.equal(dark.pass, true);
});

test('borders of input and focus on the page background need 3:1', () => {
  const doc = load();
  tree(doc).color.input = { border: { $value: srgb(0.5) } };
  const pair = present(requiredPairs(resolve(doc)).find((p) => p.fg === 'color.input.border'));
  assert.deepEqual([pair.bg, pair.min], ['color.page.background', 3]);
});

test('missing roles produce no pairs', () => {
  const pairs = requiredPairs(resolve(load()));
  assert.deepEqual(pairs.map((p) => p.fg), ['color.primary.foreground', 'color.page.foreground']);
});
