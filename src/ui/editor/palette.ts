// <sg-edit-palette>: each hue's base color (the other shades are generated from it), per-shade values with
// CMYK and Pantone, and new hues.
import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { parseCssColor, toHex, toOklchString } from '../../lib/color.js';
import { ROLES } from '../../lib/contrast.js';
import * as E from '../../lib/edit.js';
import { COLOR_ERROR } from './color-input.js';
import './color-input.js';
import { EditorArea, type EditorContext } from './context.js';
import { cap, field, iconButton, text } from './fields.js';

const SHADE = /^\d+$/;

/** The hues of a token tree: color groups with numbered shades, other than the roles. */
export const huesOf = (tree: EditorContext['tree']) =>
  Object.keys(tree.color ?? {}).filter(
    (k) => !k.startsWith('$') && !ROLES.includes(k) && Object.keys(tree.color[k]).some((s) => SHADE.test(s)),
  );

export const shadesOf = (tree: EditorContext['tree'], hue: string) =>
  Object.keys(tree.color[hue]).filter((s) => SHADE.test(s));

@customElement('sg-edit-palette')
export class EditPalette extends EditorArea {
  @state() private nameError?: string;
  @state() private colorError?: string;

  private shade(ctx: EditorContext, hue: string, s: string) {
    const { tree, set, fresh } = ctx;
    const { store, vendor } = ctx.session;
    const t = tree.color[hue][s];
    const ext = t.$extensions?.[vendor] ?? {};
    const path = `color.${hue}.${s}`;
    const setExt = (patch: Record<string, unknown>) => {
      const cur = fresh(path);
      const own = { ...cur.$extensions?.[vendor], ...patch };
      set(E.setToken(store.get(), path, { ...cur, $extensions: { ...cur.$extensions, [vendor]: own } }));
    };
    const setCmyk = (v: string) => {
      const parts = v
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);
      setExt({ cmyk: parts.length === 4 && parts.every((n) => n >= 0 && n <= 100) ? parts : undefined });
    };
    return html`
      <div class="cd-field-row">
        ${field(
          `${hue}-${s}`,
          html`<cd-color-input
            label="${hue}-${s}"
            .value=${toOklchString(t.$value)}
            .picker=${false}
            @commit=${(e: CustomEvent) => set(E.setToken(store.get(), path, { ...fresh(path), $value: e.detail }))}
          ></cd-color-input>`,
        )}
        ${field('CMYK', text(ext.cmyk?.join(' '), setCmyk, { placeholder: 'C M Y K' }))}
        ${field(
          'Pantone',
          text(ext.pantone, (v) => setExt({ pantone: v || undefined })),
        )}
      </div>
    `;
  }

  private hue(ctx: EditorContext, hue: string) {
    const { tree, session, set } = ctx;
    const { store, vendor } = session;
    const shades = shadesOf(tree, hue);
    const group = tree.color[hue];
    const base =
      group.$extensions?.[vendor]?.base ?? ('600' in group ? '600' : shades[Math.floor(shades.length / 2)]);
    const name = (s: string) => `${hue}-${s}${s === base ? ' (your color)' : ''}`;
    return html`
      <div class="cd-hue">
        <div class="cd-field-row">
          ${field(
            `${cap(hue)} base color`,
            html`<cd-color-input
              label="${hue} base color"
              .value=${toHex(group[base].$value)}
              @commit=${(e: CustomEvent) => set(E.setHue(store.get(), hue, e.detail, vendor))}
            ></cd-color-input>`,
          )}
          ${iconButton('trash', `Remove ${hue}`, () => set(E.removeHue(store.get(), hue)))}
        </div>
        <p class="cd-hint">
          Your color is kept as ${hue}-${base}. The other ${shades.length - 1} shades are generated from it.
        </p>
        <ol class="cd-mini-scale" aria-label="${hue} shades">
          ${shades.map(
            (s) => html`
              <li
                class=${s === base ? 'is-base' : nothing}
                title=${name(s)}
                style=${styleMap({ background: `var(--color-${hue}-${s})` })}
              >
                <span class="cd-sr-only">${name(s)}</span>
              </li>
            `,
          )}
        </ol>
        <details>
          <summary>${cap(hue)} shades, CMYK and Pantone</summary>
          ${repeat(
            shades,
            (s) => s,
            (s) => this.shade(ctx, hue, s),
          )}
        </details>
      </div>
    `;
  }

  private addHue(e: SubmitEvent, ctx: EditorContext, hues: string[]) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const id = String(data.get('name') ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '');
    const color = parseCssColor(String(data.get('color') ?? '').trim());
    this.nameError = !id
      ? 'Give the hue a name.'
      : ROLES.includes(id) || hues.includes(id)
        ? `${id} is already taken.`
        : undefined;
    this.colorError = color ? undefined : COLOR_ERROR;
    if (this.nameError || !color) return;
    ctx.set(E.setHue(ctx.session.store.get(), id, color, ctx.session.vendor));
    form.reset();
  }

  protected renderArea(ctx: EditorContext) {
    const hues = huesOf(ctx.tree);
    const { nameError } = this;
    return html`
      ${repeat(
        hues,
        (h) => h,
        (h) => this.hue(ctx, h),
      )}
      <form class="cd-field-row" @submit=${(e: SubmitEvent) => this.addHue(e, ctx, hues)}>
        <label class="cd-field">
          <span>New hue name</span>
          <input
            type="text"
            name="name"
            placeholder="accent"
            aria-invalid=${nameError ? 'true' : nothing}
            aria-describedby=${nameError ? 'new-hue-name-error' : nothing}
          />
          ${nameError ? html`<span class="cd-error" id="new-hue-name-error">${nameError}</span>` : nothing}
        </label>
        ${field(
          'Color',
          html`<cd-color-input
            name="color"
            label="the new hue color"
            placeholder="any CSS color"
            .error=${this.colorError}
          ></cd-color-input>`,
        )}
        <button type="submit" class="btn btn-small">Add hue</button>
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sg-edit-palette': EditPalette;
  }
}
