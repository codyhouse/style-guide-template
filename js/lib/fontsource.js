// Fontsource API client (https://fontsource.org): open-source fonts, no API key.
export const API = 'https://api.fontsource.org/v1/fonts';
const CDN = 'https://cdn.jsdelivr.net';
const CACHE_KEY = 'styleguide:fontsource-list';
const DAY = 24 * 60 * 60 * 1000;

export const parseList = (json) => json.map(({ id, family, category, weights, styles, defSubset, license }) =>
  ({ id, family, category, weights, styles, defSubset, license }));

export function fontEntries(detail, { weights, styles, subsets = [detail.defSubset] }) {
  const out = [];
  for (const weight of weights) {
    for (const style of styles) {
      for (const subset of subsets) {
        const url = detail.variants?.[weight]?.[style]?.[subset]?.url?.woff2;
        if (!url) continue;
        out.push({
          family: detail.family, weight, style, subset,
          unicodeRange: detail.unicodeRange?.[subset],
          src: `fonts/${detail.id}-${subset}-${weight}-${style}.woff2`,
          url, provider: 'fontsource', fontsourceId: detail.id, version: detail.npmVersion,
        });
      }
    }
  }
  return out;
}

export const licenseUrl = (id, version) => `${CDN}/npm/@fontsource/${id}@${version}/LICENSE`;

export const fileUrl = (e) =>
  `${CDN}/fontsource/fonts/${e.fontsourceId}@${e.version}/${e.subset}-${e.weight}-${e.style}.woff2`;

async function getJson(url, fetchFn) {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`Fontsource request failed (${res.status}): ${url}`);
  return res.json();
}

export async function fetchList(fetchFn = fetch, storage = globalThis.localStorage) {
  try {
    const cached = JSON.parse(storage?.getItem(CACHE_KEY) ?? 'null');
    if (cached && Date.now() - cached.at < DAY) return cached.list;
  } catch { /* a corrupt cache entry is refetched */ }
  const list = parseList(await getJson(API, fetchFn));
  try { storage?.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), list })); } catch { /* cache is optional */ }
  return list;
}

export const fetchFont = (id, fetchFn = fetch) => getJson(`${API}/${encodeURIComponent(id)}`, fetchFn);
