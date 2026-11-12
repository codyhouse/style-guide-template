// <sg-edit-shadow>: offset, blur and opacity of each single-layer shadow.
import { html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import * as E from '../../lib/edit.js';
import type { TokenNode } from '../../lib/types.js';
import { EditorArea, type EditorContext } from './context.js';
import { field, number } from './fields.js';

const px = (value: number) => ({ value, unit: 'px' });

@customElement('sg-edit-shadow')
export class EditShadow extends EditorArea {
  protected renderArea({ tree, session, set, fresh }: EditorContext) {
    // layered shadows (an array of layers) are shown in the guide but not edited here
    const shadows = Object.entries<TokenNode>(tree.shadow ?? {}).filter(
      ([k, t]) => !k.startsWith('$') && !Array.isArray(t.$value) && typeof t.$value === 'object',
    );
    return html`${shadows.map(([name, t]) => {
      const v = t.$value;
      const path = `shadow.${name}`;
      const put = (patch: Record<string, unknown>) => {
        const cur = fresh(path);
        set(E.setToken(session.store.get(), path, { ...cur, $value: { ...cur.$value, ...patch } }));
      };
      const opacity = (x: number) => x >= 0 && x <= 1 && put({ color: { ...v.color, alpha: x } });
      return html`
        <div>
          <h4>${name}</h4>
          <div class="cd-field-row">
            ${field(
              'Offset Y (px)',
              number(v.offsetY.value, (x) => put({ offsetY: px(x) })),
            )}
            ${field(
              'Blur (px)',
              number(v.blur.value, (x) => x >= 0 && put({ blur: px(x) })),
            )}
            ${
              typeof v.color === 'object'
                ? field('Opacity', number(v.color.alpha ?? 1, opacity, { min: 0, max: 1, step: 0.05 }))
                : nothing
            }
          </div>
        </div>
      `;
    })}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sg-edit-shadow': EditShadow;
  }
}
