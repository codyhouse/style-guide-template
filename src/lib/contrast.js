// Required WCAG pairs derived from the role structure, checked in every theme context.
import { resolve, contexts, defaultInputs } from './resolver.js';
import { contrastRatio } from './color.js';

export const ROLES = ['primary', 'secondary', 'destructive', 'success', 'warning', 'info', 'page', 'card', 'muted', 'input', 'focus'];

export function requiredPairs(tokens) {
  const pairs = [];
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

export function checkContrast(doc) {
  const inputs = defaultInputs(doc);
  const themes = contexts(doc).filter((c) => c.modifier === 'theme');
  return (themes.length ? themes : [{ context: 'default' }]).flatMap(({ context }) => {
    const tokens = resolve(doc, themes.length ? { ...inputs, theme: context } : inputs);
    return requiredPairs(tokens).map((p) => {
      const raw = contrastRatio(tokens.get(p.fg).resolved, tokens.get(p.bg).resolved);
      return { context, ...p, ratio: Math.round(raw * 100) / 100, pass: raw >= p.min }; // pass on the unrounded ratio
    });
  });
}
