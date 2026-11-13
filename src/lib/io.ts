import { zipSync, unzipSync } from 'fflate';
import { validateBrandMeta, validateResolver, toResolver } from './schema.js';
import { resolve, contexts, defaultInputs } from './resolver.js';
import { generateCss } from './css.js';
import { checkContrast } from './contrast.js';
import { brandMeta, withBrandMeta, resolveAsset } from './assets.js';
import type { FontProvider } from '../ports.js';
import { extension, fileName, uniquePath } from './path.js';
import { holds, isNode } from './tree.js';
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
export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function classify(name: string): FileKind {
  const n = name.toLowerCase();
  if (n.endsWith('.resolver.json')) return 'resolver';
  if (n.endsWith('.tokens.json') || n.endsWith('.tokens') || n.endsWith('.json')) return 'tokens';
  if (n.endsWith('.zip')) return 'zip';
  if (['woff2', 'woff', 'ttf', 'otf'].includes(extension(n))) return 'font';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'ico'].includes(extension(n))) return 'image';
  return 'file';
}

export const problemText = (problem: Problem) =>
  problem.path ? `${problem.path}: ${problem.message}` : problem.message;

export const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'brand';

const baseName = (file: string) =>
  fileName(file).replace(/\.(resolver|tokens)\.json$|\.tokens$|\.json$/i, '');

export function parseBrandJson(text: string, name: string): { doc: ResolverDoc | null; errors: Problem[] } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { doc: null, errors: [{ path: '', message: `Invalid JSON in ${name}: ${errorMessage(e)}` }] };
  }
  if (!isNode(json)) return { doc: null, errors: [{ path: '', message: `${name} must hold a JSON object` }] };
  const doc = toResolver(json, baseName(name));
  return { doc, errors: checkBrand(doc) };
}

export function checkBrand(doc: ResolverDoc): Problem[] {
  const { errors } = validateResolver(doc);
  if (errors.length) return errors;
  if (!doc.sets?.foundation)
    return [{ path: 'sets', message: 'This site needs the brand tokens in a set named "foundation".' }];
  const ext = doc.sets.foundation.$extensions ?? {};
  for (const [key, meta] of Object.entries(ext)) {
    if (holds(meta, 'assetGroups') || holds(meta, 'fontFiles'))
      errors.push(...validateBrandMeta(meta, `$extensions.${key}`));
  }
  if (errors.length) return errors;
  try {
    const inputs = defaultInputs(doc);
    for (const c of contexts(doc)) resolve(doc, { ...inputs, [c.modifier]: c.context });
    const vendor = Object.keys(ext).find((k) => holds(ext[k], 'fontFiles'));
    generateCss(doc, { vendor, fontSrc: (f) => f.src });
    checkContrast(doc);
  } catch (e) {
    errors.push({ path: (e as { path?: string }).path ?? '', message: errorMessage(e) });
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
      errors: [{ path: '', message: `Not a readable ZIP file (${errorMessage(e)})` }],
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
    const target = uniquePath(`${folder}/${fileName(src)}`, used);
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
    fonts,
    fetchBytes,
    hostedUrl,
  }: {
    vendor: string;
    files: SessionFiles;
    library: Set<string>;
    fonts: FontProvider;
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
    const where = resolveAsset(entry, { session: files, library, fonts });
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
      .filter((f) => f.provider === fonts.id)
      .map((f) => [`fonts/${f.fontsourceId}-LICENSE.txt`, fonts.licenseUrl(f)]),
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
