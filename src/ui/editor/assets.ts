// <sg-edit-assets>: asset groups (rename, reorder, remove), their files (label, description, order),
// uploads, files from the site library, and new groups.
import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import * as E from '../../lib/edit.js';
import { fileName } from '../../lib/path.js';
import type { AssetGroup } from '../../lib/types.js';
import { urlFor } from '../urls.js';
import '../listbox.js';
import { EditorArea, type EditorContext } from './context.js';
import { field, iconButton, text, thumb, uploadButton } from './fields.js';

@customElement('sg-edit-assets')
export class EditAssets extends EditorArea {
  /** the library file picked for each group, until it is added */
  @state() private picks = new Map<string, string>();

  private group({ session, setMeta }: EditorContext, g: AssetGroup, library: string[]) {
    const pick = this.picks.get(g.id) ?? library[0];
    const addFromLibrary = (e: SubmitEvent) => {
      e.preventDefault();
      if (!g.items.some((x) => x.src === pick))
        setMeta((m) => E.addItems(m, g.id, [{ label: fileName(pick), src: pick }]));
    };
    const label = g.label ?? g.id;
    return html`
      <div>
        <div class="cd-field-row">
          ${field(
            'Group name',
            text(g.label, (v) => v && setMeta((m) => E.renameGroup(m, g.id, v))),
          )}
          ${iconButton('up', `Move ${label} up`, () => setMeta((m) => E.moveGroup(m, g.id, -1)))}
          ${iconButton('down', `Move ${label} down`, () => setMeta((m) => E.moveGroup(m, g.id, 1)))}
          ${iconButton('trash', `Remove ${label}`, () => setMeta((m) => E.removeGroup(m, g.id)))}
        </div>
        <ul class="cd-list-editor">
          ${repeat(
            g.items,
            (i) => i.src,
            (i) => html`
              <li>
                ${thumb(i, urlFor(i, session.ctx))}
                <div>
                  ${field(
                    'Label',
                    text(i.label, (v) => setMeta((m) => E.updateItem(m, g.id, i.src, { label: v }))),
                  )}
                  ${field(
                    'Description',
                    text(i.description, (v) =>
                      setMeta((m) => E.updateItem(m, g.id, i.src, { description: v || undefined })),
                    ),
                    i.src,
                  )}
                </div>
                ${iconButton('up', `Move ${i.label} up`, () => setMeta((m) => E.moveItem(m, g.id, i.src, -1)))}
                ${iconButton('down', `Move ${i.label} down`, () => setMeta((m) => E.moveItem(m, g.id, i.src, 1)))}
                ${iconButton('trash', `Remove ${i.label}`, () => setMeta((m) => E.removeItem(m, g.id, i.src)))}
              </li>
            `,
          )}
        </ul>
        ${uploadButton(`Upload to ${label}`, (files) => session.addUploads(files, g.id))}
        ${
          library.length
            ? html`<form class="cd-field-row" @submit=${addFromLibrary}>
                <div class="cd-field">
                  <span>From the library</span>
                  <cd-listbox
                    label="Library file for ${label}"
                    .options=${library.map((p) => ({ value: p, label: p }))}
                    .value=${pick}
                    @change=${(e: CustomEvent<string>) => (this.picks = new Map(this.picks).set(g.id, e.detail))}
                  ></cd-listbox>
                </div>
                <button type="submit" class="btn btn-small">Add</button>
              </form>`
            : nothing
        }
      </div>
    `;
  }

  private addGroup(e: SubmitEvent, { setMeta }: EditorContext) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const label = String(new FormData(form).get('label') ?? '').trim();
    if (!label) return;
    setMeta((m) => E.addGroup(m, label));
    form.reset();
  }

  protected renderArea(ctx: EditorContext) {
    const library = [...ctx.session.library].filter((p) => !p.startsWith('brands/'));
    return html`
      ${repeat(
        ctx.meta.assetGroups,
        (g) => g.id,
        (g) => this.group(ctx, g, library),
      )}
      <form class="cd-field-row" @submit=${(e: SubmitEvent) => this.addGroup(e, ctx)}>
        ${field('New group', html`<input type="text" name="label" placeholder="Patterns" />`)}
        <button type="submit" class="btn btn-small">Add group</button>
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sg-edit-assets': EditAssets;
  }
}
