// The edit drawer: forms that write through the store. Text inputs commit on change.
import { html, nothing } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { repeat } from 'lit-html/directives/repeat.js';
import { styleMap } from 'lit-html/directives/style-map.js';
import { icon } from './dom.js';
import './listbox.js';
import './fontsource-picker.js';
import * as E from '../lib/edit.js';
import { resolve } from '../lib/resolver.js';
import { checkBrand } from '../lib/io.js';
import { brandMeta, withBrandMeta } from '../lib/assets.js';
import { applyScale, setStep } from '../lib/scale.js';
import { parseCssColor, toHex, toOklchString } from '../lib/color.js';
import { ROLES } from '../lib/contrast.js';

const SHADE = /^\d+$/;
const GENERIC = ['sans-serif', 'serif', 'monospace', 'cursive', 'system-ui'];
const IMAGE = /\.(svg|png|jpe?g|gif|webp|avif|ico)$/i;
const COLOR_ERROR = 'Not a CSS color. Try #2e59aa, rgb(46 89 170), hsl(219 57% 42%), oklch(0.48 0.14 262) or a name like teal.';
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
const own = (o) => Object.keys(o ?? {}).filter((k) => !k.startsWith('$'));

// Drawer state that outlives a render: open areas, field errors, the library file picked per group.
const openAreas = new Set(['Brand', 'Palette']);
const errors = new Map();
const libPicks = new Map();

const field = (label, input, hint) => html`<label class="cd-field"><span>${label}</span>${input}${hint ? html`<span class="cd-hint">${hint}</span>` : nothing}</label>`;

const text = (value, onCommit, { placeholder, name } = {}) => html`<input type="text" name=${name ?? nothing}
  placeholder=${placeholder ?? nothing} .value=${live(value ?? '')} @change=${(e) => onCommit(e.target.value.trim())}>`;

const number = (value, onCommit, { min, max, step = 'any' } = {}) => html`<input type="number" step=${step}
  min=${min ?? nothing} max=${max ?? nothing} .value=${live(String(value ?? ''))}
  @change=${(e) => { const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n)) onCommit(n); }}>`;

const choose = (label, options, value, onChange) => html`<div class="cd-field"><span aria-hidden="true">${label}</span>
  <cd-listbox .label=${label} .options=${options} .value=${value} @change=${(e) => onChange(e.detail)}></cd-listbox></div>`;

const iconButton = (name, label, onClick) => html`<button type="button" class="cd-action" title=${label} @click=${onClick}>${icon(name)}<span>${label}</span></button>`;

const area = (name, body) => html`<details class="cd-drawer-area" ?open=${openAreas.has(name)}
  @toggle=${(e) => (e.currentTarget.open ? openAreas.add(name) : openAreas.delete(name))}><summary><h3>${name}</h3></summary>${body}</details>`;

const uploadButton = (label, onFiles, accept) => html`<div>
  <input type="file" multiple hidden accept=${accept ?? nothing} @change=${(e) => { onFiles([...e.target.files]); e.target.value = ''; }}>
  <button type="button" class="btn btn-secondary btn-small" @click=${(e) => e.currentTarget.previousElementSibling.click()}>${label}</button></div>`;

const thumb = (item, url) => (url && IMAGE.test(item.src)
  ? html`<img class="cd-thumb" src=${url} alt="">`
  : html`<span class="cd-thumb cd-thumb-file" aria-hidden="true">${item.src.split('.').pop()}</span>`);

