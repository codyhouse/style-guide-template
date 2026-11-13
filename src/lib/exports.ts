import { block, generateCss, cssName } from './css.js';
import { resolve, contexts, defaultInputs } from './resolver.js';
import { toOklchString } from './color.js';
import type { ExportFormat } from '../ports.js';
import { VALUES } from './schema.js';
import { valueAs } from './values.js';
import type { FontFile, ResolverDoc, Tokens } from './types.js';

const tailwindName = (path: string) =>
  path.startsWith('font-size.')
    ? `--text-${path.slice('font-size.'.length).replaceAll(/\./g, '-')}`
    : cssName(path);

export function tailwindCss(
  doc: ResolverDoc,
  { fontSrc, vendor }: { fontSrc: (f: FontFile) => string; vendor?: string },
): string {
  const css = generateCss(doc, { fontSrc, vendor, name: tailwindName, rootSelector: '@theme' });
  return [
    '@import "tailwindcss";',
    '',
    '@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));',
    '',
    css,
  ].join('\n');
}

const SHADCN: Array<[name: string, paths: string[]]> = [
  ['background', ['color.page.background']],
  ['foreground', ['color.page.foreground']],
  ['card', ['color.card.background']],
  ['card-foreground', ['color.card.foreground']],
  ['popover', ['color.card.background']],
  ['popover-foreground', ['color.card.foreground']],
  ['primary', ['color.primary.background']],
  ['primary-foreground', ['color.primary.foreground']],
  ['secondary', ['color.secondary.background']],
  ['secondary-foreground', ['color.secondary.foreground']],
  ['muted', ['color.muted.background']],
  ['muted-foreground', ['color.muted.foreground']],
  ['accent', ['color.secondary.background-hover', 'color.info.background']],
  ['accent-foreground', ['color.secondary.foreground', 'color.info.foreground']],
  ['destructive', ['color.destructive.background']],
  ['destructive-foreground', ['color.destructive.foreground']],
  ['border', ['color.card.border', 'color.page.border']],
  ['input', ['color.input.border']],
  ['ring', ['color.focus.border']],
];
const RADIUS = ['radius.md', 'radius.lg', 'radius.sm'];

function shadcnVars(tokens: Tokens, withRadius: boolean) {
  const lines: string[] = [];
  if (withRadius) {
    const radius = RADIUS.map((p) => valueAs(VALUES.dimension, tokens.get(p)?.resolved)).find(Boolean);
    if (radius) lines.push(`--radius: ${radius.value}${radius.unit};`);
  }
  for (const [name, paths] of SHADCN) {
    const color = paths.map((x) => valueAs(VALUES.color, tokens.get(x)?.resolved)).find(Boolean);
    if (color) lines.push(`--${name}: ${toOklchString(color)};`);
  }
  return lines;
}

export function shadcnCss(doc: ResolverDoc): string {
  const inputs = defaultInputs(doc);
  const light = shadcnVars(resolve(doc, inputs), true);
  const hasDark = contexts(doc).some((c) => c.modifier === 'theme' && c.context === 'dark');
  const names = light.map((l) => l.split(':')[0].slice(2));
  return [
    block(':root', light),
    hasDark ? block('.dark', shadcnVars(resolve(doc, { ...inputs, theme: 'dark' }), false)) : '',
    block(
      '@theme inline',
      names.map((n) => (n === 'radius' ? '--radius-lg: var(--radius);' : `--color-${n}: var(--${n});`)),
    ),
  ].join('\n');
}

const relativeFontSrc = (file: FontFile) => `../${file.src}`;

export const exportFormats: ExportFormat[] = [
  {
    key: 'css',
    label: 'CSS variables',
    render: (doc, vendor) => generateCss(doc, { vendor, fontSrc: relativeFontSrc }),
  },
  {
    key: 'tailwind',
    label: 'Tailwind v4',
    render: (doc, vendor) => tailwindCss(doc, { vendor, fontSrc: relativeFontSrc }),
  },
  { key: 'shadcn', label: 'shadcn/ui', render: (doc) => shadcnCss(doc) },
];
