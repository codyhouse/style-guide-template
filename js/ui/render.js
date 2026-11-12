// Renders every section of the guide from the brand document.
import { h, icon } from './dom.js';
import { resolve } from '../lib/resolver.js';
import { brandMeta, resolveAsset } from '../lib/assets.js';
import { toHex, toRgbaString, toOklchString, cmyk } from '../lib/color.js';
import { cssName } from '../lib/css.js';
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

export function urlFor(entry, ctx) {
  const where = resolveAsset(entry, ctx);
  if (where.source === 'session') return objectUrl(entry.src, ctx.session.get(entry.src));
  return where.url ?? null;
}

const dim = (v) => (v && typeof v === 'object' ? `${v.value}${v.unit}` : String(v));
const sizeOf = (data) => (data ? (data.size ?? data.byteLength) : null);
const formatSize = (n) => (n === null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

function missing(src) {
  return h('div', { class: 'cd-missing' }, icon('alert'), h('span', {}, 'Missing file'), h('code', {}, src));
}

function image(item, ctx, attrs = {}) {
  const url = urlFor(item, ctx);
  return url ? h('img', { src: url, alt: item.label ?? '', ...attrs }) : missing(item.src);
}

function fileView(item, ctx) {
  const url = urlFor(item, ctx);
  if (!url) return h('figure', { class: 'cd-file' }, missing(item.src), h('figcaption', {}, item.label));
  const ext = extOf(item.src);
  const name = item.src.split('/').pop();
  return h('figure', { class: 'cd-file' },
    IMAGE.has(ext) ? h('img', { src: url, alt: item.label ?? name }) : h('div', { class: 'cd-file-card', 'aria-hidden': 'true' }, ext),
    h('figcaption', {},
      h('b', {}, item.label ?? name),
      item.description ? h('small', {}, item.description) : null,
      h('small', {}, `${name} ${ext.toUpperCase()} ${formatSize(sizeOf(ctx.session.get(item.src)))}`.trim()),
      h('a', { href: url, download: name }, 'Download')));
}

const group = (meta, id) => meta.assetGroups.find((g) => g.id === id) ?? { items: [] };

function renderBranding(body, meta, ctx) {
  const [, ...logos] = group(meta, 'logos').items; // the first logo sits in the header
  body.replaceChildren(
    h('ul', { class: 'cd-logos' }, logos.map((l) => h('li', { class: 'cd-box' }, image(l, ctx)))),
    h('ul', { class: 'cd-favicons' }, group(meta, 'favicons').items.map((f) => h('li', {}, image(f, ctx)))),
  );
}

function swatch(path, token, vendor) {
  const ext = token.extensions?.[vendor] ?? {};
  const c = token.resolved;
  return h('li', {},
    h('div', { class: 'cd-color-swatch', style: { background: `var(${cssName(path)})` } }),
    h('b', {}, path.replace(/^color\./, '').replace('.', '-')),
    h('small', {}, toHex(c)),
    h('small', {}, toRgbaString(c)),
    h('small', {}, toOklchString(c)),
    h('small', {}, ext.cmyk ? `CMYK ${ext.cmyk.join(' ')}` : `CMYK ${cmyk(c).join(' ')} (approx.)`),
    ext.pantone ? h('small', {}, ext.pantone) : null);
}

function renderColors(body, tokens, vendor) {
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
  const roleRow = ([path, t]) => h('tr', {},
    h('td', {}, h('span', { class: 'cd-chip', style: { background: `var(${cssName(path)})` } }), h('code', {}, path)),
    h('td', {}, typeof t.value === 'string' ? t.value : toOklchString(t.value)),
    h('td', {}, toHex(t.resolved)));
  const table = (rows) => h('table', { class: 'cd-roles' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Token'), h('th', {}, 'Value'), h('th', {}, 'Hex'))),
    h('tbody', {}, rows.map(roleRow)));
  body.replaceChildren(
    ...[...hues].flatMap(([hue, shades]) => [h('h3', {}, hue), h('ul', { class: 'cd-scale' }, shades.map(([p, t]) => swatch(p, t, vendor)))]),
    h('h3', {}, 'Roles'), table(roles),
    ...(other.length ? [h('h3', {}, 'Other tokens'), table(other)] : []),
  );
}

function renderTypography(body, tokens, meta) {
  const sizes = [...tokens].filter(([p, t]) => p.startsWith('font-size.') && t.type === 'dimension');
  const styles = [...tokens].filter(([, t]) => t.type === 'typography');
  const families = new Map();
  for (const f of meta.fontFiles) families.set(f.family, [...(families.get(f.family) ?? []), f]);
  const prop = (path, field) => `var(${cssName(path)}-${field})`;
  body.replaceChildren(
    h('div', { class: 'cd-box' }, h('h3', {}, 'Font sizes'),
      sizes.map(([p, t]) => h('p', { class: 'cd-type-sample', style: { 'font-size': `var(${cssName(p)})` } },
        'Aa ', h('span', { class: 'cd-type-meta' }, `${cssName(p)}: ${dim(t.resolved)}`)))),
    h('div', { class: 'cd-box' }, h('h3', {}, 'Text styles'),
      styles.map(([p, t]) => h('p', {
        class: 'cd-type-sample',
        style: {
          'font-family': prop(p, 'font-family'), 'font-size': prop(p, 'font-size'), 'font-weight': prop(p, 'font-weight'),
          'letter-spacing': prop(p, 'letter-spacing'), 'line-height': prop(p, 'line-height'),
        },
      }, p.replace(/^typography\./, ''), h('span', { class: 'cd-type-meta' },
        `${[t.resolved.fontFamily].flat()[0]} ${t.resolved.fontWeight} ${dim(t.resolved.fontSize)} / ${t.resolved.lineHeight}`)))),
    h('div', { class: 'cd-box' }, h('h3', {}, 'Fonts'),
      families.size ? [...families].map(([family, files]) => h('div', { class: 'cd-specimen' },
        h('b', {}, family),
        files.map((f) => h('p', { style: { 'font-family': cssString(family), 'font-weight': String(f.weight), 'font-style': f.style } },
          `${f.weight} ${f.style}: The quick brown fox jumps over the lazy dog`,
          h('span', { class: 'cd-type-meta' }, f.src))))) : h('p', {}, 'No font files loaded yet.')),
  );
}

let buttonsDone = false;
function renderButtons(body) {
  if (buttonsDone) return;
  buttonsDone = true;
  const variants = [['Primary', 'btn'], ['Secondary', 'btn btn-secondary'], ['Destructive', 'btn btn-destructive']];
  const states = [['Default', {}], ['Hover', { 'data-state': 'hover' }], ['Focus', { 'data-state': 'focus' }],
    ['Active', { 'data-state': 'active' }], ['Disabled', { disabled: true }], ['Loading', { 'aria-busy': 'true' }]];
  body.replaceChildren(
    h('div', { class: 'cd-box' }, variants.map(([name, cls]) => h('div', { class: 'cd-button-row' },
      h('b', {}, name),
      states.map(([state, attrs]) => h('button', { type: 'button', class: cls, ...attrs },
        state === 'Loading' ? h('span', { class: 'cd-sr-only' }, 'Loading') : state))))),
    // the original guide's code snippet: each button's markup with its class names highlighted
    h('div', { class: 'cd-box' }, variants.map(([name, cls]) =>
      h('p', {}, '<button class="', h('span', {}, cls), `">${name}</button>`))),
  );
}

function renderIcons(body, meta, ctx) {
  body.replaceChildren(h('ul', { class: 'cd-box' },
    group(meta, 'icons').items.map((i) => h('li', { title: i.label }, image(i, ctx)))));
}

function renderScale(body, tokens, prefix, kind) {
  const list = [...tokens].filter(([p]) => p.startsWith(`${prefix}.`));
  if (kind === 'spacing') {
    body.replaceChildren(h('div', { class: 'cd-box cd-token-list' }, list.map(([p, t]) => h('div', { class: 'cd-token-row' },
      h('code', {}, `${cssName(p)}: ${dim(t.resolved)}`), h('div', { class: 'cd-bar', style: { width: `var(${cssName(p)})` } })))));
    return;
  }
  const style = (p) => (kind === 'radius' ? { 'border-radius': `var(${cssName(p)})` } : { 'box-shadow': `var(${cssName(p)})` });
  body.replaceChildren(h('div', { class: 'cd-swatch-grid' }, list.map(([p, t]) => h('figure', {},
    h('div', { class: kind === 'radius' ? 'cd-radius-box' : 'cd-shadow-box', style: style(p) }),
    h('figcaption', {}, h('code', {}, cssName(p)), h('br'), kind === 'radius' ? dim(t.resolved) : '')))));
}

function renderCss(body, css) {
  const copy = h('button', { type: 'button', class: 'btn btn-secondary btn-small' }, icon('copy'), ' Copy');
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(css);
      copy.lastChild.textContent = ' Copied';
    } catch {
      copy.lastChild.textContent = ' Copy failed';
    }
    setTimeout(() => { copy.lastChild.textContent = ' Copy'; }, 2000);
  });
  body.replaceChildren(h('div', { class: 'cd-code' }, copy, h('pre', {}, h('code', {}, css))));
}

