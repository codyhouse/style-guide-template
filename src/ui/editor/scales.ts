// <sg-edit-scales>: spacing, radius and font-size: each scale's generator, and any step set by hand.
import { html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import * as E from '../../lib/edit.js';
import { applyScale, setStep } from '../../lib/scale.js';
import { EditorArea, type EditorContext } from './context.js';
import { field, number } from './fields.js';

const SCALES = [
  ['spacing', 'Spacing'],
  ['radius', 'Radius'],
  ['font-size', 'Font size'],
] as const;

@customElement('sg-edit-scales')
export class EditScales extends EditorArea {
  private scale({ tree, session, set }: EditorContext, key: string, label: string) {
    const group = tree[key];
    if (!group) return nothing;
    const { store, vendor } = session;
    const gen = group.$extensions?.[vendor]?.scale;
    const regenerate = (patch: Record<string, unknown>) => {
      const next = structuredClone(group);
      next.$extensions[vendor].scale = { ...gen, ...patch };
      set(E.setToken(store.get(), key, applyScale(next, vendor)));
    };
    const steps = Object.keys(group).filter((k) => !k.startsWith('$'));
    return html`
      <div>
        <h4>${label}</h4>
        ${
          gen
            ? html`<div class="cd-field-row">
                ${field(
                  `Base (${gen.base.unit})`,
                  number(gen.base.value, (x) => regenerate({ base: { ...gen.base, value: x } })),
                )}
                ${
                  gen.ratio !== undefined
                    ? field(
                        'Ratio',
                        number(gen.ratio, (x) => x > 0 && regenerate({ ratio: x })),
                      )
                    : nothing
                }
              </div>`
            : nothing
        }
        <div class="cd-field-row">
          ${steps.map((step) => {
            const t = group[step];
            const byHand = t.$extensions?.[vendor]?.overridden ? ' (set by hand)' : '';
            return field(
              `${step}${byHand}`,
              number(t.$value.value, (x) =>
                set(E.setToken(store.get(), key, setStep(group, step, { ...t.$value, value: x }, vendor))),
              ),
            );
          })}
        </div>
      </div>
    `;
  }

  protected renderArea(ctx: EditorContext) {
    return html`${SCALES.map(([key, label]) => this.scale(ctx, key, label))}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sg-edit-scales': EditScales;
  }
}
