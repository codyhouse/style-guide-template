// <sg-edit-brand>: the brand's name, loading and saving, presets, and the local draft.
import { html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Session } from '../../app/session.js';
import { EditorArea, type EditorContext } from './context.js';
import { choose, field, text } from './fields.js';

@customElement('sg-edit-brand')
export class EditBrand extends EditorArea {
  private request(action: 'load' | 'save' | 'export') {
    this.dispatchEvent(new CustomEvent('brand-action', { detail: action, bubbles: true }));
  }

  private async replace(session: Session, path: string) {
    try {
      session.store.load(await Session.fetchPreset(path));
    } catch (e) {
      session.warn(`Could not load the preset: ${(e as Error).message}`);
    }
  }

  protected renderArea({ session, doc, set }: EditorContext) {
    const { store, manifest } = session;
    const presets = manifest.brands.map((b) => ({ value: b.path, label: b.name }));
    return html`
      ${field(
        'Name',
        text(doc.name, (v) => v && set({ ...store.get(), name: v })),
      )}
      <div class="cd-field-row">
        <button type="button" class="btn btn-secondary btn-small" @click=${() => this.request('load')}>
          Load file
        </button>
        <button type="button" class="btn btn-secondary btn-small" @click=${() => this.request('save')}>
          Save JSON
        </button>
        <button type="button" class="btn btn-secondary btn-small" @click=${() => this.request('export')}>
          Export ZIP
        </button>
      </div>
      ${choose('Replace with a preset', presets, null, (path) => this.replace(session, path))}
      <div class="cd-field-row">
        <button type="button" class="btn btn-secondary btn-small" @click=${() => store.clearDraft()}>
          Clear local draft
        </button>
        ${
          store.hasPrevious()
            ? html`<button
                type="button"
                class="btn btn-secondary btn-small"
                @click=${() => store.restorePrevious()}
              >
                Restore previous draft
              </button>`
            : nothing
        }
      </div>
      <p class="cd-hint">
        Clearing or replacing keeps your previous draft, so it can be restored. Undo (Ctrl+Z) steps back
        through every edit.
      </p>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sg-edit-brand': EditBrand;
  }
}
