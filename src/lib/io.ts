import { zipSync, unzipSync } from 'fflate';
import { validateBrandMeta, validateResolver, toResolver } from './schema.js';
import { resolve, contexts, defaultInputs } from './resolver.js';
import { generateCss } from './css.js';
import { checkContrast } from './contrast.js';
import { licenseUrl } from './fontsource.js';
import { brandMeta, withBrandMeta, resolveAsset } from './assets.js';
import { extension, fileName } from './path.js';
import type {
  AssetItem,
  BrandMeta,
  ContrastResult,
  FileData,
  Problem,
  ResolverDoc,
  SessionFiles,
} from './types.js';

export type FileKind = 'resolver' | 'tokens' | 'zip' | 'font' | 'image' | 'file';
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function classify(name: string): FileKind {
  const n = name.toLowerCase();
  if (n.endsWith('.resolver.json')) return 'resolver';
  if (n.endsWith('.tokens.json') || n.endsWith('.tokens') || n.endsWith('.json')) return 'tokens';
  if (n.endsWith('.zip')) return 'zip';
  if (['woff2', 'woff', 'ttf', 'otf'].includes(extension(n))) return 'font';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'ico'].includes(extension(n))) return 'image';
  return 'file';
}

export const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'brand';

const baseName = (file: string) =>
  fileName(file).replace(/\.(resolver|tokens)\.json$|\.tokens$|\.json$/i, '');

export function parseBrandJson(text: string, name: string): { doc: ResolverDoc | null; errors: Problem[] } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { doc: null, errors: [{ path: '', message: `Invalid JSON in ${name}: ${message(e)}` }] };
  }
  const doc = toResolver(json, baseName(name));
  return { doc, errors: checkBrand(doc) };
}

// Everything the page does with a brand runs here once, in every theme: a brand that passes also renders.
export function checkBrand(doc: ResolverDoc): Problem[] {
  const { errors } = validateResolver(doc);
  if (errors.length) return errors;
  if (!doc.sets?.foundation)
    return [{ path: 'sets', message: 'This site needs the brand tokens in a set named "foundation".' }];
  const ext = doc.sets.foundation.$extensions ?? {};
  for (const [key, meta] of Object.entries(ext)) {
    if (meta && typeof meta === 'object' && ('assetGroups' in meta || 'fontFiles' in meta))
      errors.push(...validateBrandMeta(meta, `$extensions.${key}`));
  }
  if (errors.length) return errors;
  try {
    const inputs = defaultInputs(doc);
    for (const c of contexts(doc)) resolve(doc, { ...inputs, [c.modifier]: c.context });
    const vendor = Object.keys(ext).find((k) => 'fontFiles' in (ext[k] ?? {}));
    generateCss(doc, { vendor, fontSrc: (f) => f.src });
    checkContrast(doc);
  } catch (e) {
    errors.push({ path: (e as { path?: string }).path ?? '', message: message(e) });
  }
  return errors;
}

export function loadZip(bytes: Uint8Array): {
  doc: ResolverDoc | null;
  files: SessionFiles;
  errors: Problem[];
} {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch (e) {
    return {
      doc: null,
      files: new Map(),
      errors: [{ path: '', message: `Not a readable ZIP file (${message(e)})` }],
    };
  }
  const names = Object.keys(entries).filter((n) => !n.includes('/'));
  const brand =
    names.find((n) => classify(n) === 'resolver') ?? names.find((n) => /\.tokens(\.json)?$/i.test(n));
  if (!brand)
    return {
      doc: null,
      files: new Map(),
      errors: [{ path: '', message: 'The ZIP has no .resolver.json or .tokens.json at its root' }],
    };
  const { doc, errors } = parseBrandJson(new TextDecoder().decode(entries[brand]), brand);
  const files: SessionFiles = new Map(
    Object.entries(entries).filter(
      ([n]) => n !== brand && n !== 'README.md' && !n.startsWith('css/') && !n.endsWith('/'),
    ),
  );
  return { doc, files, errors };
}

export const saveJson = (doc: ResolverDoc) => `${JSON.stringify(doc, null, 2)}\n`;

export function exportLayout(meta: BrandMeta): Map<string, string> {
  const layout = new Map<string, string>();
  const used = new Set<string>();
  const place = (src: string, folder: string) => {
    const file = fileName(src);
    const dot = file.lastIndexOf('.');
    const [stem, extn] = dot > 0 ? [file.slice(0, dot), file.slice(dot)] : [file, ''];
    let target = `${folder}/${file}`;
    for (let n = 2; used.has(target); n++) target = `${folder}/${stem}-${n}${extn}`;
    used.add(target);
    layout.set(src, target);
  };
  for (const g of meta.assetGroups) for (const item of g.items) place(item.src, g.id);
  for (const f of meta.fontFiles) place(f.src, 'fonts');
  return layout;
}

