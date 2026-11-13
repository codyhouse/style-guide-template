import { test } from 'vitest';
import assert from 'node:assert/strict';
import { setToken } from '../src/lib/edit.js';
import { present, load } from './helpers.js';
import { checkContrast, requiredPairs, ROLES } from '../src/lib/contrast.js';
import { resolve } from '../src/lib/resolver.js';

const srgb = (v: number) => ({ colorSpace: 'srgb', components: [v, v, v] });

const justBelowAA = () =>
  setToken(load(), 'color.primary', {
    foreground: { $value: srgb(1) },
    background: { $value: srgb(0x77 / 255) },
  });

test('eleven roles', () => assert.equal(ROLES.length, 11));

test('a failing pair is reported per context', () => {
  const doc = justBelowAA();
  const light = checkContrast(doc).filter(
    (r) => r.context === 'light' && r.fg === 'color.primary.foreground',
  );
  assert.deepEqual(
    light.map((r) => [r.ratio, r.min, r.pass]),
    [[4.48, 4.5, false]],
  );
});

test('a dark override can fix it', () => {
  const doc = justBelowAA();
  present(doc.modifiers?.theme?.contexts.dark).push({
    color: { primary: { background: { $type: 'color', $value: srgb(0) } } },
  });
  const dark = present(
    checkContrast(doc).find((r) => r.context === 'dark' && r.fg === 'color.primary.foreground'),
  );
  assert.equal(dark.pass, true);
});

test('borders of input and focus on the page background need 3:1', () => {
  let doc = load();
  doc = setToken(doc, 'color.input', { border: { $value: srgb(0.5) } });
  const pair = present(requiredPairs(resolve(doc)).find((p) => p.fg === 'color.input.border'));
  assert.deepEqual([pair.bg, pair.min], ['color.page.background', 3]);
});

test('missing roles produce no pairs', () => {
  const pairs = requiredPairs(resolve(load()));
  assert.deepEqual(
    pairs.map((p) => p.fg),
    ['color.primary.foreground', 'color.page.foreground'],
  );
});
