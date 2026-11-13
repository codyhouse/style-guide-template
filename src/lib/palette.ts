import { anchoredScale } from './color.js';
import { ROLES } from './contrast.js';
import { foundation } from './edit.js';
import { child, children, ensureChild, isHandSet, isNode, vendorData, withVendorData } from './tree.js';
import type { DtcgColor, ResolverDoc, TokenNode } from './types.js';
import { VALUES } from './schema.js';
import { valueAs } from './values.js';

export interface Shade {
  name: string;
  color: DtcgColor | null;
  isBase: boolean;
  byHand: boolean;
}

export interface PaletteColor {
  id: string;
  shades: Shade[];
}

export interface Reference {
  context: string;
  path: string;
}

const isNumeric = (name: string) => /^\d+$/.test(name);

export const paletteId = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '');

export const byShadeOrder = (a: string, b: string) => {
  if (isNumeric(a) && isNumeric(b)) return Number(a) - Number(b);
  if (isNumeric(a) !== isNumeric(b)) return isNumeric(a) ? 1 : -1;
  return 0;
};

const clone = <T>(value: T): T => structuredClone(value);

const without = (node: TokenNode, key: string): TokenNode =>
  Object.fromEntries(Object.entries(node).filter(([name]) => name !== key));

const colorsOf = (doc: ResolverDoc): TokenNode => ensureChild(foundation(doc), 'color', { $type: 'color' });

export function baseShadeOf(group: TokenNode, vendor: string): string | undefined {
  const marked = vendorData(group, vendor).base;
  const names = children(group).map(([name]) => name);
  if (typeof marked === 'string' && names.includes(marked)) return marked;
  if (names.includes('600')) return '600';
  return names.toSorted(byShadeOrder)[Math.floor(names.length / 2)];
}

const isPaletteGroup = (id: string, group: TokenNode) =>
  !ROLES.includes(id) && children(group).some(([, token]) => '$value' in token);

export function paletteColors(doc: ResolverDoc, vendor: string): PaletteColor[] {
  return children(child(foundation(doc), 'color'))
    .filter(([id, group]) => isPaletteGroup(id, group))
    .map(([id, group]) => {
      const base = baseShadeOf(group, vendor);
      const shades = children(group)
        .map(([name]) => name)
        .toSorted(byShadeOrder)
        .map((name) => {
          const token = child(group, name);
          return {
            name,
            color: valueAs(VALUES.color, token?.$value),
            isBase: name === base,
            byHand: isHandSet(token, vendor),
          };
        });
      return { id, shades };
    });
}

const setLabel = (set: string) => (set === 'foundation' ? 'foundation' : `${set} set`);
const contextLabel = (modifier: string, context: string) =>
  modifier === 'theme' ? `${context} theme` : `${modifier} ${context}`;

function treesOf(doc: ResolverDoc): [string, TokenNode][] {
  const inSets = Object.entries(doc.sets).flatMap(([set, { sources }]) =>
    sources.map((tree): [string, TokenNode] => [setLabel(set), tree]),
  );
  const inModifiers = Object.entries(doc.modifiers ?? {}).flatMap(([modifier, { contexts }]) =>
    Object.entries(contexts).flatMap(([context, sources]) =>
      sources.map((tree): [string, TokenNode] => [contextLabel(modifier, context), tree]),
    ),
  );
  return [...inSets, ...inModifiers];
}

function walkValues(tree: TokenNode, path: string, visit: (token: TokenNode, path: string) => void) {
  for (const [key, node] of children(tree)) {
    const at = path ? `${path}.${key}` : key;
    if ('$value' in node) visit(node, at);
    else walkValues(node, at, visit);
  }
}

const aliasOf = (colorId: string, shade: string) => `{color.${colorId}.${shade}}`;
const pointerOf = (colorId: string, shade: string) => `#/color/${colorId}/${shade}/$value`;

function pointsAt(value: unknown, colorId: string, shade: string): boolean {
  if (value === aliasOf(colorId, shade)) return true;
  return isNode(value) && value.$ref === pointerOf(colorId, shade);
}

function replaceReference(value: unknown, colorId: string, shade: string, next: unknown): unknown {
  if (pointsAt(value, colorId, shade)) return next;
  if (Array.isArray(value)) return value.map((item) => replaceReference(item, colorId, shade, next));
  if (!isNode(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, replaceReference(item, colorId, shade, next)]),
  );
}

function mentions(value: unknown, colorId: string, shade: string): boolean {
  if (pointsAt(value, colorId, shade)) return true;
  if (Array.isArray(value)) return value.some((item) => mentions(item, colorId, shade));
  return isNode(value) && Object.values(value).some((item) => mentions(item, colorId, shade));
}

export function referencesTo(doc: ResolverDoc, colorId: string, shades?: string[]): Reference[] {
  const names = shades ?? children(child(child(foundation(doc), 'color'), colorId)).map(([name]) => name);
  const found: Reference[] = [];
  for (const [context, tree] of treesOf(doc))
    walkValues(tree, '', (token, path) => {
      if (path.startsWith(`color.${colorId}.`)) return;
      if (names.some((name) => mentions(token.$value, colorId, name))) found.push({ context, path });
    });
  return found;
}

