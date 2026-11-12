// <sg-edit-type>: the font tokens, the text styles, and the brand's font files (uploaded or from Fontsource).
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import * as E from '../../lib/edit.js';
import type { FontFile, TokenNode } from '../../lib/types.js';
import '../fontsource-picker.js';
import { EditorArea, type EditorContext } from './context.js';
import { cap, choose, field, iconButton, number, uploadButton } from './fields.js';

const GENERIC = ['sans-serif', 'serif', 'monospace', 'cursive', 'system-ui'];
const own = (o?: TokenNode) => Object.keys(o ?? {}).filter((k) => !k.startsWith('$'));

@customElement('sg-edit-type')
export class EditType extends EditorArea {
  private textStyle(ctx: EditorContext, name: string, value: TokenNode) {
    const { tree, session, set, fresh } = ctx;
    const path = `typography.${name}`;
    const put = (patch: Record<string, unknown>) => {
      const cur = fresh(path);
      set(E.setToken(session.store.get(), path, { ...cur, $value: { ...cur.$value, ...patch } }));
    };
    const fonts = own(tree.font).map((f) => ({ value: `{font.${f}}`, label: `${cap(f)} font` }));
    const sizes = own(tree['font-size']).map((s) => {
      const { value: v, unit } = tree['font-size'][s].$value;
      return { value: `{font-size.${s}}`, label: `${s} (${v}${unit})` };
    });
    return html`
      <div>
        <h4>${cap(name.replace(/-/g, ' '))}</h4>
        <div class="cd-field-row">
          ${choose('Font', fonts, value.fontFamily, (x) => put({ fontFamily: x }))}
          ${choose('Size', sizes, value.fontSize, (x) => put({ fontSize: x }))}
        </div>
        <div class="cd-field-row">
          ${field(
            'Weight',
            number(value.fontWeight, (x) => x >= 1 && x <= 1000 && put({ fontWeight: x }), {
              min: 1,
              max: 1000,
            }),
          )}
          ${field(
            'Line height',
            number(value.lineHeight, (x) => x > 0 && put({ lineHeight: x }), { min: 0 }),
          )}
        </div>
      </div>
    `;
  }

  protected renderArea(ctx: EditorContext) {
    const { tree, meta, session, set, setMeta } = ctx;
    const tokenFamilies = Object.values<TokenNode>(tree.font ?? {}).flatMap((t) =>
      t?.$value ? [[t.$value].flat()[0]] : [],
    );
    const families = [...new Set([...meta.fontFiles.map((f) => f.family), ...tokenFamilies])].map((f) => ({
      value: f,
      label: f,
    }));
    const styles = Object.entries<TokenNode>(tree.typography ?? {}).filter(
      ([k, t]) => !k.startsWith('$') && t.$value && typeof t.$value === 'object',
    );
    return html`
      ${own(tree.font).map((name) => {
        const current = [tree.font[name].$value].flat();
        const generic = GENERIC.includes(current.at(-1)) ? current.at(-1) : 'sans-serif';
        return choose(`${cap(name)} font`, families, current[0], (f) =>
          set(E.setToken(session.store.get(), `font.${name}`, { $value: [f, generic] })),
        );
      })}
      ${repeat(
        styles,
        ([name]) => name,
        ([name, t]) => this.textStyle(ctx, name, t.$value),
      )}
      <h4>Font files</h4>
      <ul class="cd-list-editor">
        ${repeat(
          meta.fontFiles,
          (f) => f.src,
          (f) => html`
            <li>
              <span>${f.family} ${f.weight} ${f.style}${f.subset ? ` (${f.subset})` : ''}</span>
              ${iconButton('trash', `Remove ${f.src}`, () => setMeta((m) => E.removeFontFile(m, f.src)))}
            </li>
          `,
        )}
      </ul>
      ${uploadButton('Upload font files', (files) => session.addFontUploads(files), '.woff2,.woff,.ttf,.otf')}
      <p class="cd-hint">woff2, woff, ttf or otf. Family, weight and style are read from the file name.</p>
      <h4>Add from Fontsource</h4>
      <cd-fontsource-picker
        @pick=${(e: CustomEvent<FontFile[]>) => setMeta((m) => E.addFontFiles(m, e.detail))}
      ></cd-fontsource-picker>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sg-edit-type': EditType;
  }
}
