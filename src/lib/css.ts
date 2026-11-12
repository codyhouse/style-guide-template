import { flatten, contexts, defaultInputs, mergedTree, aliasTarget } from './resolver.js';
import { cssColor } from './color.js';
import { fontFaceRules, cssString } from './fonts.js';
import type { FlatToken, FontFile, Json, ResolverDoc } from './types.js';

type Namer = (path: string) => string;

const GENERIC = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
]);
const WEIGHTS: Record<string, number> = {
  thin: 100,
  hairline: 100,
  'extra-light': 200,
  'ultra-light': 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  medium: 500,
  'semi-bold': 600,
  'demi-bold': 600,
  bold: 700,
  'extra-bold': 800,
  'ultra-bold': 800,
  black: 900,
  heavy: 900,
  'extra-black': 950,
  'ultra-black': 950,
};
const TYPO_FIELDS: Array<[field: string, prop: string, type: string]> = [
  ['fontFamily', 'font-family', 'fontFamily'],
  ['fontSize', 'font-size', 'dimension'],
  ['fontWeight', 'font-weight', 'fontWeight'],
  ['letterSpacing', 'letter-spacing', 'dimension'],
  ['lineHeight', 'line-height', 'number'],
];

// Names come from loaded files: anything outside [A-Za-z0-9_-] is written as a CSS escape.
const ident = (s: string) =>
  s.replace(/[^A-Za-z0-9_-]/g, (c) => `\\${(c.codePointAt(0) ?? 0).toString(16)} `);
export const cssName = (path: string) =>
  '--' +
  ident(
    path
      .split('.')
      .filter((s) => s !== '$root')
      .join('-'),
  );

const pointerPath = (ref: string) =>
  ref
    .replace(/^#\//, '')
    .split('/')
    .filter((s) => s !== '$value')
    .join('.');

export function cssValue(type: string | undefined, value: Json, name: Namer = cssName): string | null {
  const target = aliasTarget(value);
  if (target) return `var(${name(target)})`;
  if (value && typeof value === 'object' && typeof value.$ref === 'string')
    return `var(${name(pointerPath(value.$ref))})`;
  const v = (t: string, x: unknown) => cssValue(t, x, name);
  switch (type) {
    case 'color':
      return cssColor(value);
    case 'dimension':
    case 'duration':
      return `${value.value}${value.unit}`;
    case 'fontFamily':
      return [value]
        .flat()
        .map((f) => (GENERIC.has(f) ? f : cssString(f)))
        .join(', ');
    case 'fontWeight':
      return String(WEIGHTS[value] ?? value);
    case 'cubicBezier':
      return `cubic-bezier(${value.join(', ')})`;
    case 'shadow':
      return [value]
        .flat()
        .map((s): string | null =>
          aliasTarget(s)
            ? v('shadow', s)
            : [
                ...(s.inset ? ['inset'] : []),
                ...['offsetX', 'offsetY', 'blur', 'spread'].map((k) => v('dimension', s[k])),
                v('color', s.color),
              ].join(' '),
        )
        .join(', ');
    case 'border':
      return `${v('dimension', value.width)} ${value.style} ${v('color', value.color)}`;
    case 'transition':
      return `${v('duration', value.duration)} ${v('cubicBezier', value.timingFunction)} ${v('duration', value.delay)}`;
    case 'number':
      return Number.isFinite(value) ? String(value) : null;
    case 'strokeStyle':
      return typeof value === 'string' && /^[a-z-]+$/.test(value) ? value : null;
    default:
      return null;
  }
}

export function cssDeclarations(tokens: Map<string, FlatToken>, name: Namer = cssName): string[] {
  const out: string[] = [];
  for (const [path, { type, value }] of tokens) {
    if (type === 'typography') {
      const whole = aliasTarget(value);
      for (const [field, prop, t] of TYPO_FIELDS) {
        const v = whole ? `var(${name(whole)}-${prop})` : cssValue(t, value[field], name);
        out.push(`${name(path)}-${prop}: ${v};`);
      }
    } else {
      const v = cssValue(type, value, name);
      if (v !== null) out.push(`${name(path)}: ${v};`);
    }
  }
  return out;
}

const block = (selector: string, lines: string[]) =>
  `${selector} {\n${lines.map((l) => `  ${l}`).join('\n')}\n}\n`;

export function generateCss(
  doc: ResolverDoc,
  {
    fontSrc,
    vendor,
    name = cssName,
    rootSelector = ':root',
  }: { fontSrc: (f: FontFile) => string; vendor?: string; name?: Namer; rootSelector?: string },
): string {
  const inputs = defaultInputs(doc);
  const base = cssDeclarations(flatten(mergedTree(doc, inputs)), name);
  let css = block(rootSelector, base);
  const known = new Set(base);
  for (const { modifier, context, isDefault } of contexts(doc)) {
    if (isDefault) continue;
    const lines = cssDeclarations(flatten(mergedTree(doc, { ...inputs, [modifier]: context })), name).filter(
      (l) => !known.has(l),
    );
    if (lines.length) css += block(`:root[data-${ident(modifier)}="${ident(context)}"]`, lines);
  }
  const faces = fontFaceRules(
    vendor ? doc.sets?.foundation?.$extensions?.[vendor]?.fontFiles : undefined,
    fontSrc,
  );
  return faces ? `${css}${faces}\n` : css;
}
