import * as z from 'zod/mini';
import { holds, isNode } from './tree.js';
import { fileName } from './path.js';
import { brandMeta as brandMetaSchema, isSafeSrc } from './schema.js';
import type { AssetContext, AssetItem, BrandMeta, FontFile, ResolverDoc, SessionFiles } from './types.js';

export type AssetSource = 'session' | 'library' | 'provider' | 'missing';
export type SrcEntry =
  | { src: string; kind: 'asset'; groupId: string; entry: AssetItem }
  | { src: string; kind: 'font'; entry: FontFile };

const META_KEYS = ['assetGroups', 'fontFiles'];
const basename = (p: string) => fileName(p).toLowerCase();

function metaKey(doc: ResolverDoc, vendor: string): string | null {
  const ext = doc.sets?.foundation?.$extensions ?? {};
  if (ext[vendor]) return vendor;
  const others = Object.keys(ext).filter((k) => META_KEYS.some((m) => holds(ext[k], m)));
  return others.length === 1 ? others[0] : null;
}

export function brandMeta(doc: ResolverDoc, vendor: string): BrandMeta {
  const key = metaKey(doc, vendor);
  return z.parse(brandMetaSchema, (key && doc.sets.foundation.$extensions?.[key]) || {});
}

export function withBrandMeta(doc: ResolverDoc, vendor: string, meta: BrandMeta): ResolverDoc {
  const out = structuredClone(doc);
  const key = metaKey(doc, vendor);
  const foreign = key !== vendor ? key : null;
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
  { session, library, fonts }: AssetContext,
): { source: AssetSource; url?: string } {
  if (!isSafeSrc(item.src)) return { source: 'missing' };
  if (session.has(item.src)) return { source: 'session' };
  if (library.has(item.src)) return { source: 'library', url: `library/${item.src}` };
  if (item.provider === fonts.id) return { source: 'provider', url: fonts.fileUrl(item as FontFile) };
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

export function adoptVendor(doc: ResolverDoc, vendor: string): ResolverDoc {
  const key = metaKey(doc, vendor);
  if (!key || key === vendor) return doc;
  const out = structuredClone(doc);
  const visit = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(visit);
    if (!isNode(node)) return;
    if (node.$extensions && key in node.$extensions) {
      const { [key]: moved, ...rest } = node.$extensions;
      node.$extensions = { ...rest, [vendor]: moved };
    }
    for (const [k, v] of Object.entries(node)) if (k !== '$extensions') visit(v);
  };
  visit(out);
  return out;
}
