// <cd-color-input>: any CSS color as text, optionally with the system color picker.
// A color that parses fires "commit" with it; one that does not keeps the typed text and shows why.
// The text input carries `name`, so the field also works inside a <form>.
import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { parseCssColor, toHex } from '../../lib/color.js';
import type { DtcgColor } from '../../lib/types.js';
import { LightElement } from '../light-element.js';

export const COLOR_ERROR =
  'Not a CSS color. Try #2e59aa, rgb(46 89 170), hsl(219 57% 42%), oklch(0.48 0.14 262) or a name like teal.';

let uid = 0;

@customElement('cd-color-input')
export class ColorInput extends LightElement {
  @property() value = '';
  /** names the picker for screen readers: "Pick <label>" */
  @property() label = '';
  @property() name?: string;
  @property() placeholder?: string;
  @property({ type: Boolean }) picker = true;
  /** an error from the owner, such as a missing value in a form */
  @property() error?: string;
  @state() private invalid = false;

  private readonly errorId = `cd-color-error-${++uid}`;

  private get text() {
    return this.querySelector<HTMLInputElement>('input[type=text]');
  }

  private commit() {
    const color = parseCssColor(this.text?.value.trim() ?? '');
    this.invalid = !color;
    if (!color) return;
    const pick = this.querySelector<HTMLInputElement>('input[type=color]');
    if (pick) pick.value = toHex(color);
    this.dispatchEvent(new CustomEvent<DtcgColor>('commit', { detail: color }));
  }

  protected override render() {
    const parsed = this.value ? parseCssColor(this.value) : null;
    const error = this.invalid ? COLOR_ERROR : this.error;
    return html`
      <div class="cd-color-input">
        <input
          type="text"
          name=${this.name ?? nothing}
          placeholder=${this.placeholder ?? nothing}
          .value=${this.value}
          aria-invalid=${error ? 'true' : nothing}
          aria-describedby=${error ? this.errorId : nothing}
          @change=${() => this.commit()}
        />
        ${
          this.picker
            ? html`
                <input
                  type="color"
                  aria-label="Pick ${this.label}"
                  .value=${parsed ? toHex(parsed) : '#000000'}
                  @input=${(e: Event) => {
                    if (this.text) this.text.value = (e.target as HTMLInputElement).value;
                  }}
                  @change=${() => this.commit()}
                />
              `
            : nothing
        }
      </div>
      ${error ? html`<span class="cd-error" id=${this.errorId}>${error}</span>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cd-color-input': ColorInput;
  }
}
