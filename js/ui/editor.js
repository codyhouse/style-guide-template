// The edit drawer: forms that write through the store. Text inputs commit on change.
import { h, icon } from './dom.js';
import { listbox } from './listbox.js';
import { fontsourcePicker } from './fontsource-picker.js';
import * as E from '../lib/edit.js';
import { resolve, contexts } from '../lib/resolver.js';
import { brandMeta, withBrandMeta } from '../lib/assets.js';
import { applyScale, setStep } from '../lib/scale.js';
import { parseCssColor, toHex, toOklchString } from '../lib/color.js';
import { ROLES } from '../lib/contrast.js';

const SHADE = /^\d+$/;
const GENERIC = ['sans-serif', 'serif', 'monospace', 'cursive', 'system-ui'];

function field(label, input, hint) {
  return h('label', { class: 'cd-field' }, h('span', {}, label), input, hint ? h('span', { class: 'cd-hint' }, hint) : null);
}

function text(key, value, onCommit, attrs = {}) {
  const input = h('input', { type: 'text', value: value ?? '', 'data-key': key, ...attrs });
  input.addEventListener('change', () => onCommit(input.value.trim(), input));
  return input;
}

function number(key, value, onCommit, attrs = {}) {
  const input = h('input', { type: 'number', value: String(value ?? ''), 'data-key': key, step: 'any', ...attrs });
  input.addEventListener('change', () => {
    const n = Number(input.value);
    if (input.value !== '' && Number.isFinite(n)) onCommit(n);
  });
  return input;
}

function choose(key, label, options, value, onChange) {
  const el = h('div', { class: 'cd-field' }, h('span', { 'aria-hidden': 'true' }, label));
  const slot = h('div', { 'data-key': key });
  el.append(slot);
  listbox(slot, { label, options, value, onChange });
  return el;
}

const iconButton = (name, label, onclick, key) =>
  h('button', { type: 'button', class: 'cd-action', onclick, 'data-key': key, title: label }, icon(name), h('span', {}, label));

function colorError(input, ok) {
  input.setAttribute('aria-invalid', String(!ok));
  input.parentElement.querySelector('.cd-error')?.remove();
  if (!ok) input.parentElement.append(h('span', { class: 'cd-error' }, 'Use #rrggbb, rgb(r g b) or oklch(L C H).'));
}

