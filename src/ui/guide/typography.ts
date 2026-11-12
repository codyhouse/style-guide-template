// <sg-typography>: the font-size scale, the text styles, and a specimen of every font file.
import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { cssName } from '../../lib/css.js';
import { cssString } from '../../lib/fonts.js';
import type { BrandMeta, FontFile, Tokens } from '../../lib/types.js';
import { LightElement } from '../light-element.js';
import { dim, tokenLabel } from './parts.js';

@customElement('sg-typography')
export class Typography extends LightElement {
  @property({ attribute: false }) tokens: Tokens = new Map();
  @property({ attribute: false }) meta?: BrandMeta;

  private sizes() {
    const sizes = [...this.tokens].filter(([p, t]) => p.startsWith('font-size.') && t.type === 'dimension');
    return html`
      <div class="cd-box">
        <h3>Font sizes</h3>
        ${sizes.map(
          ([p, t]) => html`
            <p class="cd-type-sample" style=${styleMap({ 'font-size': `var(${cssName(p)})` })}>
              Aa <span class="cd-type-meta">${tokenLabel(p, dim(t.resolved))}</span>
            </p>
          `,
        )}
      </div>
    `;
  }

  private styles() {
    const styles = [...this.tokens].filter(([, t]) => t.type === 'typography');
    const prop = (path: string, field: string) => `var(${cssName(path)}-${field})`;
    return html`
      <div class="cd-box">
        <h3>Text styles</h3>
        ${styles.map(([p, t]) => {
          const r = t.resolved;
          const style = styleMap({
            'font-family': prop(p, 'font-family'),
            'font-size': prop(p, 'font-size'),
            'font-weight': prop(p, 'font-weight'),
            'letter-spacing': prop(p, 'letter-spacing'),
            'line-height': prop(p, 'line-height'),
          });
          return html`
            <p class="cd-type-sample" style=${style}>
              ${p.replace(/^typography\./, '')}
              <span class="cd-type-meta">
                ${[r.fontFamily].flat()[0]} ${r.fontWeight} ${dim(r.fontSize)} / ${r.lineHeight}
              </span>
            </p>
          `;
        })}
      </div>
    `;
  }

  private fonts() {
    const families = Map.groupBy(this.meta?.fontFiles ?? [], (f: FontFile) => f.family);
    return html`
      <div class="cd-box">
        <h3>Fonts</h3>
        ${
          families.size
            ? [...families].map(
                ([family, files]) => html`
                  <div class="cd-specimen">
                    <b>${family}</b>
                    ${files.map(
                      (f) => html`
                        <p
                          style=${styleMap({
                            'font-family': cssString(family),
                            'font-weight': String(f.weight),
                            'font-style': f.style,
                          })}
                        >
                          ${f.weight} ${f.style}: The quick brown fox jumps over the lazy dog
                          <span class="cd-type-meta">${f.src}</span>
                        </p>
                      `,
                    )}
                  </div>
                `,
              )
            : html`<p>No font files loaded yet.</p>`
        }
      </div>
    `;
  }

  protected override render() {
    return html`${this.sizes()} ${this.styles()} ${this.fonts()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sg-typography': Typography;
  }
}
