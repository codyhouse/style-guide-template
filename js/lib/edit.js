// Pure edit operations used by the editor. Each returns a new document or meta.
import { anchoredScale } from './color.js';
import { slug } from './io.js';

const clone = (x) => structuredClone(x);
export const foundation = (doc) => doc.sets.foundation.sources[0];

function setIn(tree, path, value) {
  const keys = path.split('.');
  let node = tree;
  for (const k of keys.slice(0, -1)) node = node[k] ??= {};
  node[keys.at(-1)] = value;
}

export function setToken(doc, path, token) {
  const out = clone(doc);
  setIn(foundation(out), path, token);
  return out;
}

// The typed color is kept as one shade (recorded as the group's base); the rest are generated.
export function setHue(doc, hue, color, vendor) {
  const out = clone(doc);
  const { scale, anchor } = anchoredScale(color);
  const group = (foundation(out).color[hue] ??= {});
  for (const [shade, value] of Object.entries(scale)) group[shade] = { ...group[shade], $value: value };
  if (vendor) group.$extensions = { ...group.$extensions, [vendor]: { ...group.$extensions?.[vendor], base: anchor } };
  return out;
}

export function removeHue(doc, hue) {
  const out = clone(doc);
  delete foundation(out).color[hue];
  return out;
}

// Role edits apply to the theme being previewed: light is the foundation, others are context overrides.
export function setRole(doc, theme, rolePath, alias) {
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

function getIn(tree, path) {
  return path.split('.').reduce((n, k) => n?.[k], tree);
}

const updateGroups = (meta, fn) => ({ ...meta, assetGroups: fn(meta.assetGroups.map((g) => ({ ...g, items: [...g.items] }))) });
const move = (list, i, dir) => {
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  [list[i], list[j]] = [list[j], list[i]];
  return list;
};

export function addGroup(meta, label) {
  const ids = new Set(meta.assetGroups.map((g) => g.id));
  const base = slug(label);
  let id = base;
  for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
  return updateGroups(meta, (gs) => [...gs, { id, label, items: [] }]);
}

export const renameGroup = (meta, id, label) => updateGroups(meta, (gs) => gs.map((g) => (g.id === id ? { ...g, label } : g)));
export const moveGroup = (meta, id, dir) => updateGroups(meta, (gs) => move(gs, gs.findIndex((g) => g.id === id), dir));
export const removeGroup = (meta, id) => updateGroups(meta, (gs) => gs.filter((g) => g.id !== id));

const inGroup = (meta, id, fn) => updateGroups(meta, (gs) => gs.map((g) => (g.id === id ? { ...g, items: fn(g.items) } : g)));
export const addItems = (meta, id, items) => inGroup(meta, id, (is) => [...is, ...items]);
export const updateItem = (meta, id, src, patch) => inGroup(meta, id, (is) => is.map((i) => (i.src === src ? { ...i, ...patch } : i)));
export const moveItem = (meta, id, src, dir) => inGroup(meta, id, (is) => move(is, is.findIndex((i) => i.src === src), dir));
export const removeItem = (meta, id, src) => inGroup(meta, id, (is) => is.filter((i) => i.src !== src));

export function addFontFiles(meta, entries) {
  const seen = new Set(meta.fontFiles.map((f) => f.src));
  return { ...meta, fontFiles: [...meta.fontFiles, ...entries.filter((e) => !seen.has(e.src) && seen.add(e.src))] };
}
export const removeFontFile = (meta, src) => ({ ...meta, fontFiles: meta.fontFiles.filter((f) => f.src !== src) });

export function uniquePath(path, taken) {
  const dot = path.lastIndexOf('.');
  const [stem, ext] = dot > path.lastIndexOf('/') ? [path.slice(0, dot), path.slice(dot)] : [path, ''];
  let out = path;
  for (let n = 2; taken.has(out); n++) out = `${stem}-${n}${ext}`;
  return out;
}

const WEIGHT_WORDS = [['extrabold', 800], ['ultrabold', 800], ['semibold', 600], ['demibold', 600], ['extralight', 200],
  ['ultralight', 200], ['thin', 100], ['light', 300], ['regular', 400], ['medium', 500], ['bold', 700], ['black', 900], ['heavy', 900]];

export function fontFromFileName(name) {
  const stem = name.replace(/\.[^.]+$/, '');
  const [family, variant = ''] = stem.split(/[-]/);
  const v = variant.toLowerCase();
  const weight = WEIGHT_WORDS.find(([w]) => v.includes(w))?.[1] ?? 400;
  return { family: family.replace(/[_]+/g, ' ').trim(), weight, style: v.includes('italic') ? 'italic' : 'normal' };
}