function renderCustomGroups(main, meta, ctx) {
  for (const s of main.querySelectorAll('section[data-group]')) s.remove();
  const before = main.querySelector('#spacing');
  for (const g of meta.assetGroups.filter((x) => !BUILT_IN_GROUPS.has(x.id))) {
    main.insertBefore(h('section', { id: `group-${g.id}`, 'data-group': g.id, class: 'cd-group' },
      h('h2', {}, g.label ?? g.id),
      g.items.length ? h('div', { class: 'cd-files' }, g.items.map((i) => fileView(i, ctx))) : h('p', {}, 'No files in this group yet.')), before);
  }
}

function renderNav(nav, main) {
  nav.replaceChildren(...[...main.querySelectorAll(':scope > section')].map((s) =>
    h('li', {}, h('a', { href: `#${s.id}` }, s.querySelector('h2').textContent))));
}

function renderHeader(doc, meta, ctx) {
  const [logo] = group(meta, 'logos').items;
  document.getElementById('cd-logo').replaceChildren(logo && urlFor(logo, ctx)
    ? h('img', { src: urlFor(logo, ctx), alt: doc.name ?? 'Logo' })
    : h('span', { class: 'cd-sr-only' }, doc.name ?? 'Logo'));
  document.getElementById('cd-title').textContent = doc.name ?? 'Style Guide';
  document.title = `${doc.name ?? 'Brand'} | Style Guide`;
}

export function render({ doc, css, theme, session, library, vendor }) {
  const ctx = { session, library };
  const meta = brandMeta(doc, vendor);
  const tokens = resolve(doc, { theme });
  const main = document.querySelector('main');
  const body = (id) => main.querySelector(`#${id} .cd-section-body`);
  document.getElementById('brand-css').textContent = css;
  renderHeader(doc, meta, ctx);
  renderBranding(body('branding'), meta, ctx);
  renderColors(body('colors'), tokens, vendor);
  renderTypography(body('typography'), tokens, meta);
  renderButtons(body('buttons'));
  renderIcons(body('icons'), meta, ctx);
  renderScale(body('spacing'), tokens, 'spacing', 'spacing');
  renderScale(body('radius'), tokens, 'radius', 'radius');
  renderScale(body('shadow'), tokens, 'shadow', 'shadow');
  renderCss(body('css-variables'), css);
  renderCustomGroups(main, meta, ctx);
  renderNav(document.getElementById('cd-nav'), main);
}