export function renderEditor(body, app) {
  const { store, vendor, library, manifest } = app;
  const rerender = () => {
    const key = document.activeElement?.closest('[data-key]')?.dataset.key;
    renderEditor(body, app);
    if (key) body.querySelector(`[data-key="${CSS.escape(key)}"] button, [data-key="${CSS.escape(key)}"]`)?.focus();
  };
  const doc = store.get();
  const tree = E.foundation(doc);
  const tokens = resolve(doc, { theme: app.theme() });
  const meta = brandMeta(doc, vendor);
  // An edit that breaks an alias (e.g. removing a hue a role points to) is refused, not applied.
  // Edits read the token as it is now, so two edits in a row never undo each other.
  const fresh = (path) => path.split('.').reduce((n, k) => n?.[k], E.foundation(store.get()));
  const set = (next, structural) => {
    try {
      for (const c of contexts(next).filter((x) => x.modifier === 'theme')) resolve(next, { theme: c.context });
    } catch (e) {
      app.warn(`Not applied: ${e.message}`);
      return;
    }
    store.set(next);
    if (structural) rerender();
  };
  const setMeta = (fn, structural = true) => set(withBrandMeta(store.get(), vendor, fn(brandMeta(store.get(), vendor))), structural);

  /* brand */
  const brand = h('section', { class: 'cd-drawer-area' }, h('h3', {}, 'Brand'),
    field('Name', text('brand-name', doc.name, (v) => v && set({ ...store.get(), name: v }))),
    choose('brand-preset', 'Start from a preset', manifest.brands.map((b) => ({ value: b.path, label: b.name })), null, async (path) => {
      const next = await fetch(`library/${path}`).then((r) => r.json());
      store.load(next);
      rerender();
    }),
    h('div', { class: 'cd-field-row' },
      store.hasPrevious() ? h('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: () => { store.restorePrevious(); rerender(); } }, 'Restore previous draft') : null,
      h('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: () => { store.clearDraft(); rerender(); } }, 'Clear local draft')));

  /* palette */
  const hues = Object.keys(tree.color ?? {}).filter((k) => !k.startsWith('$') && !ROLES.includes(k)
    && Object.keys(tree.color[k]).some((s) => SHADE.test(s)));
  const palette = h('section', { class: 'cd-drawer-area' }, h('h3', {}, 'Palette'),
    hues.map((hue) => {
      const shades = Object.keys(tree.color[hue]).filter((s) => SHADE.test(s));
      const base = tree.color[hue].$extensions?.[vendor]?.base ?? ('600' in tree.color[hue] ? '600' : shades[Math.floor(shades.length / 2)]);
      return h('div', { class: 'cd-hue' },
        h('div', { class: 'cd-field-row' },
          field(`${hue} base color`, text(`hue-${hue}`, toHex(tree.color[hue][base].$value), (v, input) => {
            const c = parseCssColor(v);
            colorError(input, !!c);
            if (c) set(E.setHue(store.get(), hue, c, vendor), true);
          }), `Your color is kept as ${hue}-${base}. The other ${shades.length - 1} shades are generated from it.`),
          iconButton('trash', `Remove ${hue}`, () => set(E.removeHue(store.get(), hue), true), `rm-hue-${hue}`)),
        h('ol', { class: 'cd-mini-scale', 'aria-label': `${hue} shades` }, shades.map((s) => h('li', {
          class: s === base ? 'is-base' : null, title: `${hue}-${s}${s === base ? ' (your color)' : ''}`,
          style: { background: `var(--color-${hue}-${s})` },
        }, h('span', { class: 'cd-sr-only' }, `${hue}-${s}${s === base ? ', your color' : ''}`)))),
        h('details', {}, h('summary', {}, `${hue} shades, CMYK and Pantone`),
          shades.map((s) => {
            const t = tree.color[hue][s];
            const ext = t.$extensions?.[vendor] ?? {};
            const path = `color.${hue}.${s}`;
            const setExt = (patch) => {
              const cur = fresh(path);
              set(E.setToken(store.get(), path, { ...cur, $extensions: { ...cur.$extensions, [vendor]: { ...cur.$extensions?.[vendor], ...patch } } }));
            };
            return h('div', { class: 'cd-field-row' },
              field(`${hue}-${s}`, text(`shade-${hue}-${s}`, toOklchString(t.$value), (v, input) => {
                const c = parseCssColor(v);
                colorError(input, !!c);
                if (c) set(E.setToken(store.get(), path, { ...fresh(path), $value: c }));
              })),
              field('CMYK', text(`cmyk-${hue}-${s}`, ext.cmyk?.join(' '), (v) => {
                const parts = v.split(/[\s,]+/).filter(Boolean).map(Number);
                setExt({ cmyk: parts.length === 4 && parts.every((n) => n >= 0 && n <= 100) ? parts : undefined });
              }, { placeholder: 'C M Y K' })),
              field('Pantone', text(`pantone-${hue}-${s}`, ext.pantone, (v) => setExt({ pantone: v || undefined }))));
          })));
    }),
    (() => {
      const name = text('new-hue-name', '', () => {}, { placeholder: 'accent' });
      const color = text('new-hue-color', '', () => {}, { placeholder: 'e.g. oklch(0.6 0.15 260)' });
      return h('div', { class: 'cd-field-row' }, field('New hue name', name), field('Color', color),
        h('button', { type: 'button', class: 'btn btn-small', onclick: () => {
          const c = parseCssColor(color.value);
          const id = name.value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
          colorError(color, !!c);
          if (c && id && !ROLES.includes(id)) set(E.setHue(store.get(), id, c, vendor), true);
        } }, 'Add hue'));
    })());

  /* roles */
  const shadeOptions = hues.flatMap((hue) => Object.keys(tree.color[hue]).filter((s) => SHADE.test(s))
    .map((s) => ({ value: `{color.${hue}.${s}}`, label: `${hue}-${s}` })));
  const roles = h('section', { class: 'cd-drawer-area' }, h('h3', {}, 'Roles'),
    h('p', { class: 'cd-hint' }, `Editing the ${app.theme()} theme. Switch the theme in the header to edit the other.`),
    ROLES.map((role) => {
      const props = [...tokens.keys()].filter((p) => p.startsWith(`color.${role}.`));
      if (!props.length) return null;
      return h('div', {}, h('h4', {}, role), props.map((p) => {
        const value = tokens.get(p).value;
        const options = shadeOptions.some((o) => o.value === value) ? shadeOptions : [{ value, label: 'Custom value' }, ...shadeOptions];
        return choose(`role-${p}`, p.replace(/^color\./, ''), options, value, (v) => set(E.setRole(store.get(), app.theme(), p.replace(/^color\./, ''), v)));
      }));
    }));

  /* fonts and type */
  const families = [...new Set([...meta.fontFiles.map((f) => f.family),
    ...Object.values(tree.font ?? {}).flatMap((t) => (t?.$value ? [[t.$value].flat()[0]] : []))])];
  const fontTokens = Object.keys(tree.font ?? {}).filter((k) => !k.startsWith('$'));
  const sizeSteps = Object.keys(tree['font-size'] ?? {}).filter((k) => !k.startsWith('$'));
  const fontUpload = h('input', { type: 'file', accept: '.woff2,.woff,.ttf,.otf', multiple: true, 'data-key': 'font-upload' });
  fontUpload.addEventListener('change', async () => { await app.addFontUploads([...fontUpload.files]); rerender(); });
  const pickerEl = h('div', {});
  fontsourcePicker(pickerEl, { onPick: (entries) => { setMeta((m) => E.addFontFiles(m, entries)); } });
  const type = h('section', { class: 'cd-drawer-area' }, h('h3', {}, 'Fonts and type'),
    fontTokens.map((name) => {
      const current = [tree.font[name].$value].flat();
      const generic = GENERIC.includes(current.at(-1)) ? current.at(-1) : 'sans-serif';
      return choose(`font-${name}`, `font-${name}`, families.map((f) => ({ value: f, label: f })), current[0],
        (f) => set(E.setToken(store.get(), `font.${name}`, { $value: [f, generic] })));
    }),
    Object.entries(tree.typography ?? {}).filter(([k, t]) => !k.startsWith('$') && t.$value && typeof t.$value === 'object').map(([name, t]) => {
      const v = t.$value;
      const put = (patch) => {
        const cur = fresh(`typography.${name}`);
        set(E.setToken(store.get(), `typography.${name}`, { ...cur, $value: { ...cur.$value, ...patch } }));
      };
      return h('div', {}, h('h4', {}, name),
        h('div', { class: 'cd-field-row' },
          choose(`typo-${name}-font`, 'Font', fontTokens.map((f) => ({ value: `{font.${f}}`, label: `font-${f}` })), v.fontFamily, (x) => put({ fontFamily: x })),
          choose(`typo-${name}-size`, 'Size', sizeSteps.map((s) => ({ value: `{font-size.${s}}`, label: `font-size-${s}` })), v.fontSize, (x) => put({ fontSize: x }))),
        h('div', { class: 'cd-field-row' },
          field('Weight', number(`typo-${name}-weight`, v.fontWeight, (x) => x >= 1 && x <= 1000 && put({ fontWeight: x }), { min: 1, max: 1000 })),
          field('Line height', number(`typo-${name}-lh`, v.lineHeight, (x) => x > 0 && put({ lineHeight: x }), { min: 0 }))));
    }),
    h('h4', {}, 'Font files'),
    h('ul', { class: 'cd-list-editor' }, meta.fontFiles.map((f) => h('li', {},
      h('span', {}, `${f.family} ${f.weight} ${f.style}${f.subset ? ` (${f.subset})` : ''}`),
      iconButton('trash', `Remove ${f.src}`, () => setMeta((m) => E.removeFontFile(m, f.src)), `rm-font-${f.src}`)))),
    field('Upload font files', fontUpload, 'woff2, woff, ttf or otf. Family, weight and style are read from the file name.'),
    h('h4', {}, 'Add from Fontsource'), pickerEl);

  /* scales */
  const scaleGroup = (group, label) => {
    const g = tree[group];
    const gen = g?.$extensions?.[vendor]?.scale;
    if (!g) return null;
    const regen = (patch) => {
      const next = structuredClone(g);
      next.$extensions[vendor].scale = { ...gen, ...patch };
      set(E.setToken(store.get(), group, applyScale(next, vendor)), true);
    };
    return h('div', {}, h('h4', {}, label),
      gen ? h('div', { class: 'cd-field-row' },
        field(`Base (${gen.base.unit})`, number(`${group}-base`, gen.base.value, (x) => regen({ base: { ...gen.base, value: x } }))),
        gen.ratio !== undefined ? field('Ratio', number(`${group}-ratio`, gen.ratio, (x) => x > 0 && regen({ ratio: x }))) : null) : null,
      h('div', { class: 'cd-field-row' }, Object.keys(g).filter((k) => !k.startsWith('$')).map((step) => {
        const t = g[step];
        const overridden = t.$extensions?.[vendor]?.overridden;
        return field(`${step}${overridden ? ' (set by hand)' : ''}`, number(`${group}-${step}`, t.$value.value,
          (x) => set(E.setToken(store.get(), group, setStep(g, step, { ...t.$value, value: x }, vendor)), true)));
      })));
  };
  const scales = h('section', { class: 'cd-drawer-area' }, h('h3', {}, 'Scales'),
    scaleGroup('spacing', 'Spacing'), scaleGroup('radius', 'Radius'), scaleGroup('font-size', 'Font size'));

  /* shadow */
  const shadow = h('section', { class: 'cd-drawer-area' }, h('h3', {}, 'Shadow'),
    Object.entries(tree.shadow ?? {}).filter(([k, t]) => !k.startsWith('$') && !Array.isArray(t.$value) && typeof t.$value === 'object').map(([name, t]) => {
      const v = t.$value;
      const put = (patch) => {
        const cur = fresh(`shadow.${name}`);
        set(E.setToken(store.get(), `shadow.${name}`, { ...cur, $value: { ...cur.$value, ...patch } }));
      };
      return h('div', { class: 'cd-field-row' }, h('h4', {}, name),
        field('Offset Y (px)', number(`shadow-${name}-y`, v.offsetY.value, (x) => put({ offsetY: { value: x, unit: 'px' } }))),
        field('Blur (px)', number(`shadow-${name}-blur`, v.blur.value, (x) => x >= 0 && put({ blur: { value: x, unit: 'px' } }))),
        typeof v.color === 'object' ? field('Opacity', number(`shadow-${name}-a`, v.color.alpha ?? 1, (x) => x >= 0 && x <= 1 && put({ color: { ...v.color, alpha: x } }), { min: 0, max: 1, step: 0.05 })) : null);
    }));

  /* assets */
  const libraryFiles = [...library].filter((p) => !p.startsWith('brands/'));
  const assets = h('section', { class: 'cd-drawer-area' }, h('h3', {}, 'Assets'),
    meta.assetGroups.map((g) => {
      const upload = h('input', { type: 'file', multiple: true, 'data-key': `upload-${g.id}` });
      upload.addEventListener('change', async () => { await app.addUploads([...upload.files], g.id); rerender(); });
      let libPick = libraryFiles[0];
      const libSlot = h('div', {});
      listbox(libSlot, { label: `Library file for ${g.label}`, options: libraryFiles.map((p) => ({ value: p, label: p })), value: libPick, onChange: (v) => { libPick = v; } });
      return h('div', {},
        h('div', { class: 'cd-field-row' },
          field('Group name', text(`group-${g.id}`, g.label, (v) => v && setMeta((m) => E.renameGroup(m, g.id, v), false))),
          iconButton('up', `Move ${g.label} up`, () => setMeta((m) => E.moveGroup(m, g.id, -1)), `up-${g.id}`),
          iconButton('down', `Move ${g.label} down`, () => setMeta((m) => E.moveGroup(m, g.id, 1)), `down-${g.id}`),
          iconButton('trash', `Remove ${g.label}`, () => setMeta((m) => E.removeGroup(m, g.id)), `rm-${g.id}`)),
        h('ul', { class: 'cd-list-editor' }, g.items.map((i) => h('li', {},
          h('div', {},
            field('Label', text(`label-${g.id}-${i.src}`, i.label, (v) => setMeta((m) => E.updateItem(m, g.id, i.src, { label: v }), false))),
            field('Description', text(`desc-${g.id}-${i.src}`, i.description, (v) => setMeta((m) => E.updateItem(m, g.id, i.src, { description: v || undefined }), false)), i.src)),
          iconButton('up', `Move ${i.label} up`, () => setMeta((m) => E.moveItem(m, g.id, i.src, -1)), `up-${g.id}-${i.src}`),
          iconButton('down', `Move ${i.label} down`, () => setMeta((m) => E.moveItem(m, g.id, i.src, 1)), `down-${g.id}-${i.src}`),
          iconButton('trash', `Remove ${i.label}`, () => setMeta((m) => E.removeItem(m, g.id, i.src)), `rm-${g.id}-${i.src}`)))),
        field('Upload files', upload),
        libraryFiles.length ? h('div', { class: 'cd-field-row' }, h('div', { class: 'cd-field' }, h('span', {}, 'From the library'), libSlot),
          h('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: () => {
            if (!g.items.some((x) => x.src === libPick)) setMeta((m) => E.addItems(m, g.id, [{ label: libPick.split('/').pop(), src: libPick }]));
          } }, 'Add')) : null);
    }),
    (() => {
      const name = text('new-group', '', () => {}, { placeholder: 'Patterns' });
      return h('div', { class: 'cd-field-row' }, field('New group', name),
        h('button', { type: 'button', class: 'btn btn-small', onclick: () => name.value.trim() && setMeta((m) => E.addGroup(m, name.value.trim())) }, 'Add group'));
    })());

  body.replaceChildren(brand, palette, roles, type, scales, shadow, assets);
}
