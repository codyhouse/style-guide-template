// Small pieces of the guide: token captions, copy buttons, images and file cards.
import { html, nothing, type TemplateResult } from 'lit';
import { cssName } from '../../lib/css.js';
import { extension, fileName } from '../../lib/path.js';
import type { AssetContext, AssetItem, Dimension } from '../../lib/types.js';
import { icon } from '../dom.js';
import { downloadUrl, urlFor } from '../urls.js';

export const dim = (v: Dimension | number | string) =>
  v && typeof v === 'object' ? `${v.value}${v.unit}` : String(v);

/** Every token is captioned the same way: its CSS name, then its value in muted text. */
export const tokenLabel = (path: string, value?: string) =>
  html`<code>${cssName(path)}</code>${value ? html` <span class="cd-token-value">${value}</span>` : nothing}`;

// The button briefly says "Copied" in its live region. That span has no binding,
// so a render in the meantime leaves the message alone.
async function copy(e: Event, text: string) {
  const status = (e.currentTarget as Element).querySelector('.cd-copy-status');
  if (!status) return;
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Copied';
  } catch {
    status.textContent = 'Copy failed';
  }
  setTimeout(() => (status.textContent = ''), 1500);
}

export interface CopyOptions {
  cls?: string;
  label?: string;
  tabindex?: string;
  title?: string;
}

export const copyable = (
  text: string,
  content: TemplateResult,
  { cls = 'cd-copy', label, tabindex, title = `Copy ${text}` }: CopyOptions = {},
) => html`
  <button
    type="button"
    class=${cls}
    title=${title}
    aria-label=${label ?? nothing}
    tabindex=${tabindex ?? nothing}
    @click=${(e: Event) => copy(e, text)}
  >
    ${content}<span class="cd-copy-status" aria-live="polite"></span>
  </button>
`;

const missing = (src: string) =>
  html`<div class="cd-missing">${icon('alert')}<span>Missing file</span><code>${src}</code></div>`;

export function image(item: AssetItem, ctx: AssetContext, alt = item.label ?? '') {
  const url = urlFor(item, ctx);
  return url ? html`<img src=${url} alt=${alt} />` : missing(item.src);
}

const IMAGES = new Set(['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico']);
const formatSize = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

export function fileCard(item: AssetItem, ctx: AssetContext) {
  const url = urlFor(item, ctx);
  if (!url)
    return html`<figure class="cd-file">
      ${missing(item.src)}
      <figcaption>${item.label}</figcaption>
    </figure>`;
  const ext = extension(item.src);
  const name = fileName(item.src);
  const data = ctx.session.get(item.src);
  const size = data ? formatSize(data instanceof Blob ? data.size : data.byteLength) : '';
  return html`
    <figure class="cd-file">
      ${
        IMAGES.has(ext)
          ? html`<img src=${url} alt=${item.label ?? name} />`
          : html`<div class="cd-file-card" aria-hidden="true">${ext}</div>`
      }
      <figcaption>
        <b>${item.label ?? name}</b>
        ${item.description ? html`<small>${item.description}</small>` : nothing}
        <small>${`${name} ${ext.toUpperCase()} ${size}`.trim()}</small>
        <a href=${data ? downloadUrl(item.src, data) : url} download=${name}>Download</a>
      </figcaption>
    </figure>
  `;
}
