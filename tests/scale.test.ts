import { test } from 'vitest';
import assert from 'node:assert/strict';
import { child } from '../src/lib/tree.js';
import { present, V } from './helpers.js';
import { generateScale, applyScale, setStep, type ScaleSpec } from '../src/lib/scale.js';
import type { TokenNode } from '../src/lib/types.js';

const spacing = {
  base: { value: 4, unit: 'px' },
  steps: { xs: 1, sm: 2, md: 4, lg: 6, xl: 8, '2xl': 12, '3xl': 16 },
};
const groupWith = (scale: ScaleSpec): TokenNode => ({
  $type: 'dimension',
  $extensions: { [V]: { scale: structuredClone(scale) } },
});

test('linear scale', () => {
  assert.deepEqual(generateScale(spacing).md, { value: 16, unit: 'px' });
  assert.deepEqual(generateScale(spacing)['3xl'], { value: 64, unit: 'px' });
});

test('ratio scale', () => {
  const type = { base: { value: 1, unit: 'rem' }, ratio: 1.25, steps: { xs: -2, md: 0, '4xl': 5 } };
  assert.deepEqual(generateScale(type).xs, { value: 0.64, unit: 'rem' });
  assert.deepEqual(generateScale(type)['4xl'], { value: 3.0518, unit: 'rem' });
});

test('applyScale writes every step and keeps other extensions', () => {
  const g = groupWith(spacing);
  present(g.$extensions)['org.tool.x'] = { a: 1 };
  const out = applyScale(g, V);
  assert.deepEqual(
    Object.keys(out).filter((k) => !k.startsWith('$')),
    Object.keys(spacing.steps),
  );
  assert.deepEqual(out.$extensions?.['org.tool.x'], { a: 1 });
  assert.equal('md' in g, false, 'input not mutated');
});

test('a hand override survives regeneration', () => {
  let g = applyScale(groupWith(spacing), V);
  g = setStep(g, 'md', { value: 18, unit: 'px' }, V);
  g = applyScale(
    { ...g, $extensions: { [V]: { scale: { ...spacing, base: { value: 8, unit: 'px' } } } } },
    V,
  );
  assert.deepEqual(child(g, 'md')?.$value, { value: 18, unit: 'px' });
  assert.deepEqual(child(g, 'lg')?.$value, { value: 48, unit: 'px' });
});
