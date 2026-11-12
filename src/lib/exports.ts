// Copy-ready variants of the brand CSS: Tailwind v4 and shadcn/ui.
import { generateCss, cssName } from './css.js';
import { resolve, contexts, defaultInputs } from './resolver.js';
import { toOklchString } from './color.js';
import type { FontFile, ResolverDoc, Tokens } from './types.js';

// Tailwind v4 theme namespaces: font-size tokens become --text-*; the others already match.
const tailwindName = (path: string) => (path.startsWith('font-size.') ? `--text-${path.slice('font-size.'.length).replace(/\./g, '-')}` : cssName(path));

export function tailwindCss(doc: ResolverDoc, { fontSrc, vendor }: { fontSrc: (f: FontFile) => string; vendor?: string }): string {
  const css = generateCss(doc, { fontSrc, vendor, name: tailwindName, rootSelector: '@theme' });
  return [
    '@import "tailwindcss";',
    '',
    '@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));',
    '',
    css,
  ].join('\n');
}

// shadcn/ui variable -> our role token, first match wins.
const SHADCN: Array<[name: string, paths: string[]]> = [
  ['background', ['color.page.background']], ['foreground', ['color.page.foreground']],
  ['card', ['color.card.background']], ['card-foreground', ['color.card.foreground']],
  ['popover', ['color.card.background']], ['popover-foreground', ['color.card.foreground']],
  ['primary', ['color.primary.background']], ['primary-foreground', ['color.primary.foreground']],
  ['secondary', ['color.secondary.background']], ['secondary-foreground', ['color.secondary.foreground']],
  ['muted', ['color.muted.background']], ['muted-foreground', ['color.muted.foreground']],
  ['accent', ['color.secondary.background-hover', 'color.info.background']],
  ['accent-foreground', ['color.secondary.foreground', 'color.info.foreground']],
  ['destructive', ['color.destructive.background']], ['destructive-foreground', ['color.destructive.foreground']],
  ['border', ['color.card.border', 'color.page.border']], ['input', ['color.input.border']],
  ['ring', ['color.focus.border']],
];
const RADIUS = ['radius.md', 'radius.lg', 'radius.sm'];

function shadcnVars(tokens: Tokens, withRadius: boolean) {
  const lines: string[] = [];
  if (withRadius) {
    const r = RADIUS.map((p) => tokens.get(p)).find(Boolean);
    if (r) lines.push(`--radius: ${r.resolved.value}${r.resolved.unit};`);
  }
  for (const [name, paths] of SHADCN) {
    const t = paths.map((x) => tokens.get(x)).find(Boolean);
    if (t) lines.push(`--${name}: ${toOklchString(t.resolved)};`);
  }
  return lines;
}

const block = (selector: string, lines: string[]) => `${selector} {\n${lines.map((l) => `  ${l}`).join('\n')}\n}\n`;

export function shadcnCss(doc: ResolverDoc): string {
  const inputs = defaultInputs(doc);
  const light = shadcnVars(resolve(doc, inputs), true);
  const dark = contexts(doc).find((c) => c.modifier === 'theme' && c.context === 'dark');
  const names = light.map((l) => l.split(':')[0].slice(2));
  return [
    block(':root', light),
    dark ? block('.dark', shadcnVars(resolve(doc, { ...inputs, theme: 'dark' }), false)) : '',
    block('@theme inline', names.map((n) => (n === 'radius' ? '--radius-lg: var(--radius);' : `--color-${n}: var(--${n});`))),
  ].join('\n');
}
