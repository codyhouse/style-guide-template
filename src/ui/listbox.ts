// <cd-listbox>: a button that announces its value and opens a role="listbox" popup.
// Keyboard: arrows, Home/End, typeahead, Enter/Space to pick, Escape to close.
// The owner sets .value; picking fires "change" with the value as detail and changes nothing itself,
// so a pick the owner refuses shows nothing. The open popup is placed by Floating UI: it flips above
// or shrinks when there is no room below.
import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom';
import { html, nothing, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { icon } from './dom.js';
import { LightElement } from './light-element.js';

export interface ListboxOption {
  value: string;
  label: string;
  /** any CSS color, shown as a chip next to the label */
  swatch?: string;
}

const chip = (swatch?: string) =>
  swatch
    ? html`<span class="cd-chip" aria-hidden="true" style=${styleMap({ background: swatch })}></span>`
    : nothing;

let uid = 0;

@customElement('cd-listbox')
export class Listbox extends LightElement {
  @property() label = '';
  @property({ attribute: false }) options: ListboxOption[] = [];
  @property({ attribute: false }) value: string | null = null;

  @state() private open = false;
  @state() private active = 0;

  @query('.cd-listbox-trigger') private trigger?: HTMLButtonElement;
  @query('[role=listbox]') private popup?: HTMLElement;

  private readonly key = `cd-lb-${++uid}`;
  private typed = '';
  private typedAt = 0;
  private stopPlacing?: () => void;

  override connectedCallback() {
    super.connectedCallback();
    this.classList.add('cd-listbox');
    document.addEventListener('pointerdown', this.onOutside);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this.onOutside);
    this.stopPlacing?.();
  }

  private readonly onOutside = (e: PointerEvent) => {
    if (this.open && !this.contains(e.target as Node)) this.close(false);
  };

  private show() {
    this.active = Math.max(
      0,
      this.options.findIndex((o) => o.value === this.value),
    );
    this.open = true;
  }

  private close(focus = true) {
    this.open = false;
    if (focus) this.trigger?.focus();
  }

  private pick(i: number) {
    this.close();
    this.dispatchEvent(new CustomEvent('change', { detail: this.options[i].value }));
  }

  protected override updated(changed: PropertyValues<this>) {
    if (!changed.has('open' as keyof Listbox)) {
      if (this.open) this.popup?.children[this.active]?.scrollIntoView({ block: 'nearest' });
      return;
    }
    this.stopPlacing?.();
    this.stopPlacing = undefined;
    if (this.open && this.trigger && this.popup) {
      this.stopPlacing = autoUpdate(this.trigger, this.popup, () => this.place());
      this.popup.focus();
    }
  }

  private place() {
    const { trigger, popup } = this;
    if (!trigger || !popup) return;
    computePosition(trigger, popup, {
      strategy: 'fixed',
      placement: 'bottom-start',
      middleware: [
        offset(4),
        flip({ padding: 8 }),
        shift({ padding: 8 }),
        size({
          padding: 8,
          apply: ({ availableHeight, rects, elements }) => {
            elements.floating.style.width = `${rects.reference.width}px`;
            elements.floating.style.setProperty('--cd-popup-room', `${availableHeight}px`);
          },
        }),
      ],
    }).then(({ x, y }) => Object.assign(popup.style, { left: `${x}px`, top: `${y}px` }));
  }

  private onTriggerKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.show();
    }
  }

  private onPopupKey(e: KeyboardEvent) {
    const last = this.options.length - 1;
    const keys: Record<string, () => void> = {
      ArrowDown: () => (this.active = Math.min(last, this.active + 1)),
      ArrowUp: () => (this.active = Math.max(0, this.active - 1)),
      Home: () => (this.active = 0),
      End: () => (this.active = last),
      Enter: () => this.pick(this.active),
      ' ': () => this.pick(this.active),
      Escape: () => this.close(),
      Tab: () => this.close(false),
    };
    if (keys[e.key]) {
      if (e.key !== 'Tab') e.preventDefault();
      keys[e.key]();
    } else if (e.key.length === 1) {
      const now = Date.now();
      this.typed = now - this.typedAt > 700 ? e.key.toLowerCase() : this.typed + e.key.toLowerCase();
      this.typedAt = now;
      const i = this.options.findIndex((o) => o.label.toLowerCase().startsWith(this.typed));
      if (i >= 0) this.active = i;
    }
  }

  private onPopupClick(e: MouseEvent) {
    const option = (e.target as Element).closest<HTMLElement>('[role=option]');
    if (option) this.pick(Number(option.dataset.index));
  }

  protected override render() {
    const id = this.key;
    const current = this.options.find((o) => o.value === this.value);
    return html`
      <span id="${id}-label" class="cd-sr-only">${this.label}</span>
      <button
        type="button"
        class="cd-listbox-trigger"
        id="${id}-trigger"
        aria-haspopup="listbox"
        aria-expanded=${String(this.open)}
        aria-labelledby="${id}-label ${id}-trigger"
        @click=${() => (this.open ? this.close() : this.show())}
        @keydown=${this.onTriggerKey}
      >
        <span>${chip(current?.swatch)}${current?.label ?? 'Choose'}</span>${icon('chevron')}
      </button>
      <ul
        role="listbox"
        class="cd-listbox-popup"
        id="${id}-list"
        tabindex="-1"
        aria-labelledby="${id}-label"
        aria-activedescendant="${id}-opt-${this.active}"
        ?hidden=${!this.open}
        @click=${this.onPopupClick}
        @keydown=${this.onPopupKey}
      >
        ${this.options.map(
          (o, i) => html`
            <li
              role="option"
              id="${id}-opt-${i}"
              data-index=${i}
              class=${classMap({ 'cd-listbox-option': true, 'is-active': i === this.active })}
              aria-selected=${String(o.value === this.value)}
            >
              ${chip(o.swatch)}${o.label}
            </li>
          `,
        )}
      </ul>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cd-listbox': Listbox;
  }
}
