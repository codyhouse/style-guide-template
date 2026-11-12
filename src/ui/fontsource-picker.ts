// <cd-fontsource-picker>: search Fontsource (no API key) and pick weights, styles and subsets of one family.
// Fires "pick" with the chosen font file entries as detail.
import { html, nothing, render } from 'lit-html';
import { keyed } from 'lit-html/directives/keyed.js';
import { fetchList, fetchFont, fontEntries } from '../lib/fontsource.js';
import type { FontDetail, FontListing } from '../lib/types.js';
import './listbox.js';

type Detail =
  | { family: string; loading: true }
  | { family: string; error: string }
  | { font: FontDetail; error?: string }
  | { added: string };

const CATEGORIES = ['all', 'sans-serif', 'serif', 'display', 'handwriting', 'monospace'];

class FontsourcePicker extends HTMLElement {
  #list: FontListing[] | null = null;
  #listError: string | null = null;
  #category = 'all';
  #query = '';
  #detail: Detail | null = null;

  connectedCallback() {
    this.#render();
    if (this.#list || this.#listError) return;
    fetchList()
      .then((l) => { this.#list = l; })
      .catch((e: Error) => { this.#listError = e.message; })
      .finally(() => this.#render());
  }

  async #choose(f: FontListing) {
    this.#detail = { family: f.family, loading: true };
    this.#render();
    try {
      this.#detail = { font: await fetchFont(f.id) };
    } catch (e) {
      this.#detail = { family: f.family, error: `Could not load ${f.family}: ${(e as Error).message}` };
    }
    this.#render();
  }

  #submit(e: SubmitEvent) {
    e.preventDefault();
    if (!this.#detail || !('font' in this.#detail)) return;
    const { font } = this.#detail;
    const data = new FormData(e.currentTarget as HTMLFormElement);
    const all = (name: string) => data.getAll(name).map(String);
    const entries = fontEntries(font, { weights: all('weights').map(Number), styles: all('styles'), subsets: all('subsets') });
    if (!entries.length) {
      this.#detail = { font, error: 'Pick at least one weight, style and subset.' };
    } else {
      this.dispatchEvent(new CustomEvent('pick', { detail: entries.map(({ url, ...entry }) => entry) }));
      this.#detail = { added: `Added ${font.family} (${entries.length} files).` };
    }
    this.#render();
  }

  #detailView() {
    const d = this.#detail;
    if (!d) return nothing;
    if ('added' in d) return html`<p class="cd-hint">${d.added}</p>`;
    if ('loading' in d) return html`<p class="cd-hint">Loading ${d.family}...</p>`;
    if (!('font' in d)) return html`<p class="cd-error">${d.error}</p>`;
    const { font } = d;
    const checks = <T>(name: string, values: T[], checked: (v: T) => boolean) => html`<fieldset class="cd-checks"><legend>${name}</legend>
      ${values.map((v) => html`<label><input type="checkbox" name=${name} value=${String(v)} ?checked=${checked(v)}>${String(v)}</label>`)}</fieldset>`;
    return keyed(font.id, html`<form @submit=${(e: SubmitEvent) => this.#submit(e)}>
      <h4>${font.family}</h4>
      ${checks('weights', font.weights, (w) => w === 400 || w === 700)}
      ${checks('styles', font.styles, (s) => s === 'normal')}
      ${checks('subsets', font.subsets, (s) => s === font.defSubset)}
      <button type="submit" class="btn btn-small">Add ${font.family}</button>
      ${d.error ? html`<p class="cd-error">${d.error}</p>` : nothing}
    </form>`);
  }

  #render() {
    const q = this.#query.trim().toLowerCase();
    const hits = (this.#list ?? []).filter((f) => (this.#category === 'all' || f.category === this.#category)
      && (!q || f.family.toLowerCase().includes(q))).slice(0, 12);
    const status = this.#listError ? `Fontsource is unreachable (${this.#listError}). Uploaded and library fonts still work.`
      : !this.#list ? 'Loading the Fontsource catalog...'
        : q || this.#category !== 'all' ? `${hits.length} shown` : `${this.#list.length} fonts available. Type to search.`;
    render(html`
      <div class="cd-field"><input type="search" placeholder="Search fonts" aria-label="Search Fontsource fonts"
        @input=${(e: InputEvent) => { this.#query = (e.target as HTMLInputElement).value; this.#render(); }}></div>
      <div class="cd-field"><cd-listbox .label=${'Category'} .value=${this.#category}
        .options=${CATEGORIES.map((c) => ({ value: c, label: c === 'all' ? 'All categories' : c }))}
        @change=${(e: CustomEvent<string>) => { this.#category = e.detail; this.#render(); }}></cd-listbox></div>
      <p class="cd-hint" aria-live="polite">${status}</p>
      <ul class="cd-list-editor">${hits.map((f) => html`<li><span>${f.family} (${f.category})</span>
        <button type="button" class="btn btn-secondary btn-small" @click=${() => this.#choose(f)}>Choose</button></li>`)}</ul>
      <div>${this.#detailView()}</div>`, this);
  }
}

if (!customElements.get('cd-fontsource-picker')) customElements.define('cd-fontsource-picker', FontsourcePicker);
