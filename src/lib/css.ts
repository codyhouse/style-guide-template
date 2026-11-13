import { flatten, contexts, defaultInputs, mergedTree, aliasTarget } from './resolver.js';
import { cssColor } from './color.js';
import { fontFaceRules, cssString } from './fonts.js';
import * as z from 'zod/mini';
import { brandMeta as brandMetaSchema, VALUES } from './schema.js';
import { isNode } from './tree.js';
import type { FlatToken, FontFile, ResolverDoc } from './types.js';
import { valueAs } from './values.js';

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

function shadowCss(value: unknown, part: (type: string, value: unknown) => string | null): string | null {
  const shadow = valueAs(VALUES.shadow, value);
  if (!shadow) return null;
  return [shadow]
    .flat()
    .map((layer) => {
      if (aliasTarget(layer) || !isNode(layer)) return part('shadow', layer);
      const lengths = (['offsetX', 'offsetY', 'blur', 'spread'] as const).map((key) =>
        part('dimension', layer[key]),
      );
      return [...(layer.inset ? ['inset'] : []), ...lengths, part('color', layer.color)].join(' ');
    })
    .join(', ');
}

function weightCss(value: unknown): string | null {
  const weight = valueAs(VALUES.fontWeight, value);
  if (weight === null) return null;
  return String(typeof weight === 'string' ? WEIGHTS[weight] : weight);
}

function familyCss(value: unknown): string | null {
  const family = valueAs(VALUES.fontFamily, value);
  if (family === null) return null;
  return [family]
    .flat()
    .map((f) => (GENERIC.has(f) ? f : cssString(f)))
    .join(', ');
}

export function cssValue(type: string | undefined, value: unknown, name: Namer = cssName): string | null {
  const target = aliasTarget(value);
  if (target) return `var(${name(target)})`;
  if (isNode(value) && typeof value.$ref === 'string') return `var(${name(pointerPath(value.$ref))})`;
  const part = (t: string, x: unknown) => cssValue(t, x, name);
  switch (type) {
    case 'color': {
      const color = valueAs(VALUES.color, value);
      return color && cssColor(color);
    }
    case 'dimension':
    case 'duration': {
      const length = valueAs(VALUES[type], value);
      return length && `${length.value}${length.unit}`;
    }
    case 'fontFamily':
      return familyCss(value);
    case 'fontWeight':
      return weightCss(value);
    case 'cubicBezier': {
      const curve = valueAs(VALUES.cubicBezier, value);
      return curve && `cubic-bezier(${curve.join(', ')})`;
    }
    case 'shadow':
      return shadowCss(value, part);
    case 'border': {
      const border = valueAs(VALUES.border, value);
      return (
        border &&
        `${part('dimension', border.width)} ${part('strokeStyle', border.style)} ${part('color', border.color)}`
      );
    }
    case 'transition': {
      const t = valueAs(VALUES.transition, value);
      return (
        t &&
        `${part('duration', t.duration)} ${part('cubicBezier', t.timingFunction)} ${part('duration', t.delay)}`
      );
    }
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
    case 'strokeStyle':
      return typeof value === 'string' && /^[a-z-]+$/.test(value) ? value : null;
    default:
      return null;
  }
}

function typographyDeclarations(path: string, value: unknown, name: Namer): string[] {
  const whole = aliasTarget(value);
  const fields = isNode(value) ? value : {};
  return TYPO_FIELDS.map(([field, prop, type]) => {
    const css = whole ? `var(${name(whole)}-${prop})` : cssValue(type, fields[field], name);
    return `${name(path)}-${prop}: ${css};`;
  });
}

export function cssDeclarations(tokens: Map<string, FlatToken>, name: Namer = cssName): string[] {
  return [...tokens].flatMap(([path, { type, value }]) => {
    if (type === 'typography') return typographyDeclarations(path, value, name);
    const css = cssValue(type, value, name);
    return css === null ? [] : [`${name(path)}: ${css};`];
  });
}

export function block(selector: string, lines: string[]) {
  const body = lines.map((line) => '  ' + line).join('\n');
  return `${selector} {\n${body}\n}\n`;
}

function fontFilesOf(doc: ResolverDoc, vendor?: string): FontFile[] {
  if (!vendor) return [];
  const meta = z.safeParse(brandMetaSchema, doc.sets?.foundation?.$extensions?.[vendor] ?? {});
  return meta.success ? meta.data.fontFiles : [];
}

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
  const faces = fontFaceRules(fontFilesOf(doc, vendor), fontSrc);
  return faces ? `${css}${faces}\n` : css;
}