export function editorView(app) {
  const { store, vendor, library, manifest, refresh } = app;
  const doc = store.get();
  const tree = E.foundation(doc);
  const tokens = resolve(doc, { theme: app.theme() });
  const meta = brandMeta(doc, vendor);
  // An edit the page could not render (e.g. removing a hue a role points to) is refused, not applied.
  // Edits read the token as it is now, so two edits in a row never undo each other.
  const fresh = (path) => path.split('.').reduce((n, k) => n?.[k], E.foundation(store.get()));
  const set = (next) => {
    const [problem] = checkBrand(next);
    if (problem) app.warn(`Not applied: ${problem.path ? `${problem.path}: ` : ''}${problem.message}`);
    else store.set(next);
  };
  const setMeta = (fn) => set(withBrandMeta(store.get(), vendor, fn(brandMeta(store.get(), vendor))));

  // Any CSS color as text, optionally with the system picker, which commits through the text field.
  // A color that does not parse keeps the typed text and shows an error instead of committing.
  const colorInput = (key, label, value, onCommit, { picker = true, placeholder, name } = {}) => {
    const err = errors.get(key);
    const commit = (input) => {
      const c = parseCssColor(input.value.trim());
      if (c) errors.delete(key);
      else errors.set(key, COLOR_ERROR);
      const pick = input.nextElementSibling;
      if (pick && c) pick.value = toHex(c);
      if (c) onCommit(c);
      refresh();
    };
    const parsed = value ? parseCssColor(value) : null;
    return html`<div class="cd-color-input">
      <input type="text" name=${name ?? nothing} placeholder=${placeholder ?? nothing} .value=${value}
        aria-invalid=${err ? 'true' : nothing} aria-describedby=${err ? `${key}-error` : nothing} @change=${(e) => commit(e.target)}>
      ${picker ? html`<input type="color" aria-label="Pick ${label}" .value=${parsed ? toHex(parsed) : '#000000'}
        @input=${(e) => { e.target.previousElementSibling.value = e.target.value; }}
        @change=${(e) => commit(e.target.previousElementSibling)}>` : nothing}
    </div>${err ? html`<span class="cd-error" id="${key}-error">${err}</span>` : nothing}`;
  };

  /* brand */
  const brand = area('Brand', html`
    ${field('Name', text(doc.name, (v) => v && set({ ...store.get(), name: v })))}
    <div class="cd-field-row">
      <button type="button" class="btn btn-secondary btn-small" @click=${app.load}>Load file</button>
      <button type="button" class="btn btn-secondary btn-small" @click=${app.save}>Save JSON</button>
      <button type="button" class="btn btn-secondary btn-small" @click=${app.export}>Export ZIP</button>
    </div>
    ${choose('Replace with a preset', manifest.brands.map((b) => ({ value: b.path, label: b.name })), null, async (path) => {
      store.load(await fetch(`library/${path}`).then((r) => r.json()));
    })}
    <div class="cd-field-row">
      <button type="button" class="btn btn-secondary btn-small" @click=${() => store.clearDraft()}>Clear local draft</button>
      ${store.hasPrevious() ? html`<button type="button" class="btn btn-secondary btn-small" @click=${() => store.restorePrevious()}>Restore previous draft</button>` : nothing}
    </div>
    <p class="cd-hint">Clearing or replacing keeps your previous draft, so it can be restored. Undo (Ctrl+Z) steps back through every edit.</p>`);

  /* palette */
  const hues = own(tree.color).filter((k) => !ROLES.includes(k) && Object.keys(tree.color[k]).some((s) => SHADE.test(s)));
  const shadesOf = (hue) => Object.keys(tree.color[hue]).filter((s) => SHADE.test(s));
  const hueView = (hue) => {
    const shades = shadesOf(hue);
    const base = tree.color[hue].$extensions?.[vendor]?.base ?? ('600' in tree.color[hue] ? '600' : shades[Math.floor(shades.length / 2)]);
    const shadeRow = (s) => {
      const t = tree.color[hue][s];
      const ext = t.$extensions?.[vendor] ?? {};
      const path = `color.${hue}.${s}`;
      const setExt = (patch) => {
        const cur = fresh(path);
        set(E.setToken(store.get(), path, { ...cur, $extensions: { ...cur.$extensions, [vendor]: { ...cur.$extensions?.[vendor], ...patch } } }));
      };
      return html`<div class="cd-field-row">
        ${field(`${hue}-${s}`, colorInput(`shade-${hue}-${s}`, `${hue}-${s}`, toOklchString(t.$value),
          (c) => set(E.setToken(store.get(), path, { ...fresh(path), $value: c })), { picker: false }))}
        ${field('CMYK', text(ext.cmyk?.join(' '), (v) => {
          const parts = v.split(/[\s,]+/).filter(Boolean).map(Number);
          setExt({ cmyk: parts.length === 4 && parts.every((n) => n >= 0 && n <= 100) ? parts : undefined });
        }, { placeholder: 'C M Y K' }))}
        ${field('Pantone', text(ext.pantone, (v) => setExt({ pantone: v || undefined })))}
      </div>`;
    };
    return html`<div class="cd-hue">
      <div class="cd-field-row">
        ${field(`${cap(hue)} base color`, colorInput(`hue-${hue}`, `${hue} base color`, toHex(tree.color[hue][base].$value),
          (c) => set(E.setHue(store.get(), hue, c, vendor))))}
        ${iconButton('trash', `Remove ${hue}`, () => set(E.removeHue(store.get(), hue)))}
      </div>
      <p class="cd-hint">Your color is kept as ${hue}-${base}. The other ${shades.length - 1} shades are generated from it.</p>
      <ol class="cd-mini-scale" aria-label="${hue} shades">${shades.map((s) => html`<li class=${s === base ? 'is-base' : nothing}
        title="${hue}-${s}${s === base ? ' (your color)' : ''}" style=${styleMap({ background: `var(--color-${hue}-${s})` })}>
        <span class="cd-sr-only">${hue}-${s}${s === base ? ', your color' : ''}</span></li>`)}</ol>
      <details><summary>${cap(hue)} shades, CMYK and Pantone</summary>${repeat(shades, (s) => s, shadeRow)}</details>
    </div>`;
  };
  const addHue = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const id = String(data.get('name')).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    const c = parseCssColor(String(data.get('color')).trim());
    const nameError = !id ? 'Give the hue a name.' : ROLES.includes(id) || hues.includes(id) ? `${id} is already taken.` : null;
    for (const [key, msg] of [['new-hue-name', nameError], ['new-hue-color', c ? null : COLOR_ERROR]]) {
      if (msg) errors.set(key, msg);
      else errors.delete(key);
    }
    if (!nameError && c) {
      set(E.setHue(store.get(), id, c, vendor));
      form.reset();
    }
    refresh();
  };
  const nameErr = errors.get('new-hue-name');
  const palette = area('Palette', html`
    ${repeat(hues, (hue) => hue, hueView)}
    <form class="cd-field-row" @submit=${addHue}>
      <label class="cd-field"><span>New hue name</span>
        <input type="text" name="name" placeholder="accent" aria-invalid=${nameErr ? 'true' : nothing} aria-describedby=${nameErr ? 'new-hue-name-error' : nothing}>
        ${nameErr ? html`<span class="cd-error" id="new-hue-name-error">${nameErr}</span>` : nothing}</label>
      ${field('Color', colorInput('new-hue-color', 'the new hue color', '', () => {}, { placeholder: 'any CSS color', name: 'color' }))}
      <button type="submit" class="btn btn-small">Add hue</button>
    </form>`);

  /* roles */
  const shadeOptions = hues.flatMap((hue) => shadesOf(hue).map((s) => ({ value: `{color.${hue}.${s}}`, label: `${hue}-${s}`, swatch: `var(--color-${hue}-${s})` })));
  const roles = area('Roles', html`
    <p class="cd-hint">Editing the ${app.theme()} theme. Switch the theme in the header to edit the other.</p>
    ${ROLES.map((role) => {
      const props = [...tokens.keys()].filter((p) => p.startsWith(`color.${role}.`));
      return props.length ? html`<div>${props.map((p) => {
        const { value } = tokens.get(p);
        const options = shadeOptions.some((o) => o.value === value) ? shadeOptions
          : [{ value, label: 'Custom value', swatch: `var(--${p.replace(/\./g, '-')})` }, ...shadeOptions];
        return choose(cap(`${role} ${p.split('.').slice(2).join(' ').replace(/-/g, ' ')}`), options, value,
          (v) => set(E.setRole(store.get(), app.theme(), p.replace(/^color\./, ''), v)));
      })}</div>` : nothing;
    })}`);

  /* fonts and type */
  const families = [...new Set([...meta.fontFiles.map((f) => f.family),
    ...Object.values(tree.font ?? {}).flatMap((t) => (t?.$value ? [[t.$value].flat()[0]] : []))])];
  const fontTokens = own(tree.font);
  const sizeSteps = own(tree['font-size']);
  const typoView = ([name, t]) => {
    const v = t.$value;
    const put = (patch) => {
      const cur = fresh(`typography.${name}`);
      set(E.setToken(store.get(), `typography.${name}`, { ...cur, $value: { ...cur.$value, ...patch } }));
    };
    return html`<div><h4>${cap(name.replace(/-/g, ' '))}</h4>
      <div class="cd-field-row">
        ${choose('Font', fontTokens.map((f) => ({ value: `{font.${f}}`, label: `${cap(f)} font` })), v.fontFamily, (x) => put({ fontFamily: x }))}
        ${choose('Size', sizeSteps.map((s) => ({ value: `{font-size.${s}}`, label: `${s} (${tree['font-size'][s].$value.value}${tree['font-size'][s].$value.unit})` })), v.fontSize, (x) => put({ fontSize: x }))}
      </div>
      <div class="cd-field-row">
        ${field('Weight', number(v.fontWeight, (x) => x >= 1 && x <= 1000 && put({ fontWeight: x }), { min: 1, max: 1000 }))}
        ${field('Line height', number(v.lineHeight, (x) => x > 0 && put({ lineHeight: x }), { min: 0 }))}
      </div></div>`;
  };
  const type = area('Fonts and type', html`
    ${fontTokens.map((name) => {
      const current = [tree.font[name].$value].flat();
      const generic = GENERIC.includes(current.at(-1)) ? current.at(-1) : 'sans-serif';
      return choose(`${cap(name)} font`, families.map((f) => ({ value: f, label: f })), current[0],
        (f) => set(E.setToken(store.get(), `font.${name}`, { $value: [f, generic] })));
    })}
    ${repeat(Object.entries(tree.typography ?? {}).filter(([k, t]) => !k.startsWith('$') && t.$value && typeof t.$value === 'object'), ([name]) => name, typoView)}
    <h4>Font files</h4>
    <ul class="cd-list-editor">${repeat(meta.fontFiles, (f) => f.src, (f) => html`<li>
      <span>${f.family} ${f.weight} ${f.style}${f.subset ? ` (${f.subset})` : ''}</span>
      ${iconButton('trash', `Remove ${f.src}`, () => setMeta((m) => E.removeFontFile(m, f.src)))}</li>`)}</ul>
    ${uploadButton('Upload font files', (files) => app.addFontUploads(files), '.woff2,.woff,.ttf,.otf')}
    <p class="cd-hint">woff2, woff, ttf or otf. Family, weight and style are read from the file name.</p>
    <h4>Add from Fontsource</h4>
    <cd-fontsource-picker @pick=${(e) => setMeta((m) => E.addFontFiles(m, e.detail))}></cd-fontsource-picker>`);

  /* scales */
  const scaleGroup = (group, label) => {
    const g = tree[group];
    if (!g) return nothing;
    const gen = g.$extensions?.[vendor]?.scale;
    const regen = (patch) => {
      const next = structuredClone(g);
      next.$extensions[vendor].scale = { ...gen, ...patch };
      set(E.setToken(store.get(), group, applyScale(next, vendor)));
    };
    return html`<div><h4>${label}</h4>
      ${gen ? html`<div class="cd-field-row">
        ${field(`Base (${gen.base.unit})`, number(gen.base.value, (x) => regen({ base: { ...gen.base, value: x } })))}
        ${gen.ratio !== undefined ? field('Ratio', number(gen.ratio, (x) => x > 0 && regen({ ratio: x }))) : nothing}
      </div>` : nothing}
      <div class="cd-field-row">${own(g).map((step) => {
        const t = g[step];
        return field(`${step}${t.$extensions?.[vendor]?.overridden ? ' (set by hand)' : ''}`, number(t.$value.value,
          (x) => set(E.setToken(store.get(), group, setStep(g, step, { ...t.$value, value: x }, vendor)))));
      })}</div></div>`;
  };
  const scales = area('Scales', html`${scaleGroup('spacing', 'Spacing')}${scaleGroup('radius', 'Radius')}${scaleGroup('font-size', 'Font size')}`);

  /* shadow */
  const shadow = area('Shadow', Object.entries(tree.shadow ?? {})
    .filter(([k, t]) => !k.startsWith('$') && !Array.isArray(t.$value) && typeof t.$value === 'object').map(([name, t]) => {
      const v = t.$value;
      const put = (patch) => {
        const cur = fresh(`shadow.${name}`);
        set(E.setToken(store.get(), `shadow.${name}`, { ...cur, $value: { ...cur.$value, ...patch } }));
      };
      return html`<div><h4>${name}</h4><div class="cd-field-row">
        ${field('Offset Y (px)', number(v.offsetY.value, (x) => put({ offsetY: { value: x, unit: 'px' } })))}
        ${field('Blur (px)', number(v.blur.value, (x) => x >= 0 && put({ blur: { value: x, unit: 'px' } })))}
        ${typeof v.color === 'object' ? field('Opacity', number(v.color.alpha ?? 1, (x) => x >= 0 && x <= 1 && put({ color: { ...v.color, alpha: x } }), { min: 0, max: 1, step: 0.05 })) : nothing}
      </div></div>`;
    }));

  /* assets */
  const libraryFiles = [...library].filter((p) => !p.startsWith('brands/'));
  const groupView = (g) => {
    const libPick = libPicks.get(g.id) ?? libraryFiles[0];
    const addFromLibrary = (e) => {
      e.preventDefault();
      if (!g.items.some((x) => x.src === libPick)) setMeta((m) => E.addItems(m, g.id, [{ label: libPick.split('/').pop(), src: libPick }]));
    };
    return html`<div>
      <div class="cd-field-row">
        ${field('Group name', text(g.label, (v) => v && setMeta((m) => E.renameGroup(m, g.id, v))))}
        ${iconButton('up', `Move ${g.label} up`, () => setMeta((m) => E.moveGroup(m, g.id, -1)))}
        ${iconButton('down', `Move ${g.label} down`, () => setMeta((m) => E.moveGroup(m, g.id, 1)))}
        ${iconButton('trash', `Remove ${g.label}`, () => setMeta((m) => E.removeGroup(m, g.id)))}
      </div>
      <ul class="cd-list-editor">${repeat(g.items, (i) => i.src, (i) => html`<li>
        ${thumb(i, app.urlFor(i))}
        <div>
          ${field('Label', text(i.label, (v) => setMeta((m) => E.updateItem(m, g.id, i.src, { label: v }))))}
          ${field('Description', text(i.description, (v) => setMeta((m) => E.updateItem(m, g.id, i.src, { description: v || undefined }))), i.src)}
        </div>
        ${iconButton('up', `Move ${i.label} up`, () => setMeta((m) => E.moveItem(m, g.id, i.src, -1)))}
        ${iconButton('down', `Move ${i.label} down`, () => setMeta((m) => E.moveItem(m, g.id, i.src, 1)))}
        ${iconButton('trash', `Remove ${i.label}`, () => setMeta((m) => E.removeItem(m, g.id, i.src)))}
      </li>`)}</ul>
      ${uploadButton(`Upload to ${g.label}`, (files) => app.addUploads(files, g.id))}
      ${libraryFiles.length ? html`<form class="cd-field-row" @submit=${addFromLibrary}>
        <div class="cd-field"><span>From the library</span>
          <cd-listbox .label=${`Library file for ${g.label}`} .options=${libraryFiles.map((p) => ({ value: p, label: p }))} .value=${libPick}
            @change=${(e) => { libPicks.set(g.id, e.detail); refresh(); }}></cd-listbox></div>
        <button type="submit" class="btn btn-small">Add</button>
      </form>` : nothing}
    </div>`;
  };
  const addGroup = (e) => {
    e.preventDefault();
    const label = String(new FormData(e.currentTarget).get('label')).trim();
    if (!label) return;
    setMeta((m) => E.addGroup(m, label));
    e.currentTarget.reset();
  };
  const assets = area('Assets', html`
    ${repeat(meta.assetGroups, (g) => g.id, groupView)}
    <form class="cd-field-row" @submit=${addGroup}>
      ${field('New group', html`<input type="text" name="label" placeholder="Patterns">`)}
      <button type="submit" class="btn btn-small">Add group</button>
    </form>`);

  return html`${brand}${palette}${roles}${type}${scales}${shadow}${assets}`;
}