export function readme(
  doc: ResolverDoc,
  {
    hostedUrl,
    contrast,
    missing,
    failedDownloads,
  }: { hostedUrl: string; contrast: ContrastResult[]; missing: string[]; failedDownloads: string[] },
): string {
  const file = `${slug(doc.name ?? 'brand')}.resolver.json`;
  const lines = [
    `# ${doc.name ?? 'Brand'}`,
    '',
    `View this brand at ${hostedUrl}: open the site and drop this ZIP or \`${file}\` onto the page.`,
    '',
    '## Contents',
    '',
    `- \`${file}\`: the brand as a W3C Design Tokens (DTCG 2025.10) resolver file`,
    '- `css/theme.css`: CSS custom properties for light and dark, plus `@font-face` rules',
    '- `fonts/`: font files with their licenses',
    '- one folder per asset group',
    '',
    '## Contrast',
    '',
    '| Theme | Pair | Ratio | Minimum | Result |',
    '|---|---|---|---|---|',
    ...contrast.map(
      (r) => `| ${r.context} | ${r.label} | ${r.ratio} | ${r.min} | ${r.pass ? 'pass' : 'warning'} |`,
    ),
  ];
  if (missing.length) lines.push('', '## Missing files', '', ...missing.map((m) => `- \`${m}\``));
  if (failedDownloads.length)
    lines.push('', '## Files that could not be downloaded', '', ...failedDownloads.map((m) => `- \`${m}\``));
  return `${lines.join('\n')}\n`;
}

const toBytes = async (data: FileData) =>
  data instanceof Uint8Array ? data : new Uint8Array(await data.arrayBuffer());

export async function buildExport(
  doc: ResolverDoc,
  {
    vendor,
    files,
    library,
    fetchBytes,
    hostedUrl,
  }: {
    vendor: string;
    files: SessionFiles;
    library: Set<string>;
    fetchBytes: (url: string) => Promise<Uint8Array>;
    hostedUrl: string;
  },
): Promise<{ zip: Uint8Array; warnings: string[] }> {
  const meta = brandMeta(doc, vendor);
  const layout = exportLayout(meta);
  const out: Record<string, Uint8Array> = {};
  const missing: string[] = [];
  const failedDownloads: string[] = [];

  const placed = (src: string) => layout.get(src) ?? src;
  const collect = async (entry: AssetItem) => {
    const where = resolveAsset(entry, { session: files, library });
    const target = placed(entry.src);
    const data = where.source === 'session' ? files.get(entry.src) : undefined;
    try {
      if (data) out[target] = await toBytes(data);
      else if (where.url) out[target] = await fetchBytes(where.url);
      else missing.push(entry.src);
    } catch {
      failedDownloads.push(target);
    }
  };
  await Promise.all([...meta.assetGroups.flatMap((g) => g.items), ...meta.fontFiles].map(collect));

  const licenses = new Map(
    meta.fontFiles
      .filter((f) => f.provider === 'fontsource')
      .map((f) => [`fonts/${f.fontsourceId}-LICENSE.txt`, licenseUrl(f.fontsourceId, f.version)]),
  );
  await Promise.all(
    [...licenses].map(async ([target, url]) => {
      try {
        out[target] = await fetchBytes(url);
      } catch {
        failedDownloads.push(target);
      }
    }),
  );

  const moved = {
    ...meta,
    assetGroups: meta.assetGroups.map((g) => ({
      ...g,
      items: g.items.map((i) => ({ ...i, src: placed(i.src) })),
    })),
    fontFiles: meta.fontFiles.map((f) => ({ ...f, src: placed(f.src) })),
  };
  const outDoc = withBrandMeta(doc, vendor, moved);
  const name = slug(doc.name ?? 'brand');
  const enc = new TextEncoder();
  const contrast = checkContrast(doc);
  out[`${name}.resolver.json`] = enc.encode(saveJson(outDoc));
  out['css/theme.css'] = enc.encode(generateCss(outDoc, { vendor, fontSrc: (f) => `../${f.src}` }));
  out['README.md'] = enc.encode(readme(doc, { hostedUrl, contrast, missing, failedDownloads }));

  const warnings = [
    ...missing.map((m) => `Missing file: ${m}`),
    ...failedDownloads.map((m) => `Could not download: ${m}`),
    ...contrast
      .filter((r) => !r.pass)
      .map((r) => `Contrast ${r.context}: ${r.label} is ${r.ratio}:1 (minimum ${r.min}:1)`),
  ];
  return { zip: zipSync(out), warnings };
}
