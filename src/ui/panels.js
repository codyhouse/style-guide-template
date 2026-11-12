// Panels above the guide: contrast, missing files, files waiting for a group, warnings.
import { h, icon } from './dom.js';
import { listbox } from './listbox.js';

const status = (pass, text) => h('span', { class: `cd-status ${pass ? 'is-pass' : 'is-warn'}` }, icon(pass ? 'check' : 'alert'), text);

function contrastPanel(contrast) {
  const failing = contrast.filter((r) => !r.pass);
  return h('div', { class: 'cd-box cd-panel' },
    h('h2', {}, 'Contrast'),
    status(!failing.length, failing.length ? `${failing.length} pair${failing.length > 1 ? 's' : ''} below the minimum` : `All ${contrast.length} required pairs pass`),
    h('details', {}, h('summary', {}, 'Show all pairs'),
      h('table', { class: 'cd-roles' },
        h('thead', {}, h('tr', {}, ['Theme', 'Pair', 'Ratio', 'Minimum', 'Result'].map((t) => h('th', {}, t)))),
        h('tbody', {}, contrast.map((r) => h('tr', {},
          h('td', {}, r.context), h('td', {}, r.label), h('td', {}, `${r.ratio}:1`), h('td', {}, `${r.min}:1`),
          h('td', {}, status(r.pass, r.pass ? 'Pass' : 'Warning'))))))));
}

function dropZone(text, onFiles) {
  const input = h('input', { type: 'file', multiple: true, hidden: true });
  const zone = h('div', { class: 'cd-drop-zone' }, text, ' ',
    h('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: () => input.click() }, 'Choose files'), input);
  input.addEventListener('change', () => { onFiles([...input.files]); input.value = ''; });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); zone.classList.add('is-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('is-over');
    onFiles([...e.dataTransfer.files]);
  });
  return zone;
}

function missingPanel(missing, ambiguous, { onMissingFiles, onAssign }) {
  return h('div', { class: 'cd-box cd-panel' },
    h('h2', {}, 'Missing files'),
    h('p', {}, 'This brand refers to files that are not loaded. Drop them here; they are matched by file name.'),
    h('ul', {}, missing.map((m) => h('li', {}, h('code', {}, m)))),
    ambiguous.map(({ file, candidates }) => {
      let target = candidates[0];
      const pick = h('div', {});
      listbox(pick, { label: `Where does ${file.name} go?`, options: candidates.map((c) => ({ value: c, label: c })), value: target, onChange: (v) => { target = v; } });
      return h('div', { class: 'cd-field-row' },
        h('div', { class: 'cd-field' }, h('span', {}, `${file.name} matches more than one file`), pick),
        h('button', { type: 'button', class: 'btn btn-small', onclick: () => onAssign(file, target) }, 'Use here'));
    }),
    dropZone('Drop the missing files here, or', onMissingFiles));
}

function pendingPanel(pending, groups, { onAddPending, onDiscardPending }) {
  let target = groups[0]?.id ?? '__new';
  const pick = h('div', {});
  listbox(pick, {
    label: 'Asset group',
    options: [...groups.map((g) => ({ value: g.id, label: g.label ?? g.id })), { value: '__new', label: 'New group: Uploads' }],
    value: target,
    onChange: (v) => { target = v; },
  });
  return h('div', { class: 'cd-box cd-panel' },
    h('h2', {}, `${pending.length} file${pending.length > 1 ? 's' : ''} to add`),
    h('ul', {}, pending.map((f) => h('li', {}, f.name))),
    h('div', { class: 'cd-field-row' },
      h('div', { class: 'cd-field' }, h('span', {}, 'Add to group'), pick),
      h('button', { type: 'button', class: 'btn btn-small', onclick: () => onAddPending(target) }, 'Add files'),
      h('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: onDiscardPending }, 'Discard')));
}

function warningsPanel(warnings, { onDismissWarnings }) {
  return h('div', { class: 'cd-box cd-panel', role: 'alert' },
    h('h2', {}, 'Warnings'),
    h('ul', {}, warnings.map((w) => h('li', {}, status(false, ''), ' ', w))),
    h('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: onDismissWarnings }, 'Dismiss'));
}

export function renderPanels(root, { contrast, missing, ambiguous, pending, groups, warnings, handlers }) {
  root.replaceChildren(
    ...(warnings.length ? [warningsPanel(warnings, handlers)] : []),
    ...(pending.length ? [pendingPanel(pending, groups, handlers)] : []),
    ...(missing.length ? [missingPanel(missing, ambiguous, handlers)] : []),
    contrastPanel(contrast),
  );
}
