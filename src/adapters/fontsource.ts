import * as z from 'zod/mini';
import type { FontPicks, FontProvider, KeyValueStore } from '../ports.js';
import { fontDetail, fontListing, isFontStyle } from '../lib/schema.js';
import type { FontDetail, FontFile, FontListing } from '../lib/types.js';

type Fetch = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

const API = 'https://api.fontsource.org/v1/fonts';
const CDN = 'https://cdn.jsdelivr.net';
const CACHE_KEY = 'styleguide:fontsource-list';
const DAY = 24 * 60 * 60 * 1000;

const cachedListing = z.object({ at: z.number(), list: z.unknown() });

export const parseList = (json: unknown): FontListing[] =>
  (Array.isArray(json) ? json : []).flatMap((f) => {
    const r = z.safeParse(fontListing, f);
    return r.success ? [r.data] : [];
  });

export function fontFiles(detail: FontDetail, { weights, styles, subsets }: FontPicks): FontFile[] {
  return weights.flatMap((weight) =>
    styles.filter(isFontStyle).flatMap((style) =>
      subsets
        .filter((subset) => detail.variants?.[weight]?.[style]?.[subset]?.url?.woff2)
        .map((subset) => ({
          family: detail.family,
          weight,
          style,
          subset,
          unicodeRange: detail.unicodeRange?.[subset],
          src: `fonts/${detail.id}-${subset}-${weight}-${style}.woff2`,
          provider: 'fontsource',
          fontsourceId: detail.id,
          version: detail.npmVersion,
        })),
    ),
  );
}

const fileUrl = (file: Partial<FontFile>) =>
  `${CDN}/fontsource/fonts/${file.fontsourceId}@${file.version}/${file.subset}-${file.weight}-${file.style}.woff2`;

const licenseUrl = (file: Partial<FontFile>) =>
  `${CDN}/npm/@fontsource/${file.fontsourceId}@${file.version}/LICENSE`;

function cachedList(cache: KeyValueStore | undefined): FontListing[] | null {
  try {
    const cached = z.safeParse(cachedListing, JSON.parse(cache?.getItem(CACHE_KEY) ?? 'null'));
    return cached.success && Date.now() - cached.data.at < DAY ? parseList(cached.data.list) : null;
  } catch {
    return null;
  }
}

export function fontsource({ fetch: fetchFn = fetch, cache }: { fetch?: Fetch; cache?: KeyValueStore } = {}) {
  async function getJson(url: string): Promise<unknown> {
    const res = await fetchFn(url);
    if (!res.ok) throw new Error(`Fontsource request failed (${res.status}): ${url}`);
    return res.json();
  }

  const provider: FontProvider = {
    id: 'fontsource',
    name: 'Fontsource',
    async list() {
      const cached = cachedList(cache);
      if (cached) return cached;
      const list = parseList(await getJson(API));
      try {
        cache?.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), list }));
      } catch {
        cache?.removeItem(CACHE_KEY);
      }
      return list;
    },
    font: async (id) => z.parse(fontDetail, await getJson(`${API}/${encodeURIComponent(id)}`)),
    files: fontFiles,
    fileUrl,
    licenseUrl,
  };
  return provider;
}