function repoint(doc: ResolverDoc, colorId: string, shade: string, next: unknown) {
  for (const [, tree] of treesOf(doc))
    walkValues(tree, '', (token) => {
      token.$value = replaceReference(token.$value, colorId, shade, next);
    });
}

function generated(token: TokenNode, vendor: string, color: DtcgColor): TokenNode {
  const { $extensions, ...rest } = token;
  const { [vendor]: own = {}, ...others } = $extensions ?? {};
  const { overridden, ...kept } = own;
  const next = Object.keys(kept).length ? { ...others, [vendor]: kept } : others;
  return Object.keys(next).length
    ? { ...rest, $value: color, $extensions: next }
    : { ...rest, $value: color };
}

const handSet = (token: TokenNode, vendor: string, color: DtcgColor): TokenNode =>
  withVendorData({ ...token, $value: color }, vendor, { overridden: true });

export function addColor(doc: ResolverDoc, id: string, color: DtcgColor, vendor: string): ResolverDoc {
  const out = clone(doc);
  colorsOf(out)[id] = withVendorData({ base: { $value: color } }, vendor, { base: 'base' });
  return out;
}

export function removeColor(doc: ResolverDoc, id: string): ResolverDoc {
  const out = clone(doc);
  const colors = colorsOf(out);
  for (const [name, token] of children(child(colors, id))) repoint(out, id, name, token.$value);
  foundation(out).color = without(colors, id);
  return out;
}

export function setShade(
  doc: ResolverDoc,
  colorId: string,
  shade: string,
  color: DtcgColor,
  vendor: string,
): ResolverDoc {
  const out = clone(doc);
  const group = child(colorsOf(out), colorId);
  if (!group) return doc;
  const token = child(group, shade) ?? {};
  group[shade] =
    shade === baseShadeOf(group, vendor) ? { ...token, $value: color } : handSet(token, vendor, color);
  return out;
}

export function addShade(
  doc: ResolverDoc,
  colorId: string,
  shade: string,
  color: DtcgColor,
  vendor: string,
): ResolverDoc {
  const group = child(child(foundation(doc), 'color'), colorId);
  if (!group || child(group, shade)) return doc;
  return setShade(doc, colorId, shade, color, vendor);
}

export function renameShade(
  doc: ResolverDoc,
  colorId: string,
  from: string,
  to: string,
  vendor: string,
): ResolverDoc {
  const out = clone(doc);
  const group = child(colorsOf(out), colorId);
  const token = child(group, from);
  if (!group || !token || child(group, to)) return doc;
  const wasBase = baseShadeOf(group, vendor) === from;
  const renamed = Object.fromEntries(
    Object.entries(group).map(([key, value]) => [key === from ? to : key, value]),
  );
  colorsOf(out)[colorId] = wasBase ? withVendorData(renamed, vendor, { base: to }) : renamed;
  repoint(out, colorId, from, aliasOf(colorId, to));
  return out;
}

export function removeShade(doc: ResolverDoc, colorId: string, shade: string, vendor: string): ResolverDoc {
  const out = clone(doc);
  const group = child(colorsOf(out), colorId);
  const token = child(group, shade);
  if (!group || !token || baseShadeOf(group, vendor) === shade) return doc;
  repoint(out, colorId, shade, token.$value);
  colorsOf(out)[colorId] = without(group, shade);
  return out;
}

export function setBase(doc: ResolverDoc, colorId: string, shade: string, vendor: string): ResolverDoc {
  const out = clone(doc);
  const group = child(colorsOf(out), colorId);
  if (!group || !child(group, shade)) return doc;
  colorsOf(out)[colorId] = withVendorData(group, vendor, { base: shade });
  return out;
}

export function handSetShades(doc: ResolverDoc, colorId: string, vendor: string): string[] {
  const color = paletteColors(doc, vendor).find((c) => c.id === colorId);
  return color?.shades.filter((s) => s.byHand && !s.isBase).map((s) => s.name) ?? [];
}

export type GenerateMode = 'keep' | 'overwrite';

export function generateShades(
  doc: ResolverDoc,
  colorId: string,
  vendor: string,
  mode: GenerateMode,
): ResolverDoc {
  const out = clone(doc);
  const group = child(colorsOf(out), colorId);
  const base = group && baseShadeOf(group, vendor);
  const baseColor = base ? valueAs(VALUES.color, child(group, base)?.$value) : null;
  if (!group || !base || !baseColor) return doc;
  const { scale } = anchoredScale(baseColor);
  for (const [step, color] of Object.entries(scale)) {
    if (step === base) continue;
    const token = child(group, step) ?? {};
    if (isHandSet(token, vendor) && mode === 'keep') continue;
    group[step] = generated(token, vendor, color);
  }
  return out;
}
