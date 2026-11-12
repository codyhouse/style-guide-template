// <sg-panels>: above the guide, warnings, files waiting for a group, missing files, and contrast.
import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Session } from '../../app/session.js';
import type { ContrastResult } from '../../lib/types.js';
import { icon } from '../dom.js';
import { LightElement } from '../light-element.js';
import '../listbox.js';

const NEW_GROUP = '__new';
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const status = (pass: boolean, text: string) =>
  html`<span class="cd-status ${pass ? 'is-pass' : 'is-warn'}"
    >${icon(pass ? 'check' : 'alert')}${text}</span
  >`;

function dropZone(text: string, onFiles: (files: File[]) => void) {
  const over = (e: DragEvent, on: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).classList.toggle('is-over', on);
  };
  const choose = (e: Event) => {
    const input = e.target as HTMLInputElement;
    onFiles([...(input.files ?? [])]);
    input.value = '';
  };
  // dragleave keeps propagating: the page counts it to hide its own drop overlay
  return html`
    <div
      class="cd-drop-zone"
      @dragover=${(e: DragEvent) => over(e, true)}
      @dragleave=${(e: DragEvent) => (e.currentTarget as Element).classList.remove('is-over')}
      @drop=${(e: DragEvent) => {
        over(e, false);
        onFiles([...(e.dataTransfer?.files ?? [])]);
      }}
    >
      ${text}
      <button
        type="button"
        class="btn btn-secondary btn-small"
        @click=${(e: Event) => ((e.currentTarget as Element).nextElementSibling as HTMLInputElement).click()}
      >
        Choose files
      </button>
      <input type="file" multiple hidden @change=${choose} />
    </div>
  `;
}

@customElement('sg-panels')
export class Panels extends LightElement {
  @property({ attribute: false }) session?: Session;
  @property({ attribute: false }) contrast: ContrastResult[] = [];
  @property({ attribute: false }) missing: string[] = [];

  /** what the user picked in a panel's listbox, until they act on it */
  @state() private targets = new WeakMap<File, string>();
  @state() private pendingTarget: string | null = null;

  private warnings(warnings: string[], session: Session) {
    return html`
      <div class="cd-box cd-panel" role="alert">
        <h2>Warnings</h2>
        <ul>
          ${warnings.map((w) => html`<li>${status(false, '')} ${w}</li>`)}
        </ul>
        <button type="button" class="btn btn-secondary btn-small" @click=${() => session.dismissWarnings()}>
          Dismiss
        </button>
      </div>
    `;
  }

  private pending(session: Session) {
    const options = [
      ...session.meta.assetGroups.map((g) => ({ value: g.id, label: g.label ?? g.id })),
      { value: NEW_GROUP, label: 'New group: Uploads' },
    ];
    const target = options.some((o) => o.value === this.pendingTarget)
      ? this.pendingTarget
      : options[0].value;
    return html`
      <div class="cd-box cd-panel">
        <h2>${plural(session.pending.length, 'file')} to add</h2>
        <ul>
          ${session.pending.map((f) => html`<li>${f.name}</li>`)}
        </ul>
        <div class="cd-field-row">
          <div class="cd-field">
            <span>Add to group</span>
            <cd-listbox
              label="Asset group"
              .options=${options}
              .value=${target}
              @change=${(e: CustomEvent<string>) => (this.pendingTarget = e.detail)}
            ></cd-listbox>
          </div>
          <button
            type="button"
            class="btn btn-small"
            @click=${() => session.addPending(target === NEW_GROUP ? null : target)}
          >
            Add files
          </button>
          <button type="button" class="btn btn-secondary btn-small" @click=${() => session.discardPending()}>
            Discard
          </button>
        </div>
      </div>
    `;
  }

  private missingFiles(session: Session) {
    return html`
      <div class="cd-box cd-panel">
        <h2>Missing files</h2>
        <p>This brand refers to files that are not loaded. Drop them here; they are matched by file name.</p>
        <ul>
          ${this.missing.map((m) => html`<li><code>${m}</code></li>`)}
        </ul>
        ${session.ambiguous.map(({ file, candidates }) => {
          const target = this.targets.get(file) ?? candidates[0];
          return html`
            <div class="cd-field-row">
              <div class="cd-field">
                <span>${file.name} matches more than one file</span>
                <cd-listbox
                  label="Where does ${file.name} go?"
                  .options=${candidates.map((c) => ({ value: c, label: c }))}
                  .value=${target}
                  @change=${(e: CustomEvent<string>) => {
                    this.targets.set(file, e.detail);
                    this.requestUpdate();
                  }}
                ></cd-listbox>
              </div>
              <button type="button" class="btn btn-small" @click=${() => session.assign(file, target)}>
                Use here
              </button>
            </div>
          `;
        })}
        ${dropZone('Drop the missing files here, or', (files) => session.fillMissing(files))}
      </div>
    `;
  }

  private contrastPanel() {
    const failing = this.contrast.filter((r) => !r.pass).length;
    return html`
      <div class="cd-box cd-panel">
        <h2>Contrast</h2>
        ${status(
          !failing,
          failing
            ? `${plural(failing, 'pair')} below the minimum`
            : `All ${this.contrast.length} required pairs pass`,
        )}
        <details>
          <summary>Show all pairs</summary>
          <table class="cd-roles">
            <thead>
              <tr>
                <th>Theme</th>
                <th>Pair</th>
                <th>Ratio</th>
                <th>Minimum</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              ${this.contrast.map(
                (r) => html`
                  <tr>
                    <td>${r.context}</td>
                    <td>${r.label}</td>
                    <td>${r.ratio}:1</td>
                    <td>${r.min}:1</td>
                    <td>${status(r.pass, r.pass ? 'Pass' : 'Warning')}</td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </details>
      </div>
    `;
  }

  protected override render() {
    const { session } = this;
    if (!session) return nothing;
    const warnings = session.store.saveError
      ? [...session.warnings, 'Your edits could not be saved in this browser. Save JSON to keep them.']
      : session.warnings;
    return html`
      ${warnings.length ? this.warnings(warnings, session) : nothing}
      ${session.pending.length ? this.pending(session) : nothing}
      ${this.missing.length ? this.missingFiles(session) : nothing} ${this.contrastPanel()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sg-panels': Panels;
  }
}
