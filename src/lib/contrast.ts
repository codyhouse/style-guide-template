import { resolve, contexts, defaultInputs } from './resolver.js';
import { contrastRatio } from './color.js';
import type { ContrastResult, ResolverDoc, Tokens } from './types.js';
import { VALUES } from './schema.js';
import { valueAs } from './values.js';

export const ROLES = [
  'primary',
  'secondary',
  'destructive',
  'success',
  'warning',
  'info',
  'page',
  'card',
  'muted',
  'input',
  'focus',
];

export function requiredPairs(tokens: Tokens) {
  const pairs: Array<{ fg: string; bg: string; min: number; label: string }> = [];
  for (const role of ROLES) {
    const fg = `color.${role}.foreground`;
    const bg = `color.${role}.background`;
    if (tokens.has(fg) && tokens.has(bg)) pairs.push({ fg, bg, min: 4.5, label: `${role} text` });
  }
  for (const role of ['input', 'focus']) {
    const fg = `color.${role}.border`;
    if (tokens.has(fg) && tokens.has('color.page.background')) {
      pairs.push({ fg, bg: 'color.page.background', min: 3, label: `${role} border on page` });
    }
  }
  return pairs;
}

export function checkContrast(doc: ResolverDoc): ContrastResult[] {
  const inputs = defaultInputs(doc);
  const themes = contexts(doc).filter((c) => c.modifier === 'theme');
  return (themes.length ? themes : [{ context: 'default' }]).flatMap(({ context }): ContrastResult[] => {
    const tokens = resolve(doc, themes.length ? { ...inputs, theme: context } : inputs);
    return requiredPairs(tokens).flatMap((p) => {
      const fg = valueAs(VALUES.color, tokens.get(p.fg)?.resolved);
      const bg = valueAs(VALUES.color, tokens.get(p.bg)?.resolved);
      if (!fg || !bg) return [];
      const raw = contrastRatio(fg, bg);
      return [{ context, ...p, ratio: Math.round(raw * 100) / 100, pass: raw >= p.min }];
    });
  });
}
