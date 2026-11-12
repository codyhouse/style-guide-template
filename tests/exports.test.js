import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tailwindCss, shadcnCss } from '../js/lib/exports.js';

const V = 'com.example.styleguide';
const load = () => JSON.parse(readFileSync(new URL('./fixtures/minimal.resolver.json', import.meta.url), 'utf8'));
const opts = { vendor: V, fontSrc: (f) => f.src };

test('tailwind v4: tokens in @theme with Tailwind namespaces, dark as a variant', () => {
  const css = tailwindCss(load(), opts);
  assert.match(css, /^@import "tailwindcss";/);
  assert.match(css, /@custom-variant dark \(&:where\(\[data-theme="dark"\], \[data-theme="dark"\] \*\)\);/);
  const theme = css.split('@theme {')[1].split('\n}')[0];
  assert.match(theme, /--color-primary-background: var\(--color-brand-600\);/);
  assert.match(theme, /--text-md: 1rem;/);
  assert.match(theme, /--typography-heading-1-font-size: var\(--text-4xl\);/);
  assert.match(theme, /--spacing-md: 16px;/);
  assert.doesNotMatch(theme, /--font-size-/);
  assert.match(css, /:root\[data-theme="dark"\] \{\s*--color-page-background: var\(--color-neutral-950\);/);
  assert.match(css, /@font-face/);
});

test('shadcn: standard variable names with resolved values, .dark block, @theme inline mapping', () => {
  const css = shadcnCss(load(), opts);
  const root = css.split(':root {')[1].split('}')[0];
  assert.match(root, /--primary: oklch\(0\.55 0\.18 260\);/);
  assert.match(root, /--primary-foreground: oklch\(0\.97 0\.005 260\);/);
  assert.match(root, /--background: oklch\(0\.97 0\.005 260\);/);
  assert.match(root, /--radius: 8px;/);
  const dark = css.split('.dark {')[1].split('}')[0];
  assert.match(dark, /--background: oklch\(0\.15 0\.01 260\);/);
  assert.doesNotMatch(dark, /--radius/);
  assert.match(css, /@theme inline \{[^}]*--color-primary: var\(--primary\);/);
});

test('shadcn skips variables the brand has no role for', () => {
  const css = shadcnCss(load(), opts);
  assert.doesNotMatch(css, /--destructive:/);
});
