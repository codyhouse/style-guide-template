import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cssName, cssValue, generateCss } from '../js/lib/css.js';
import { fontFaceRules } from '../js/lib/fonts.js';

const V = 'com.example.styleguide';
const load = () => JSON.parse(readFileSync(new URL('./fixtures/minimal.resolver.json', import.meta.url), 'utf8'));
const opts = { vendor: V, fontSrc: (e) => e.src };

test('names', () => {
  assert.equal(cssName('color.primary.background'), '--color-primary-background');
  assert.equal(cssName('spacing.md'), '--spacing-md');
  assert.equal(cssName('color.accent.$root'), '--color-accent');
});

test('values', () => {
  assert.equal(cssValue('color', '{color.brand.600}'), 'var(--color-brand-600)');
  assert.equal(cssValue('color', { colorSpace: 'oklch', components: [0.55, 0.18, 260] }), 'oklch(0.55 0.18 260)');
  assert.equal(cssValue('dimension', { value: 16, unit: 'px' }), '16px');
  assert.equal(cssValue('duration', { value: 150, unit: 'ms' }), '150ms');
  assert.equal(cssValue('fontFamily', ['Open Sans', 'sans-serif']), '"Open Sans", sans-serif');
  assert.equal(cssValue('fontWeight', 'semi-bold'), '600');
  assert.equal(cssValue('cubicBezier', [0.4, 0, 0.2, 1]), 'cubic-bezier(0.4, 0, 0.2, 1)');
  assert.equal(
    cssValue('shadow', { color: '{color.neutral.900}', offsetX: { value: 0, unit: 'px' }, offsetY: { value: 2, unit: 'px' }, blur: { value: 8, unit: 'px' }, spread: { value: 0, unit: 'px' }, inset: true }),
    'inset 0px 2px 8px 0px var(--color-neutral-900)',
  );
});

test('snapshot', () => {
  assert.equal(generateCss(load(), opts), readFileSync(new URL('./fixtures/minimal.css', import.meta.url), 'utf8'));
});

test('typography expands into one property per field', () => {
  const css = generateCss(load(), opts);
  assert.match(css, /--typography-heading-1-font-family: var\(--font-heading\);/);
  assert.match(css, /--typography-heading-1-font-size: var\(--font-size-4xl\);/);
  assert.match(css, /--typography-heading-1-line-height: 1\.2;/);
});

test('dark block holds only differences', () => {
  const dark = generateCss(load(), opts).split(':root[data-theme="dark"]')[1].split('}')[0];
  assert.match(dark, /--color-page-background: var\(--color-neutral-950\);/);
  assert.doesNotMatch(dark, /--spacing-md/);
});

test('foreign tokens are emitted', () => {
  const doc = load();
  doc.sets.foundation.sources[0].color.accent = { $root: { $value: '{color.brand.600}' } };
  doc.sets.foundation.sources[0].size = { $type: 'dimension', huge: { $value: { value: 100, unit: 'rem' } } };
  const css = generateCss(doc, opts);
  assert.match(css, /--color-accent: var\(--color-brand-600\);/);
  assert.match(css, /--size-huge: 100rem;/);
});

test('font-face', () => {
  const css = fontFaceRules([{ family: 'Merriweather', weight: 700, style: 'normal', src: 'fonts/m.woff2', unicodeRange: 'U+0000-00FF' }], (e) => e.src);
  assert.match(css, /@font-face \{[^}]*font-family: "Merriweather";[^}]*font-weight: 700;[^}]*src: url\("fonts\/m\.woff2"\) format\("woff2"\);[^}]*unicode-range: U\+0000-00FF;[^}]*font-display: swap;/);
  assert.match(fontFaceRules([{ family: 'X', weight: 400, style: 'italic', src: 'a.ttf' }], (e) => e.src), /format\("truetype"\)/);
});

test('font family names cannot break out of the CSS string', () => {
  assert.equal(cssValue('fontFamily', ['A"; } body { x: y']), '"A\\"; } body { x: y"');
  const css = fontFaceRules([{ family: 'B"}', weight: 400, style: 'normal', src: 'a".woff2' }], (e) => e.src);
  assert.match(css, /font-family: "B\\"\}";/);
  assert.match(css, /url\("a\\"\.woff2"\)/);
});

test('strokeStyle strings are limited to keywords', () => {
  assert.equal(cssValue('strokeStyle', 'dashed'), 'dashed');
  assert.equal(cssValue('strokeStyle', 'solid; } x {'), null);
});
