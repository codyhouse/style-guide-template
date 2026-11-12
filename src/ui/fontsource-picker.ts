// <cd-fontsource-picker>: search Fontsource (no API key) and pick weights, styles and subsets of one family.
// Fires "pick" with the chosen font file entries as detail.
import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { fetchFont, fetchList, fontEntries } from '../lib/fontsource.js';
import type { FontDetail, FontListing } from '../lib/types.js';
import { LightElement } from './light-element.js';
import './listbox.js';

type Detail =
  | { family: string; loading: true }
  | { family: string; error: string }
  | { font: FontDetail; error?: string }
  | { added: string };

const CATEGORIES = ['all', 'sans-serif', 'serif', 'display', 'handwriting', 'monospace'].map((c) => ({
  value: c,
  label: c === 'all' ? 'All categories' : c,
}));
const SHOWN = 12;

@customElement('cd-fontsource-picker')
export class FontsourcePicker extends LightElement {
  @state() private list: FontListing[] | null = null;
  @state() private listError: string | null = null;
  @state() private category = 'all';
  @state() private query = '';
  @state() private detail: Detail | null = null;

  override connectedCallback() {
    super.connectedCallback();
    if (this.list || this.listError) return;
    fetchList()
      .then((list) => (this.list = list))
      .catch((e: Error) => (this.listError = e.message));
  }

  private async choose(f: FontListing) {
    this.detail = { family: f.family, loading: true };
    try {
      this.detail = { font: await fetchFont(f.id) };
    } catch (e) {
      this.detail = { family: f.family, error: `Could not load ${f.family}: ${(e as Error).message}` };
    }
  }

  private submit(e: SubmitEvent, font: FontDetail) {
    e.preventDefault();
    const data = new FormData(e.currentTarget as HTMLFormElement);
    const all = (name: string) => data.getAll(name).map(String);
    const entries = fontEntries(font, {
      weights: all('weights').map(Number),
      styles: all('styles'),
      subsets: all('subsets'),
    });
    if (!entries.length) {
      this.detail = { font, error: 'Pick at least one weight, style and subset.' };
      return;
    }
    this.dispatchEvent(new CustomEvent('pick', { detail: entries.map(({ url, ...entry }) => entry) }));
    this.detail = { added: `Added ${font.family} (${entries.length} files).` };
  }

  private get hits() {
    const q = this.query.trim().toLowerCase();
    return (this.list ?? [])
      .filter((f) => this.category === 'all' || f.category === this.category)
      .filter((f) => !q || f.family.toLowerCase().includes(q))
      .slice(0, SHOWN);
  }

  private get status() {
    if (this.listError)
      return `Fontsource is unreachable (${this.listError}). Uploaded and library fonts still work.`;
    if (!this.list) return 'Loading the Fontsource catalog...';
    if (this.query.trim() || this.category !== 'all') return `${this.hits.length} shown`;
    return `${this.list.length} fonts available. Type to search.`;
  }

  private detailView() {
    const d = this.detail;
    if (!d) return nothing;
    if ('added' in d) return html`<p class="cd-hint">${d.added}</p>`;
    if ('loading' in d) return html`<p class="cd-hint">Loading ${d.family}...</p>`;
    if (!('font' in d)) return html`<p class="cd-error">${d.error}</p>`;
    const { font } = d;
    const checks = <T>(name: string, values: T[], checked: (v: T) => boolean) => {
      const box = (v: T) =>
        html`<input type="checkbox" name=${name} value=${String(v)} ?checked=${checked(v)} />`;
      return html`
        <fieldset class="cd-checks">
          <legend>${name}</legend>
          ${values.map((v) => html`<label>${box(v)}${v}</label>`)}
        </fieldset>
      `;
    };
    // keyed: a new family starts from its own defaults, not the last family's checkboxes
    return keyed(
      font.id,
      html`
        <form @submit=${(e: SubmitEvent) => this.submit(e, font)}>
          <h4>${font.family}</h4>
          ${checks('weights', font.weights, (w) => w === 400 || w === 700)}
          ${checks('styles', font.styles, (s) => s === 'normal')}
          ${checks('subsets', font.subsets, (s) => s === font.defSubset)}
          <button type="submit" class="btn btn-small">Add ${font.family}</button>
          ${d.error ? html`<p class="cd-error">${d.error}</p>` : nothing}
        </form>
      `,
    );
  }

  protected override render() {
    return html`
      <div class="cd-field">
        <input
          type="search"
          placeholder="Search fonts"
          aria-label="Search Fontsource fonts"
          @input=${(e: InputEvent) => (this.query = (e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="cd-field">
        <cd-listbox
          label="Category"
          .options=${CATEGORIES}
          .value=${this.category}
          @change=${(e: CustomEvent<string>) => (this.category = e.detail)}
        ></cd-listbox>
      </div>
      <p class="cd-hint" aria-live="polite">${this.status}</p>
      <ul class="cd-list-editor">
        ${this.hits.map(
          (f) => html`
            <li>
              <span>${f.family} (${f.category})</span>
              <button type="button" class="btn btn-secondary btn-small" @click=${() => this.choose(f)}>
                Choose
              </button>
            </li>
          `,
        )}
      </ul>
      <div>${this.detailView()}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cd-fontsource-picker': FontsourcePicker;
  }
}
