// <sg-scale>: the spacing, radius or shadow scale, each step drawn with its token.
import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { cssName } from '../../lib/css.js';
import type { Dimension, Tokens } from '../../lib/types.js';
import { LightElement } from '../light-element.js';
import { dim, tokenLabel } from './parts.js';

export type ScaleKind = 'spacing' | 'radius' | 'shadow';

// 9999px and up is the convention for fully round
const radiusText = (v: Dimension) => (v.value * (v.unit === 'rem' ? 16 : 1) >= 9999 ? 'full' : dim(v));

@customElement('sg-scale')
export class Scale extends LightElement {
  @property({ attribute: false }) tokens: Tokens = new Map();
  @property() kind: ScaleKind = 'spacing';

  protected override render() {
    const steps = [...this.tokens].filter(([p]) => p.startsWith(`${this.kind}.`));
    const v = (p: string) => `var(${cssName(p)})`;
    if (this.kind === 'spacing') {
      return html`
        <div class="cd-box cd-token-list">
          ${steps.map(
            ([p, t]) => html`
              <div class="cd-token-row">
                <span>${tokenLabel(p, dim(t.resolved))}</span>
                <div class="cd-bar" style=${styleMap({ width: v(p) })}></div>
              </div>
            `,
          )}
        </div>
      `;
    }
    const radius = this.kind === 'radius';
    return html`
      <div class="cd-swatch-grid ${radius ? '' : 'cd-shadow-stage'}">
        ${steps.map(
          ([p, t]) => html`
            <figure>
              <div
                class=${radius ? 'cd-radius-box' : 'cd-shadow-box'}
                style=${styleMap(radius ? { 'border-radius': v(p) } : { 'box-shadow': v(p) })}
              ></div>
              <figcaption>${tokenLabel(p, radius ? radiusText(t.resolved) : undefined)}</figcaption>
            </figure>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sg-scale': Scale;
  }
}
