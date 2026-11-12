// Form building blocks for the editor drawer. Text and number fields commit on change.
import { html, nothing, type TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';
import { extension } from '../../lib/path.js';
import type { AssetItem } from '../../lib/types.js';
import { icon, type IconName } from '../dom.js';
import type { ListboxOption } from '../listbox.js';
import '../listbox.js';

type Content = TemplateResult | typeof nothing;

const inputOf = (e: Event) => e.target as HTMLInputElement;
const IMAGE = /\.(svg|png|jpe?g|gif|webp|avif|ico)$/i;

export const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

export const field = (label: string, input: Content, hint?: string) => {
  const note = hint ? html`<span class="cd-hint">${hint}</span>` : nothing;
  return html`<label class="cd-field"><span>${label}</span>${input}${note}</label>`;
};

export const text = (
  value: string | undefined,
  onCommit: (v: string) => void,
  { placeholder, name }: { placeholder?: string; name?: string } = {},
) => html`
  <input
    type="text"
    name=${name ?? nothing}
    placeholder=${placeholder ?? nothing}
    .value=${live(value ?? '')}
    @change=${(e: Event) => onCommit(inputOf(e).value.trim())}
  />
`;

export const number = (
  value: number | undefined,
  onCommit: (n: number) => unknown,
  { min, max, step = 'any' }: { min?: number; max?: number; step?: number | string } = {},
) => html`
  <input
    type="number"
    step=${step}
    min=${min ?? nothing}
    max=${max ?? nothing}
    .value=${live(String(value ?? ''))}
    @change=${(e: Event) => {
      const { value: v } = inputOf(e);
      if (v !== '' && Number.isFinite(Number(v))) onCommit(Number(v));
    }}
  />
`;

export const choose = (
  label: string,
  options: ListboxOption[],
  value: string | null,
  onChange: (v: string) => void,
) => html`
  <div class="cd-field">
    <span aria-hidden="true">${label}</span>
    <cd-listbox
      label=${label}
      .options=${options}
      .value=${value}
      @change=${(e: CustomEvent<string>) => onChange(e.detail)}
    ></cd-listbox>
  </div>
`;

export const iconButton = (name: IconName, label: string, onClick: () => void) => html`
  <button type="button" class="cd-action" title=${label} @click=${onClick}>
    ${icon(name)}<span>${label}</span>
  </button>
`;

export const uploadButton = (label: string, onFiles: (files: File[]) => void, accept?: string) => html`
  <div>
    <input
      type="file"
      multiple
      hidden
      accept=${accept ?? nothing}
      @change=${(e: Event) => {
        onFiles([...(inputOf(e).files ?? [])]);
        inputOf(e).value = '';
      }}
    />
    <button
      type="button"
      class="btn btn-secondary btn-small"
      @click=${(e: Event) => ((e.currentTarget as Element).previousElementSibling as HTMLInputElement).click()}
    >
      ${label}
    </button>
  </div>
`;

export const thumb = (item: AssetItem, url: string | null) =>
  url && IMAGE.test(item.src)
    ? html`<img class="cd-thumb" src=${url} alt="" />`
    : html`<span class="cd-thumb cd-thumb-file" aria-hidden="true">${extension(item.src)}</span>`;
