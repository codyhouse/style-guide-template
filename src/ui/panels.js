// Panels above the guide: contrast, missing files, files waiting for a group, warnings.
import { html, nothing } from 'lit-html';
import { icon } from './dom.js';
import './listbox.js';

const NEW_GROUP = '__new';
// what the user picked in a panel's listbox, until they act on it
const targets = new WeakMap();
let pendingTarget = null;

const status = (pass, text) => html`<span class="cd-status ${pass ? 'is-pass' : 'is-warn'}">${icon(pass ? 'check' : 'alert')}${text}</span>`;

function contrastPanel(contrast) {
  const failing = contrast.filter((r) => !r.pass).length;
  return html`<div class="cd-box cd-panel">
    <h2>Contrast</h2>
    ${status(!failing, failing ? `${failing} pair${failing > 1 ? 's' : ''} below the minimum` : `All ${contrast.length} required pairs pass`)}
    <details><summary>Show all pairs</summary>
      <table class="cd-roles">
        <thead><tr><th>Theme</th><th>Pair</th><th>Ratio</th><th>Minimum</th><th>Result</th></tr></thead>
        <tbody>${contrast.map((r) => html`<tr><td>${r.context}</td><td>${r.label}</td><td>${r.ratio}:1</td><td>${r.min}:1</td>
          <td>${status(r.pass, r.pass ? 'Pass' : 'Warning')}</td></tr>`)}</tbody>
      </table>
    </details>
  </div>`;
}

function dropZone(text, onFiles) {
  const over = (e, on) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.toggle('is-over', on); };
  return html`<div class="cd-drop-zone" @dragover=${(e) => over(e, true)} @dragleave=${(e) => e.currentTarget.classList.remove('is-over')}
    @drop=${(e) => { over(e, false); onFiles([...e.dataTransfer.files]); }}>
    ${text} <button type="button" class="btn btn-secondary btn-small" @click=${(e) => e.currentTarget.nextElementSibling.click()}>Choose files</button>
    <input type="file" multiple hidden @change=${(e) => { onFiles([...e.target.files]); e.target.value = ''; }}>
  </div>`;
}

function missingPanel(missing, ambiguous, { onMissingFiles, onAssign, refresh }) {
  return html`<div class="cd-box cd-panel">
    <h2>Missing files</h2>
    <p>This brand refers to files that are not loaded. Drop them here; they are matched by file name.</p>
    <ul>${missing.map((m) => html`<li><code>${m}</code></li>`)}</ul>
    ${ambiguous.map(({ file, candidates }) => html`<div class="cd-field-row">
      <div class="cd-field"><span>${file.name} matches more than one file</span>
        <cd-listbox .label=${`Where does ${file.name} go?`} .options=${candidates.map((c) => ({ value: c, label: c }))}
          .value=${targets.get(file) ?? candidates[0]} @change=${(e) => { targets.set(file, e.detail); refresh(); }}></cd-listbox></div>
      <button type="button" class="btn btn-small" @click=${() => onAssign(file, targets.get(file) ?? candidates[0])}>Use here</button>
    </div>`)}
    ${dropZone('Drop the missing files here, or', onMissingFiles)}
  </div>`;
}

function pendingPanel(pending, groups, { onAddPending, onDiscardPending, refresh }) {
  const options = [...groups.map((g) => ({ value: g.id, label: g.label ?? g.id })), { value: NEW_GROUP, label: 'New group: Uploads' }];
  const target = options.some((o) => o.value === pendingTarget) ? pendingTarget : options[0].value;
  return html`<div class="cd-box cd-panel">
    <h2>${pending.length} file${pending.length > 1 ? 's' : ''} to add</h2>
    <ul>${pending.map((f) => html`<li>${f.name}</li>`)}</ul>
    <div class="cd-field-row">
      <div class="cd-field"><span>Add to group</span>
        <cd-listbox .label=${'Asset group'} .options=${options} .value=${target}
          @change=${(e) => { pendingTarget = e.detail; refresh(); }}></cd-listbox></div>
      <button type="button" class="btn btn-small" @click=${() => onAddPending(target === NEW_GROUP ? null : target)}>Add files</button>
      <button type="button" class="btn btn-secondary btn-small" @click=${onDiscardPending}>Discard</button>
    </div>
  </div>`;
}

function warningsPanel(warnings, { onDismissWarnings }) {
  return html`<div class="cd-box cd-panel" role="alert">
    <h2>Warnings</h2>
    <ul>${warnings.map((w) => html`<li>${status(false, '')} ${w}</li>`)}</ul>
    <button type="button" class="btn btn-secondary btn-small" @click=${onDismissWarnings}>Dismiss</button>
  </div>`;
}

export const panelsView = ({ contrast, missing, ambiguous, pending, groups, warnings, handlers }) => html`
  ${warnings.length ? warningsPanel(warnings, handlers) : nothing}
  ${pending.length ? pendingPanel(pending, groups, handlers) : nothing}
  ${missing.length ? missingPanel(missing, ambiguous, handlers) : nothing}
  ${contrastPanel(contrast)}`;
