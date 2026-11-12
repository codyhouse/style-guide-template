// <sg-code>: the brand as CSS variables, Tailwind v4 or shadcn/ui, in tabs, with a copy button.
import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { generateCss } from '../../lib/css.js';
import { shadcnCss, tailwindCss } from '../../lib/exports.js';
import type { FontFile, ResolverDoc } from '../../lib/types.js';
import { icon } from '../dom.js';
import { LightElement } from '../light-element.js';
import { copyable } from './parts.js';

const fontSrc = (f: FontFile) => `../${f.src}`; // same layout as the brand kit's css/ folder

const FORMATS = [
  {
    key: 'css',
    label: 'CSS variables',
    code: (doc: ResolverDoc, vendor: string) => generateCss(doc, { vendor, fontSrc }),
  },
  {
    key: 'tailwind',
    label: 'Tailwind v4',
    code: (doc: ResolverDoc, vendor: string) => tailwindCss(doc, { vendor, fontSrc }),
  },
  { key: 'shadcn', label: 'shadcn/ui', code: (doc: ResolverDoc) => shadcnCss(doc) },
];

const tabId = (key: string) => `cd-code-${key}`;

@customElement('sg-code')
export class Code extends LightElement {
  @property({ attribute: false }) doc?: ResolverDoc;
  @property() vendor = '';
  @state() private format = FORMATS[0];

  private async select(i: number, focus: boolean) {
    this.format = FORMATS[(i + FORMATS.length) % FORMATS.length];
    await this.updateComplete;
    if (focus) this.querySelector<HTMLElement>(`#${tabId(this.format.key)}`)?.focus();
  }

  private onKey(e: KeyboardEvent) {
    const i = FORMATS.indexOf(this.format);
    const moves: Record<string, number> = {
      ArrowRight: i + 1,
      ArrowLeft: i - 1,
      Home: 0,
      End: FORMATS.length - 1,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    this.select(moves[e.key], true);
  }

  protected override render() {
    if (!this.doc) return html``;
    const { key, label } = this.format;
    const code = this.format.code(this.doc, this.vendor);
    return html`
      <div class="cd-code-bar">
        <div role="tablist" class="cd-tabs" aria-label="Code format" @keydown=${this.onKey}>
          ${FORMATS.map(
            (f, i) => html`
              <button
                type="button"
                role="tab"
                id=${tabId(f.key)}
                aria-controls="cd-code-panel"
                aria-selected=${String(f === this.format)}
                tabindex=${f === this.format ? '0' : '-1'}
                @click=${() => this.select(i, false)}
              >
                ${f.label}
              </button>
            `,
          )}
        </div>
        <div>
          ${copyable(code, html`<span>${icon('copy')}Copy</span>`, {
            cls: 'btn btn-secondary btn-small cd-copy',
            label: `Copy ${label}`,
            title: `Copy ${label}`,
          })}
        </div>
      </div>
      <div role="tabpanel" class="cd-code" id="cd-code-panel" aria-labelledby=${tabId(key)}>
        <pre tabindex="0" aria-label=${label}><code>${code}</code></pre>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sg-code': Code;
  }
}
