// CSS custom properties from a DTCG resolver document.
import { flatten, contexts, defaultInputs, mergedTree, aliasTarget } from './resolver.js';
import { toOklchString } from './color.js';
import { fontFaceRules } from './fonts.js';

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif',
  'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong']);
const WEIGHTS = { thin: 100, hairline: 100, 'extra-light': 200, 'ultra-light': 200, light: 300, normal: 400,
  regular: 400, book: 400, medium: 500, 'semi-bold': 600, 'demi-bold': 600, bold: 700, 'extra-bold': 800,
  'ultra-bold': 800, black: 900, heavy: 900, 'extra-black': 950, 'ultra-black': 950 };
const TYPO_FIELDS = [['fontFamily', 'font-family', 'fontFamily'], ['fontSize', 'font-size', 'dimension'],
  ['fontWeight', 'font-weight', 'fontWeight'], ['letterSpacing', 'letter-spacing', 'dimension'],
  ['lineHeight', 'line-height', 'number']];

export const cssName = (path) => '--' + path.split('.').filter((s) => s !== '$root').join('-');

const pointerPath = (ref) => ref.replace(/^#\//, '').split('/').filter((s) => s !== '$value').join('.');

export function cssValue(type, value) {
  const target = aliasTarget(value);
  if (target) return `var(${cssName(target)})`;
  if (value && typeof value === 'object' && typeof value.$ref === 'string') return `var(${cssName(pointerPath(value.$ref))})`;
  switch (type) {
    case 'color': return toOklchString(value);
    case 'dimension':
    case 'duration': return `${value.value}${value.unit}`;
    case 'fontFamily': return [value].flat().map((f) => (GENERIC.has(f) ? f : `"${f}"`)).join(', ');
    case 'fontWeight': return String(WEIGHTS[value] ?? value);
    case 'cubicBezier': return `cubic-bezier(${value.join(', ')})`;
    case 'shadow': return [value].flat().map((s) => (aliasTarget(s) ? cssValue('shadow', s) : [
      ...(s.inset ? ['inset'] : []), ...['offsetX', 'offsetY', 'blur', 'spread'].map((k) => cssValue('dimension', s[k])),
      cssValue('color', s.color)].join(' '))).join(', ');
    case 'border': return `${cssValue('dimension', value.width)} ${value.style} ${cssValue('color', value.color)}`;
    case 'transition': return `${cssValue('duration', value.duration)} ${cssValue('cubicBezier', value.timingFunction)} ${cssValue('duration', value.delay)}`;
    case 'number':
    case 'strokeStyle': return String(value);
    default: return null;
  }
}

export function cssDeclarations(tokens) {
  const out = [];
  for (const [path, { type, value }] of tokens) {
    if (type === 'typography') {
      const whole = aliasTarget(value);
      for (const [field, prop, t] of TYPO_FIELDS) {
        const v = whole ? `var(${cssName(whole)}-${prop})` : cssValue(t, value[field]);
        out.push(`${cssName(path)}-${prop}: ${v};`);
      }
    } else {
      const v = cssValue(type, value);
      if (v !== null) out.push(`${cssName(path)}: ${v};`);
    }
  }
  return out;
}

const block = (selector, lines) => `${selector} {\n${lines.map((l) => `  ${l}`).join('\n')}\n}\n`;

export function generateCss(doc, { fontSrc, vendor }) {
  const inputs = defaultInputs(doc);
  const base = cssDeclarations(flatten(mergedTree(doc, inputs)));
  let css = block(':root', base);
  const known = new Set(base);
  for (const { modifier, context, isDefault } of contexts(doc)) {
    if (isDefault) continue;
    const lines = cssDeclarations(flatten(mergedTree(doc, { ...inputs, [modifier]: context }))).filter((l) => !known.has(l));
    if (lines.length) css += block(`:root[data-${modifier}="${context}"]`, lines);
  }
  const faces = fontFaceRules(doc.sets?.foundation?.$extensions?.[vendor]?.fontFiles, fontSrc);
  return faces ? `${css}${faces}\n` : css;
}
