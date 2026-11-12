// Pure edit operations used by the editor. Each returns a new document or meta.
import { anchoredScale } from './color.js';
import { slug } from './io.js';
import type { AssetGroup, AssetItem, BrandMeta, DtcgColor, FontFile, ResolverDoc, TokenNode } from './types.js';

const clone = <T>(x: T): T => structuredClone(x);
export const foundation = (doc: ResolverDoc): TokenNode => doc.sets.foundation.sources[0];

function setIn(tree: TokenNode, path: string, value: unknown) {
  const keys = path.split('.');
  const last = keys.pop() ?? path;
  let node = tree;
  for (const k of keys) node = node[k] ??= {};
  node[last] = value;
}

export function setToken(doc: ResolverDoc, path: string, token: TokenNode): ResolverDoc {
  const out = clone(doc);
  setIn(foundation(out), path, token);
  return out;
}

// The typed color is kept as one shade (recorded as the group's base); the rest are generated.
export function setHue(doc: ResolverDoc, hue: string, color: DtcgColor, vendor?: string): ResolverDoc {
  const out = clone(doc);
  const { scale, anchor } = anchoredScale(color);
  const group = (foundation(out).color[hue] ??= {});
  for (const [shade, value] of Object.entries(scale)) group[shade] = { ...group[shade], $value: value };
  if (vendor) group.$extensions = { ...group.$extensions, [vendor]: { ...group.$extensions?.[vendor], base: anchor } };
  return out;
}

export function removeHue(doc: ResolverDoc, hue: string): ResolverDoc {
  const out = clone(doc);
  delete foundation(out).color[hue];
  return out;
}

// Role edits apply to the theme being previewed: light is the foundation, others are context overrides.
export function setRole(doc: ResolverDoc, theme: string, rolePath: string, alias: string): ResolverDoc {
  const out = clone(doc);
  const mod = out.modifiers?.theme;
  if (!mod || theme === (mod.default ?? 'light')) {
    setIn(foundation(out), `color.${rolePath}`, { ...getIn(foundation(out), `color.${rolePath}`), $value: alias });
    return out;
  }
  const ctx = (mod.contexts[theme] ??= []);
  if (!ctx.length) ctx.push({});
  setIn(ctx[0], `color.${rolePath}`, { $type: 'color', $value: alias });
  return out;
}

function getIn(tree: TokenNode, path: string) {
  return path.split('.').reduce<any>((n, k) => n?.[k], tree);
}

const updateGroups = (meta: BrandMeta, fn: (groups: AssetGroup[]) => AssetGroup[]): BrandMeta => ({ ...meta, assetGroups: fn(meta.assetGroups.map((g) => ({ ...g, items: [...g.items] }))) });
const move = <T>(list: T[], i: number, dir: number): T[] => {
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  [list[i], list[j]] = [list[j], list[i]];
  return list;
};

export function addGroup(meta: BrandMeta, label: string): BrandMeta {
  const ids = new Set(meta.assetGroups.map((g) => g.id));
  const base = slug(label);
  let id = base;
  for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
  return updateGroups(meta, (gs) => [...gs, { id, label, items: [] }]);
}

export const renameGroup = (meta: BrandMeta, id: string, label: string) => updateGroups(meta, (gs) => gs.map((g) => (g.id === id ? { ...g, label } : g)));
export const moveGroup = (meta: BrandMeta, id: string, dir: number) => updateGroups(meta, (gs) => move(gs, gs.findIndex((g) => g.id === id), dir));
export const removeGroup = (meta: BrandMeta, id: string) => updateGroups(meta, (gs) => gs.filter((g) => g.id !== id));

const inGroup = (meta: BrandMeta, id: string, fn: (items: AssetItem[]) => AssetItem[]) => updateGroups(meta, (gs) => gs.map((g) => (g.id === id ? { ...g, items: fn(g.items) } : g)));
export const addItems = (meta: BrandMeta, id: string, items: AssetItem[]) => inGroup(meta, id, (is) => [...is, ...items]);
export const updateItem = (meta: BrandMeta, id: string, src: string, patch: Partial<AssetItem>) => inGroup(meta, id, (is) => is.map((i) => (i.src === src ? { ...i, ...patch } : i)));
export const moveItem = (meta: BrandMeta, id: string, src: string, dir: number) => inGroup(meta, id, (is) => move(is, is.findIndex((i) => i.src === src), dir));
export const removeItem = (meta: BrandMeta, id: string, src: string) => inGroup(meta, id, (is) => is.filter((i) => i.src !== src));

export function addFontFiles(meta: BrandMeta, entries: FontFile[]): BrandMeta {
  const seen = new Set(meta.fontFiles.map((f) => f.src));
  return { ...meta, fontFiles: [...meta.fontFiles, ...entries.filter((e) => !seen.has(e.src) && seen.add(e.src))] };
}
export const removeFontFile = (meta: BrandMeta, src: string): BrandMeta => ({ ...meta, fontFiles: meta.fontFiles.filter((f) => f.src !== src) });

export function uniquePath(path: string, taken: Set<string>): string {
  const dot = path.lastIndexOf('.');
  const [stem, ext] = dot > path.lastIndexOf('/') ? [path.slice(0, dot), path.slice(dot)] : [path, ''];
  let out = path;
  for (let n = 2; taken.has(out); n++) out = `${stem}-${n}${ext}`;
  return out;
}

const WEIGHT_WORDS: Array<[string, number]> = [['extrabold', 800], ['ultrabold', 800], ['semibold', 600], ['demibold', 600], ['extralight', 200],
  ['ultralight', 200], ['thin', 100], ['light', 300], ['regular', 400], ['medium', 500], ['bold', 700], ['black', 900], ['heavy', 900]];

export function fontFromFileName(name: string): Pick<FontFile, 'family' | 'weight' | 'style'> {
  const stem = name.replace(/\.[^.]+$/, '');
  const [family, variant = ''] = stem.split(/[-]/);
  const v = variant.toLowerCase();
  const weight = WEIGHT_WORDS.find(([w]) => v.includes(w))?.[1] ?? 400;
  return { family: family.replace(/[_]+/g, ' ').trim(), weight, style: v.includes('italic') ? 'italic' : 'normal' };
}
