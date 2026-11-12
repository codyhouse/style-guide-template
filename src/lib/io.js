// Loading brand files and ZIPs, saving JSON, and exporting the brand kit ZIP.
import { zipSync, unzipSync } from 'fflate';
import { validateResolver, toResolver } from './schema.js';
import { resolve, contexts, defaultInputs } from './resolver.js';
import { generateCss } from './css.js';
import { checkContrast } from './contrast.js';
import { licenseUrl } from './fontsource.js';
import { brandMeta, withBrandMeta, resolveAsset, validateBrandMeta } from './assets.js';

const ext = (name) => name.toLowerCase().split('.').pop();

export function classify(name) {
  const n = name.toLowerCase();
  if (n.endsWith('.resolver.json')) return 'resolver';
  if (n.endsWith('.tokens.json') || n.endsWith('.tokens') || n.endsWith('.json')) return 'tokens';
  if (n.endsWith('.zip')) return 'zip';
  if (['woff2', 'woff', 'ttf', 'otf'].includes(ext(n))) return 'font';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'ico'].includes(ext(n))) return 'image';
  return 'file';
}

export const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'brand';

const baseName = (file) => file.split('/').pop().replace(/\.(resolver|tokens)\.json$|\.tokens$|\.json$/i, '');

export function parseBrandJson(text, name) {
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { doc: null, errors: [{ path: '', message: `Invalid JSON in ${name}: ${e.message}` }] };
  }
  const doc = toResolver(json, baseName(name));
  return { doc, errors: checkBrand(doc) };
}

// Everything the page does with a brand runs here once, in every theme: a brand that passes also renders.
export function checkBrand(doc) {
  const { errors } = validateResolver(doc);
  if (errors.length) return errors;
  if (!doc.sets?.foundation) return [{ path: 'sets', message: 'This site needs the brand tokens in a set named "foundation".' }];
  const ext = doc.sets.foundation.$extensions ?? {};
  for (const [key, meta] of Object.entries(ext)) {
    if (meta && typeof meta === 'object' && ('assetGroups' in meta || 'fontFiles' in meta)) errors.push(...validateBrandMeta(meta, `$extensions.${key}`));
  }
  if (errors.length) return errors;
  try {
    const inputs = defaultInputs(doc);
    for (const c of contexts(doc)) resolve(doc, { ...inputs, [c.modifier]: c.context });
    const vendor = Object.keys(ext).find((k) => 'fontFiles' in (ext[k] ?? {}));
    generateCss(doc, { vendor, fontSrc: (f) => f.src });
    checkContrast(doc);
  } catch (e) {
    errors.push({ path: e.path ?? '', message: e.message });
  }
  return errors;
}

export function loadZip(bytes) {
  let entries;
  try {
    entries = unzipSync(bytes);
  } catch (e) {
    return { doc: null, files: new Map(), errors: [{ path: '', message: `Not a readable ZIP file (${e.message})` }] };
  }
  const names = Object.keys(entries).filter((n) => !n.includes('/'));
  const brand = names.find((n) => classify(n) === 'resolver') ?? names.find((n) => /\.tokens(\.json)?$/i.test(n));
  if (!brand) return { doc: null, files: new Map(), errors: [{ path: '', message: 'The ZIP has no .resolver.json or .tokens.json at its root' }] };
  const { doc, errors } = parseBrandJson(new TextDecoder().decode(entries[brand]), brand);
  const files = new Map(Object.entries(entries)
    .filter(([n]) => n !== brand && n !== 'README.md' && !n.startsWith('css/') && !n.endsWith('/')));
  return { doc, files, errors };
}

export const saveJson = (doc) => `${JSON.stringify(doc, null, 2)}\n`;

export function exportLayout(meta) {
  const layout = new Map();
  const used = new Set();
  const place = (src, folder) => {
    const file = src.split('/').pop();
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

export function readme(doc, { hostedUrl, contrast, missing, failedDownloads }) {
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
    ...contrast.map((r) => `| ${r.context} | ${r.label} | ${r.ratio} | ${r.min} | ${r.pass ? 'pass' : 'warning'} |`),
  ];
  if (missing.length) lines.push('', '## Missing files', '', ...missing.map((m) => `- \`${m}\``));
  if (failedDownloads.length) lines.push('', '## Files that could not be downloaded', '', ...failedDownloads.map((m) => `- \`${m}\``));
  return `${lines.join('\n')}\n`;
}

const toBytes = async (data) => (data instanceof Uint8Array ? data : new Uint8Array(await data.arrayBuffer()));

export async function buildExport(doc, { vendor, files, library, fetchBytes, hostedUrl }) {
  const meta = brandMeta(doc, vendor);
  const layout = exportLayout(meta);
  const out = {};
  const missing = [];
  const failedDownloads = [];

  const collect = async (entry) => {
    const where = resolveAsset(entry, { session: files, library });
    const target = layout.get(entry.src);
    try {
      if (where.source === 'missing') { missing.push(entry.src); return; }
      out[target] = where.source === 'session' ? await toBytes(files.get(entry.src)) : await fetchBytes(where.url);
    } catch {
      failedDownloads.push(target);
    }
  };
  await Promise.all([...meta.assetGroups.flatMap((g) => g.items), ...meta.fontFiles].map(collect));

  const licenses = new Map(meta.fontFiles.filter((f) => f.provider === 'fontsource')
    .map((f) => [`fonts/${f.fontsourceId}-LICENSE.txt`, licenseUrl(f.fontsourceId, f.version)]));
  await Promise.all([...licenses].map(async ([target, url]) => {
    try { out[target] = await fetchBytes(url); } catch { failedDownloads.push(target); }
  }));

  const moved = {
    ...meta,
    assetGroups: meta.assetGroups.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, src: layout.get(i.src) })) })),
    fontFiles: meta.fontFiles.map((f) => ({ ...f, src: layout.get(f.src) })),
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
    ...contrast.filter((r) => !r.pass).map((r) => `Contrast ${r.context}: ${r.label} is ${r.ratio}:1 (minimum ${r.min}:1)`),
  ];
  return { zip: zipSync(out), warnings };
}
