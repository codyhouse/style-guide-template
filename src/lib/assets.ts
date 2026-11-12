// Brand assets: metadata in the foundation set's $extensions, and where each file comes from.
import { fileUrl } from './fontsource.js';
import * as z from 'zod/mini';
import { fileName } from './path.js';
import { brandMeta as brandMetaSchema, isSafeSrc } from './schema.js';
import type { AssetContext, AssetItem, BrandMeta, FontFile, ResolverDoc, SessionFiles } from './types.js';

export type AssetSource = 'session' | 'library' | 'fontsource' | 'missing';
export type SrcEntry =
  | { src: string; kind: 'asset'; groupId: string; entry: AssetItem }
  | { src: string; kind: 'font'; entry: FontFile };

const META_KEYS = ['assetGroups', 'fontFiles'];
const basename = (p: string) => fileName(p).toLowerCase();

function metaKey(doc: ResolverDoc, vendor: string): string | null {
  const ext = doc.sets?.foundation?.$extensions ?? {};
  if (ext[vendor]) return vendor;
  const others = Object.keys(ext).filter((k) => META_KEYS.some((m) => m in (ext[k] ?? {})));
  return others.length === 1 ? others[0] : null; // a file saved from another origin
}

export function brandMeta(doc: ResolverDoc, vendor: string): BrandMeta {
  const key = metaKey(doc, vendor);
  // checked when the brand was loaded (io.checkBrand); parsing fills in defaults such as a font's weight
  return z.parse(brandMetaSchema, (key && doc.sets.foundation.$extensions?.[key]) || {});
}

export function withBrandMeta(doc: ResolverDoc, vendor: string, meta: BrandMeta): ResolverDoc {
  const out = structuredClone(doc);
  const key = metaKey(doc, vendor);
  const foreign = key !== vendor ? key : null; // metadata saved by another site moves to this site's key
  const kept = Object.entries(out.sets.foundation.$extensions ?? {}).filter(([k]) => k !== foreign);
  const ext = { ...Object.fromEntries(kept), [vendor]: meta };
  out.sets.foundation.$extensions = ext;
  return out;
}

export const allSrcs = (meta: BrandMeta): SrcEntry[] => [
  ...meta.assetGroups.flatMap((g) =>
    g.items.map((entry) => ({ src: entry.src, kind: 'asset' as const, groupId: g.id, entry })),
  ),
  ...meta.fontFiles.map((entry) => ({ src: entry.src, kind: 'font' as const, entry })),
];

export function resolveAsset(
  item: AssetItem,
  { session, library }: AssetContext,
): { source: AssetSource; url?: string } {
  if (!isSafeSrc(item.src)) return { source: 'missing' };
  if (session.has(item.src)) return { source: 'session' };
  if (library.has(item.src)) return { source: 'library', url: `library/${item.src}` };
  if (item.provider === 'fontsource') return { source: 'fontsource', url: fileUrl(item as FontFile) };
  return { source: 'missing' };
}

export const missingAssets = (meta: BrandMeta, ctx: AssetContext): string[] =>
  allSrcs(meta)
    .filter(({ entry }) => resolveAsset(entry, ctx).source === 'missing')
    .map((s) => s.src);

export function matchDropped(missing: string[], files: File[]) {
  const matched: SessionFiles = new Map();
  const ambiguous: Array<{ name: string; candidates: string[] }> = [];
  const unmatched: File[] = [];
  for (const file of files) {
    const candidates = missing.filter((p) => basename(p) === file.name.toLowerCase());
    if (candidates.length === 1) matched.set(candidates[0], file);
    else if (candidates.length > 1) ambiguous.push({ name: file.name, candidates });
    else unmatched.push(file);
  }
  return { matched, ambiguous, unmatched };
}

// A file saved on another site carries its own vendor key everywhere ($extensions on the set,
// on groups and on tokens). Rename that key to this site's throughout.
export function adoptVendor(doc: ResolverDoc, vendor: string): ResolverDoc {
  const key = metaKey(doc, vendor);
  if (!key || key === vendor) return doc;
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === '$extensions' && v && typeof v === 'object' && key in v) {
        const { [key]: moved, ...rest } = v as Record<string, unknown>;
        out[k] = { ...rest, [vendor]: moved };
      } else out[k] = walk(v);
    }
    return out;
  };
  return walk(doc) as ResolverDoc;
}
