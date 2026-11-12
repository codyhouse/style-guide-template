// <cd-fontsource-picker>: search Fontsource (no API key) and pick weights, styles and subsets of one family.
// Fires "pick" with the chosen font file entries as detail.
import { html, nothing, render } from 'lit-html';
import { keyed } from 'lit-html/directives/keyed.js';
import { fetchList, fetchFont, fontEntries } from '../lib/fontsource.js';
import './listbox.js';

const CATEGORIES = ['all', 'sans-serif', 'serif', 'display', 'handwriting', 'monospace'];

class FontsourcePicker extends HTMLElement {
  #list = null;
  #listError = null;
  #category = 'all';
  #query = '';
  // the family being picked: { family, loading } | { family, error } | { font, error? } | { added }
  #detail = null;

  connectedCallback() {
    this.#render();
    if (this.#list || this.#listError) return;
    fetchList()
      .then((l) => { this.#list = l; })
      .catch((e) => { this.#listError = e.message; })
      .finally(() => this.#render());
  }

  async #choose(f) {
    this.#detail = { family: f.family, loading: true };
    this.#render();
    try {
      this.#detail = { font: await fetchFont(f.id) };
    } catch (e) {
      this.#detail = { family: f.family, error: `Could not load ${f.family}: ${e.message}` };
    }
    this.#render();
  }

  #submit(e) {
    e.preventDefault();
    const { font } = this.#detail;
    const data = new FormData(e.currentTarget);
    const entries = fontEntries(font, { weights: data.getAll('weights').map(Number), styles: data.getAll('styles'), subsets: data.getAll('subsets') });
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
    if (d.added) return html`<p class="cd-hint">${d.added}</p>`;
    if (d.loading) return html`<p class="cd-hint">Loading ${d.family}...</p>`;
    if (!d.font) return html`<p class="cd-error">${d.error}</p>`;
    const { font } = d;
    const checks = (name, values, checked) => html`<fieldset class="cd-checks"><legend>${name}</legend>
      ${values.map((v) => html`<label><input type="checkbox" name=${name} value=${String(v)} ?checked=${checked(v)}>${String(v)}</label>`)}</fieldset>`;
    return keyed(font.id, html`<form @submit=${(e) => this.#submit(e)}>
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
        @input=${(e) => { this.#query = e.target.value; this.#render(); }}></div>
      <div class="cd-field"><cd-listbox .label=${'Category'} .value=${this.#category}
        .options=${CATEGORIES.map((c) => ({ value: c, label: c === 'all' ? 'All categories' : c }))}
        @change=${(e) => { this.#category = e.detail; this.#render(); }}></cd-listbox></div>
      <p class="cd-hint" aria-live="polite">${status}</p>
      <ul class="cd-list-editor">${hits.map((f) => html`<li><span>${f.family} (${f.category})</span>
        <button type="button" class="btn btn-secondary btn-small" @click=${() => this.#choose(f)}>Choose</button></li>`)}</ul>
      <div>${this.#detailView()}</div>`, this);
  }
}

if (!customElements.get('cd-fontsource-picker')) customElements.define('cd-fontsource-picker', FontsourcePicker);
