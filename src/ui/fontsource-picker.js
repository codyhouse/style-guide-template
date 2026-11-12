// Search Fontsource (no API key) and pick weights, styles and subsets of one family.
import { h } from './dom.js';
import { listbox } from './listbox.js';
import { fetchList, fetchFont, fontEntries } from '../lib/fontsource.js';

const CATEGORIES = ['all', 'sans-serif', 'serif', 'display', 'handwriting', 'monospace'];

export function fontsourcePicker(el, { onPick }) {
  let list = [];
  let category = 'all';
  const status = h('p', { class: 'cd-hint', 'aria-live': 'polite' }, 'Loading the Fontsource catalog...');
  const search = h('input', { type: 'search', placeholder: 'Search fonts', 'aria-label': 'Search Fontsource fonts' });
  const cat = h('div', {});
  const results = h('ul', { class: 'cd-list-editor' });
  const detail = h('div', {});
  el.replaceChildren(h('div', { class: 'cd-field' }, search), h('div', { class: 'cd-field' }, cat), status, results, detail);

  listbox(cat, { label: 'Category', options: CATEGORIES.map((c) => ({ value: c, label: c === 'all' ? 'All categories' : c })), value: category, onChange: (v) => { category = v; show(); } });

  function show() {
    const q = search.value.trim().toLowerCase();
    const hits = list.filter((f) => (category === 'all' || f.category === category) && (!q || f.family.toLowerCase().includes(q))).slice(0, 12);
    results.replaceChildren(...hits.map((f) => h('li', {},
      h('span', {}, `${f.family} (${f.category})`),
      h('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: () => choose(f) }, 'Choose'))));
    status.textContent = q || category !== 'all' ? `${hits.length} shown` : `${list.length} fonts available. Type to search.`;
  }

  async function choose(f) {
    detail.replaceChildren(h('p', { class: 'cd-hint' }, `Loading ${f.family}...`));
    let font;
    try {
      font = await fetchFont(f.id);
    } catch (e) {
      detail.replaceChildren(h('p', { class: 'cd-error' }, `Could not load ${f.family}: ${e.message}`));
      return;
    }
    const checks = (name, values, checked) => h('fieldset', { class: 'cd-checks' }, h('legend', {}, name),
      values.map((v) => h('label', {}, h('input', { type: 'checkbox', name, value: String(v), checked: checked(v) }), String(v))));
    const form = h('form', {},
      h('h4', {}, font.family),
      checks('weights', font.weights, (w) => w === 400 || w === 700),
      checks('styles', font.styles, (s) => s === 'normal'),
      checks('subsets', font.subsets, (s) => s === font.defSubset),
      h('button', { type: 'submit', class: 'btn btn-small' }, `Add ${font.family}`));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const values = (name) => [...form.querySelectorAll(`input[name=${name}]:checked`)].map((i) => i.value);
      const entries = fontEntries(font, { weights: values('weights').map(Number), styles: values('styles'), subsets: values('subsets') });
      if (!entries.length) {
        detail.querySelector('.cd-error')?.remove();
        form.append(h('p', { class: 'cd-error' }, 'Pick at least one weight, style and subset.'));
        return;
      }
      onPick(entries.map(({ url, ...entry }) => entry));
      detail.replaceChildren(h('p', { class: 'cd-hint' }, `Added ${font.family} (${entries.length} files).`));
    });
    detail.replaceChildren(form);
  }

  search.addEventListener('input', show);
  fetchList().then((l) => { list = l; show(); })
    .catch((e) => { status.textContent = `Fontsource is unreachable (${e.message}). Uploaded and library fonts still work.`; });
}
