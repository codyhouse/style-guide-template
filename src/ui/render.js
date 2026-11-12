// The guide: every section rendered from the brand document, and the nav built from the same list.
import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { styleMap } from 'lit-html/directives/style-map.js';
import { icon } from './dom.js';
import { panelsView } from './panels.js';
import { resolveAsset } from '../lib/assets.js';
import { toHex, toRgbaString, toOklchString, cmyk } from '../lib/color.js';
import { cssName, cssValue, generateCss } from '../lib/css.js';
import { tailwindCss, shadcnCss } from '../lib/exports.js';
import { cssString } from '../lib/fonts.js';
import { ROLES } from '../lib/contrast.js';

const BUILT_IN_GROUPS = new Set(['logos', 'favicons', 'icons']);
const MIME = {
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  avif: 'image/avif', ico: 'image/x-icon', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf',
  pdf: 'application/pdf',
};
const IMAGE = new Set(['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico']);
const extOf = (path) => path.split('.').pop().toLowerCase();

const urls = new Map();
export function objectUrl(path, data) {
  const cached = urls.get(path);
  if (cached?.data === data) return cached.url;
  if (cached) URL.revokeObjectURL(cached.url);
  const blob = data instanceof Blob ? data : new Blob([data], { type: MIME[extOf(path)] ?? 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  urls.set(path, { data, url });
  return url;
}

// Downloads of session files are served as plain bytes, so an uploaded SVG never runs as a page.
const downloads = new Map();
function downloadUrl(path, data) {
  const cached = downloads.get(path);
  if (cached?.data === data) return cached.url;
  if (cached) URL.revokeObjectURL(cached.url);
  const url = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
  downloads.set(path, { data, url });
  return url;
}

export function urlFor(entry, ctx) {
  const where = resolveAsset(entry, ctx);
  if (where.source === 'session') return objectUrl(entry.src, ctx.session.get(entry.src));
  return where.url ?? null;
}

const dim = (v) => (v && typeof v === 'object' ? `${v.value}${v.unit}` : String(v));
// 9999px and up is the convention for fully round
const radiusText = (v) => (v.value * (v.unit === 'rem' ? 16 : 1) >= 9999 ? 'full' : dim(v));
const tokenLabel = (path, value) => html`<code>${cssName(path)}</code>${value ? html` <span class="cd-token-value">${value}</span>` : nothing}`;
const sizeOf = (data) => (data ? (data.size ?? data.byteLength) : null);
const formatSize = (n) => (n === null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const group = (meta, id) => meta.assetGroups.find((g) => g.id === id) ?? { items: [] };

const missing = (src) => html`<div class="cd-missing">${icon('alert')}<span>Missing file</span><code>${src}</code></div>`;

function image(item, ctx, alt = item.label ?? '') {
  const url = urlFor(item, ctx);
  return url ? html`<img src=${url} alt=${alt}>` : missing(item.src);
}

function fileView(item, ctx) {
  const url = urlFor(item, ctx);
  if (!url) return html`<figure class="cd-file">${missing(item.src)}<figcaption>${item.label}</figcaption></figure>`;
  const ext = extOf(item.src);
  const name = item.src.split('/').pop();
  const data = ctx.session.get(item.src);
  return html`<figure class="cd-file">
    ${IMAGE.has(ext) ? html`<img src=${url} alt=${item.label ?? name}>` : html`<div class="cd-file-card" aria-hidden="true">${ext}</div>`}
    <figcaption>
      <b>${item.label ?? name}</b>
      ${item.description ? html`<small>${item.description}</small>` : nothing}
      <small>${`${name} ${ext.toUpperCase()} ${formatSize(sizeOf(data))}`.trim()}</small>
      <a href=${data ? downloadUrl(item.src, data) : url} download=${name}>Download</a>
    </figcaption>
  </figure>`;
}

// Click to copy: the button briefly says "Copied" in its live region. That span has no binding,
// so a re-render in the meantime leaves the message alone.
async function copy(e, text) {
  const status = e.currentTarget.querySelector('.cd-copy-status');
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Copied';
  } catch {
    status.textContent = 'Copy failed';
  }
  setTimeout(() => { status.textContent = ''; }, 1500);
}

const copyable = (text, content, { cls = 'cd-copy', label, tabindex, title = `Copy ${text}` } = {}) => html`<button type="button"
  class=${cls} title=${title} aria-label=${label ?? nothing} tabindex=${tabindex ?? nothing} @click=${(e) => copy(e, text)}
  >${content}<span class="cd-copy-status" aria-live="polite"></span></button>`;

function swatch(path, token, vendor, first) {
  const ext = token.extensions?.[vendor] ?? {};
  const c = token.resolved;
  const name = path.replace(/^color\./, '').replace('.', '-');
  const hex = toHex(c);
  const cmykText = `CMYK ${(Array.isArray(ext.cmyk) ? ext.cmyk : cmyk(c)).join(' ')}`;
  // value lines copy on click; keyboard users get one stop per swatch (the hex) instead of five
  const line = (text, shown = text) => copyable(text, html`<small>${shown}</small>`, { tabindex: '-1' });
  return html`<li>
    ${copyable(hex, html`<span class="cd-color-swatch" style=${styleMap({ background: `var(${cssName(path)})` })}></span>`,
      { cls: 'cd-copy cd-copy-swatch', label: `${name}: copy ${hex}`, tabindex: first ? '0' : '-1' })}
    <b>${name}</b>
    ${line(hex)}${line(toRgbaString(c))}${line(toOklchString(c))}
    ${line(cmykText, Array.isArray(ext.cmyk) ? cmykText : `${cmykText} (approx.)`)}
    ${ext.pantone ? line(String(ext.pantone)) : nothing}
  </li>`;
}

// One Tab stop per hue row; arrow keys, Home and End move between its shades.
function roveSwatches(e) {
  const list = [...e.currentTarget.querySelectorAll('.cd-copy-swatch')];
  const i = list.indexOf(document.activeElement);
  if (i < 0) return;
  const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: list.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  const j = Math.max(0, Math.min(list.length - 1, next));
  list[i].tabIndex = -1;
  list[j].tabIndex = 0;
  list[j].focus();
}

function colorsView(tokens, vendor) {
  const hues = new Map();
  const roles = [];
  const other = [];
  for (const [path, t] of tokens) {
    if (t.type !== 'color' || !path.startsWith('color.')) continue;
    const [, a, b, ...rest] = path.split('.');
    if (ROLES.includes(a)) roles.push([path, t]);
    else if (/^\d+$/.test(b) && !rest.length) hues.set(a, [...(hues.get(a) ?? []), [path, t]]);
    else other.push([path, t]);
  }
  const table = (rows) => html`<div class="cd-box"><table class="cd-roles">
    <thead><tr><th>Token</th><th>Value</th><th>Hex</th></tr></thead>
    <tbody>${rows.map(([path, t]) => html`<tr>
      <td><span class="cd-chip" style=${styleMap({ background: `var(${cssName(path)})` })}></span><code>${cssName(path)}</code></td>
      <td><code>${typeof t.value === 'string' ? t.value : t.value?.$ref ?? toOklchString(t.value)}</code></td>
      <td>${toHex(t.resolved)}</td></tr>`)}</tbody>
  </table></div>`;
  return html`
    ${[...hues].map(([hue, shades]) => html`<h3 id="hue-${hue}">${hue}</h3>
      <ul class="cd-scale" aria-labelledby="hue-${hue}" @keydown=${roveSwatches}>${shades.map(([p, t], i) => swatch(p, t, vendor, i === 0))}</ul>`)}
    <h3>Roles</h3>${table(roles)}
    ${other.length ? html`<h3>Other tokens</h3>${table(other)}` : nothing}`;
}

function typographyView(tokens, meta) {
  const sizes = [...tokens].filter(([p, t]) => p.startsWith('font-size.') && t.type === 'dimension');
  const styles = [...tokens].filter(([, t]) => t.type === 'typography');
  const families = new Map();
  for (const f of meta.fontFiles) families.set(f.family, [...(families.get(f.family) ?? []), f]);
  const prop = (path, field) => `var(${cssName(path)}-${field})`;
  return html`
    <div class="cd-box"><h3>Font sizes</h3>
      ${sizes.map(([p, t]) => html`<p class="cd-type-sample" style=${styleMap({ 'font-size': `var(${cssName(p)})` })}>Aa
        <span class="cd-type-meta">${tokenLabel(p, dim(t.resolved))}</span></p>`)}</div>
    <div class="cd-box"><h3>Text styles</h3>
      ${styles.map(([p, t]) => html`<p class="cd-type-sample" style=${styleMap({
        'font-family': prop(p, 'font-family'), 'font-size': prop(p, 'font-size'), 'font-weight': prop(p, 'font-weight'),
        'letter-spacing': prop(p, 'letter-spacing'), 'line-height': prop(p, 'line-height'),
      })}>${p.replace(/^typography\./, '')}<span class="cd-type-meta">${[t.resolved.fontFamily].flat()[0]} ${t.resolved.fontWeight} ${dim(t.resolved.fontSize)} / ${t.resolved.lineHeight}</span></p>`)}</div>
    <div class="cd-box"><h3>Fonts</h3>
      ${families.size ? [...families].map(([family, files]) => html`<div class="cd-specimen"><b>${family}</b>
        ${files.map((f) => html`<p style=${styleMap({ 'font-family': cssString(family), 'font-weight': String(f.weight), 'font-style': f.style })}>
          ${f.weight} ${f.style}: The quick brown fox jumps over the lazy dog<span class="cd-type-meta">${f.src}</span></p>`)}</div>`)
        : html`<p>No font files loaded yet.</p>`}</div>`;
}

function scaleView(tokens, prefix, kind) {
  const list = [...tokens].filter(([p]) => p.startsWith(`${prefix}.`));
  if (kind === 'spacing') {
    return html`<div class="cd-box cd-token-list">${list.map(([p, t]) => html`<div class="cd-token-row">
      <span>${tokenLabel(p, dim(t.resolved))}</span><div class="cd-bar" style=${styleMap({ width: `var(${cssName(p)})` })}></div></div>`)}</div>`;
  }
  const style = (p) => styleMap(kind === 'radius' ? { 'border-radius': `var(${cssName(p)})` } : { 'box-shadow': `var(${cssName(p)})` });
  return html`<div class="cd-swatch-grid ${kind === 'shadow' ? 'cd-shadow-stage' : ''}">${list.map(([p, t]) => html`<figure>
    <div class=${kind === 'radius' ? 'cd-radius-box' : 'cd-shadow-box'} style=${style(p)}></div>
    <figcaption>${tokenLabel(p, kind === 'radius' ? radiusText(t.resolved) : null)}</figcaption></figure>`)}</div>`;
}

let codeTab = 'css';
function codeView(doc, vendor, refresh) {
  const fontSrc = (f) => `../${f.src}`; // same layout as the brand kit's css/ folder
  const tabs = [
    ['css', 'CSS variables', () => generateCss(doc, { vendor, fontSrc })],
    ['tailwind', 'Tailwind v4', () => tailwindCss(doc, { vendor, fontSrc })],
    ['shadcn', 'shadcn/ui', () => shadcnCss(doc)],
  ];
  const id = (k) => `cd-code-${k}`;
  const [, label, make] = tabs.find((t) => t[0] === codeTab);
  const code = make();
  const show = (key, focus) => {
    codeTab = key;
    refresh();
    if (focus) document.getElementById(id(key))?.focus();
  };
  const onKey = (e) => {
    const i = tabs.findIndex((t) => t[0] === codeTab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    show(tabs[(next + tabs.length) % tabs.length][0], true);
  };
  return html`<div class="cd-code-bar">
      <div role="tablist" class="cd-tabs" aria-label="Code format" @keydown=${onKey}>
        ${tabs.map(([key, text]) => html`<button type="button" role="tab" id=${id(key)} aria-controls="cd-code-panel"
          aria-selected=${String(key === codeTab)} tabindex=${key === codeTab ? '0' : '-1'} @click=${() => show(key)}>${text}</button>`)}
      </div>
      <div>${copyable(code, html`<span>${icon('copy')}Copy</span>`, { cls: 'btn btn-secondary btn-small cd-copy', label: `Copy ${label}`, title: `Copy ${label}` })}</div>
    </div>
    <div role="tabpanel" class="cd-code" id="cd-code-panel" aria-labelledby=${id(codeTab)}>
      <pre tabindex="0" aria-label=${label}><code>${code}</code></pre>
    </div>`;
}

const SHOWN = ['color.', 'spacing.', 'radius.', 'shadow.', 'font-size.', 'typography.', 'font.'];
function otherTokensView(rest) {
  return html`<div class="cd-box"><table class="cd-roles">
    <thead><tr><th>Token</th><th>Type</th><th>CSS value</th></tr></thead>
    <tbody>${rest.map(([p, t]) => html`<tr><td><code>${cssName(p)}</code></td><td>${t.type}</td><td><code>${cssValue(t.type, t.value) ?? ''}</code></td></tr>`)}</tbody>
  </table></div>`;
}

// The specimen's labels ("300 Open Sans 31px") are measured after rendering; their spans have no binding.
const specimen = html`<div class="cd-box">
  <h1 role="none">Heading, <span class="cd-specimen-label"></span></h1>
  <p>Aa - <span class="cd-specimen-label"></span>. Lorem ipsum dolor sit amet, consectetur adipisicing elit. Omnis voluptate distinctio reprehenderit, autem deleniti ad <a href="#0">voluptatum eaque</a>. Optio ea aperiam nisi distinctio nemo repellat, voluptate fugiat. Quidem neque illum, blanditiis!</p>
</div>`;

// Sections in page order: { id, title, cls, body }.
export function sections({ doc, tokens, meta, ctx, vendor, refresh }) {
  const rest = [...tokens].filter(([p]) => !SHOWN.some((x) => p.startsWith(x)));
  const customs = meta.assetGroups.filter((g) => !BUILT_IN_GROUPS.has(g.id)).map((g) => ({
    id: `group-${g.id}`, title: g.label ?? g.id, cls: 'cd-group',
    body: g.items.length ? html`<div class="cd-files">${g.items.map((i) => fileView(i, ctx))}</div>` : html`<p>No files in this group yet.</p>`,
  }));
  return [
    { id: 'branding', title: 'Branding', cls: 'cd-branding', body: html`
      <ul class="cd-logos">${group(meta, 'logos').items.map((l) => html`<li class="cd-box">${image(l, ctx)}</li>`)}</ul>
      <ul class="cd-favicons">${group(meta, 'favicons').items.map((f) => html`<li>${image(f, ctx)}</li>`)}</ul>` },
    { id: 'colors', title: 'Colors', cls: 'cd-colors', body: colorsView(tokens, vendor) },
    { id: 'typography', title: 'Typography', cls: 'cd-typography', lead: specimen, body: typographyView(tokens, meta) },
    { id: 'icons', title: 'Icons', cls: 'cd-icons', body: html`<ul class="cd-box">${group(meta, 'icons').items.map((i) => html`<li><figure>
      ${image(i, ctx, '')}<figcaption>${i.label ?? i.src.split('/').pop()}</figcaption></figure></li>`)}</ul>` },
    ...customs,
    { id: 'spacing', title: 'Spacing', cls: 'cd-spacing', body: scaleView(tokens, 'spacing', 'spacing') },
    { id: 'radius', title: 'Radius', cls: 'cd-radius', body: scaleView(tokens, 'radius', 'radius') },
    { id: 'shadow', title: 'Shadow', cls: 'cd-shadow', body: scaleView(tokens, 'shadow', 'shadow') },
    ...(rest.length ? [{ id: 'other-tokens', title: 'Other tokens', body: otherTokensView(rest) }] : []),
    { id: 'css-variables', title: 'Code', cls: 'cd-css-variables', body: codeView(doc, vendor, refresh) },
  ];
}

export const guideView = ({ doc, list, panels }) => html`
  <h1>${doc.name ?? 'Style Guide'}</h1>
  <div class="cd-panels" aria-live="polite">${panelsView(panels)}</div>
  ${repeat(list, (s) => s.id, (s) => html`<section id=${s.id} class=${s.cls ?? nothing}>
    <h2>${s.title}</h2>${s.lead ?? nothing}<div class="cd-section-body">${s.body}</div>
  </section>`)}`;

export const navView = (list) => list.map((s) => html`<li><a href="#${s.id}">${s.title}</a></li>`);

export function logoView(doc, meta, ctx) {
  const [logo] = group(meta, 'logos').items;
  const url = logo && urlFor(logo, ctx);
  return url ? html`<img src=${url} alt=${doc.name ?? 'Logo'}>` : html`<span class="cd-sr-only">${doc.name ?? 'Logo'}</span>`;
}
