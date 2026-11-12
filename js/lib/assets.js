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
