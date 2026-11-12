// Fontsource API client (https://fontsource.org): open-source fonts, no API key.
import * as z from 'zod/mini';
import {
  fontDetail,
  fontListing,
  isFontStyle,
  type FontDetail,
  type FontFile,
  type FontListing,
} from './schema.js';

export type FontsourceEntry = FontFile & { url: string };

// only these parts of a fetch Response are read
type Fetch = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

export const API = 'https://api.fontsource.org/v1/fonts';
const CDN = 'https://cdn.jsdelivr.net';
const CACHE_KEY = 'styleguide:fontsource-list';
const DAY = 24 * 60 * 60 * 1000;

// One malformed family in the catalog is skipped, not a reason to lose the whole list.
export const parseList = (json: unknown): FontListing[] =>
  (Array.isArray(json) ? json : []).flatMap((f) => {
    const r = z.safeParse(fontListing, f);
    return r.success ? [r.data] : [];
  });

export function fontEntries(
  detail: FontDetail,
  {
    weights,
    styles,
    subsets = [detail.defSubset],
  }: { weights: number[]; styles: string[]; subsets?: string[] },
): FontsourceEntry[] {
  const out: FontsourceEntry[] = [];
  for (const weight of weights) {
    for (const style of styles.filter(isFontStyle)) {
      for (const subset of subsets) {
        const url = detail.variants?.[weight]?.[style]?.[subset]?.url?.woff2;
        if (!url) continue;
        out.push({
          family: detail.family,
          weight,
          style,
          subset,
          unicodeRange: detail.unicodeRange?.[subset],
          src: `fonts/${detail.id}-${subset}-${weight}-${style}.woff2`,
          url,
          provider: 'fontsource',
          fontsourceId: detail.id,
          version: detail.npmVersion,
        });
      }
    }
  }
  return out;
}

export const licenseUrl = (id?: string, version?: string) =>
  `${CDN}/npm/@fontsource/${id}@${version}/LICENSE`;

export const fileUrl = (e: Partial<FontFile>) =>
  `${CDN}/fontsource/fonts/${e.fontsourceId}@${e.version}/${e.subset}-${e.weight}-${e.style}.woff2`;

async function getJson(url: string, fetchFn: Fetch): Promise<unknown> {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`Fontsource request failed (${res.status}): ${url}`);
  return res.json();
}

export async function fetchList(
  fetchFn: Fetch = fetch,
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage,
): Promise<FontListing[]> {
  try {
    const cached = JSON.parse(storage?.getItem(CACHE_KEY) ?? 'null');
    if (cached && Date.now() - cached.at < DAY) return parseList(cached.list);
  } catch {
    /* a corrupt cache entry is refetched */
  }
  const list = parseList(await getJson(API, fetchFn));
  try {
    storage?.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), list }));
  } catch {
    /* cache is optional */
  }
  return list;
}

export const fetchFont = async (id: string, fetchFn: Fetch = fetch): Promise<FontDetail> =>
  z.parse(fontDetail, await getJson(`${API}/${encodeURIComponent(id)}`, fetchFn));
