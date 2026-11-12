// Brand assets: metadata in the foundation set's $extensions, and where each file comes from.
import { fileUrl } from './fontsource.js';

const META_KEYS = ['assetGroups', 'fontFiles'];
const basename = (p) => p.split('/').pop().toLowerCase();

function metaKey(doc, vendor) {
  const ext = doc.sets?.foundation?.$extensions ?? {};
  if (ext[vendor]) return vendor;
  const others = Object.keys(ext).filter((k) => META_KEYS.some((m) => m in (ext[k] ?? {})));
  return others.length === 1 ? others[0] : null; // a file saved from another origin
}

export function brandMeta(doc, vendor) {
  const key = metaKey(doc, vendor);
  const m = key ? doc.sets.foundation.$extensions[key] : {};
  return { ...m, assetGroups: m.assetGroups ?? [], fontFiles: m.fontFiles ?? [] };
}

export function withBrandMeta(doc, vendor, meta) {
  const out = structuredClone(doc);
  const key = metaKey(doc, vendor);
  const ext = { ...(out.sets.foundation.$extensions ?? {}) };
  if (key && key !== vendor) delete ext[key];
  ext[vendor] = meta;
  out.sets.foundation.$extensions = ext;
  return out;
}

export const allSrcs = (meta) => [
  ...meta.assetGroups.flatMap((g) => g.items.map((entry) => ({ src: entry.src, kind: 'asset', groupId: g.id, entry }))),
  ...meta.fontFiles.map((entry) => ({ src: entry.src, kind: 'font', entry })),
];

// A src is a plain relative path: no scheme, no leading slash, no '..' segments.
const safeSrc = (src) => typeof src === 'string' && src !== '' && !/^[a-z][a-z0-9+.-]*:|^\/|\\/i.test(src)
  && !src.split('/').includes('..');

export function resolveAsset(item, { session, library }) {
  if (!safeSrc(item.src)) return { source: 'missing' };
  if (session.has(item.src)) return { source: 'session' };
  if (library.has(item.src)) return { source: 'library', url: `library/${item.src}` };
  if (item.provider === 'fontsource') return { source: 'fontsource', url: fileUrl(item) };
  return { source: 'missing' };
}

export const missingAssets = (meta, ctx) =>
  allSrcs(meta).filter(({ entry }) => resolveAsset(entry, ctx).source === 'missing').map((s) => s.src);

export function matchDropped(missing, files) {
  const matched = new Map();
  const ambiguous = [];
  const unmatched = [];
  for (const file of files) {
    const candidates = missing.filter((p) => basename(p) === file.name.toLowerCase());
    if (candidates.length === 1) matched.set(candidates[0], file);
    else if (candidates.length > 1) ambiguous.push({ name: file.name, candidates });
    else unmatched.push(file);
  }
  return { matched, ambiguous, unmatched };
}

const GROUP_ID = /^[a-z0-9][a-z0-9-]*$/;
const STYLES = new Set(['normal', 'italic', 'oblique']);

// Brand metadata comes from loaded files; shapes the page relies on are checked here.
export function validateBrandMeta(meta, path = 'brand') {
  const errors = [];
  const err = (p, message) => errors.push({ path: `${path}.${p}`, message });
  if (meta.assetGroups !== undefined && !Array.isArray(meta.assetGroups)) err('assetGroups', 'assetGroups must be an array');
  (Array.isArray(meta.assetGroups) ? meta.assetGroups : []).forEach((g, i) => {
    if (!GROUP_ID.test(g?.id ?? '')) err(`assetGroups[${i}]`, `group id "${g?.id}" must use a-z, 0-9 and -`);
    if (!Array.isArray(g?.items)) { err(`assetGroups[${i}]`, 'group needs an items array'); return; }
    g.items.forEach((item, j) => {
      if (!safeSrc(item?.src)) err(`assetGroups[${i}].items[${j}]`, `src "${item?.src}" must be a relative path`);
    });
  });
  if (meta.fontFiles !== undefined && !Array.isArray(meta.fontFiles)) err('fontFiles', 'fontFiles must be an array');
  (Array.isArray(meta.fontFiles) ? meta.fontFiles : []).forEach((f, i) => {
    if (typeof f?.family !== 'string' || !f.family) err(`fontFiles[${i}]`, 'font file needs a family');
    if (!safeSrc(f?.src)) err(`fontFiles[${i}]`, `src "${f?.src}" must be a relative path`);
    if (f?.weight !== undefined && !(Number(f.weight) >= 1 && Number(f.weight) <= 1000)) err(`fontFiles[${i}]`, 'weight must be 1..1000');
    if (f?.style !== undefined && !STYLES.has(f.style)) err(`fontFiles[${i}]`, 'style must be normal, italic or oblique');
    if (f?.provider === 'fontsource' && !/^[a-z0-9-]+$/.test(f.fontsourceId ?? '')) err(`fontFiles[${i}]`, 'fontsourceId must use a-z, 0-9 and -');
    if (f?.provider === 'fontsource' && !/^[0-9][0-9a-z.-]*$/.test(f.version ?? '')) err(`fontFiles[${i}]`, 'version must look like 5.3.0');
  });
  return errors;
}

// A file saved on another site carries its own vendor key everywhere ($extensions on the set,
// on groups and on tokens). Rename that key to this site's throughout.
export function adoptVendor(doc, vendor) {
  const key = metaKey(doc, vendor);
  if (!key || key === vendor) return doc;
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === '$extensions' && v && typeof v === 'object' && key in v) {
        const { [key]: moved, ...rest } = v;
        out[k] = { ...rest, [vendor]: moved };
      } else out[k] = walk(v);
    }
    return out;
  };
  return walk(doc);
}
