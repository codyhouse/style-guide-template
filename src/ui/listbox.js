// <cd-listbox>: a button that announces its value and opens a role="listbox" popup.
// Keyboard: arrows, Home/End, typeahead, Enter/Space to pick, Escape to close.
// Set .label, .options ({ value, label, swatch? }) and .value; picking fires "change" with the value as
// detail. The element does not change its own value: the owner sets it, so a refused pick shows nothing.
// The open popup is placed by Floating UI: it flips above or shrinks when there is no room below.
import { html, nothing, render } from 'lit-html';
import { styleMap } from 'lit-html/directives/style-map.js';
import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom';
import { icon } from './dom.js';

const chip = (swatch) => (swatch ? html`<span class="cd-chip" aria-hidden="true" style=${styleMap({ background: swatch })}></span>` : nothing);

let uid = 0;

class Listbox extends HTMLElement {
  #id = `cd-lb-${++uid}`;
  #label = '';
  #options = [];
  #value = null;
  #open = false;
  #active = 0;
  #typed = '';
  #typedAt = 0;
  #stopPlacing = null;
  #queued = false;

  set label(v) { this.#label = v; this.#schedule(); }
  set options(v) { this.#options = v; this.#schedule(); }
  set value(v) { this.#value = v; this.#schedule(); }
  get value() { return this.#value; }

  connectedCallback() {
    this.classList.add('cd-listbox');
    document.addEventListener('pointerdown', this.#outside);
    this.#render();
  }

  disconnectedCallback() {
    document.removeEventListener('pointerdown', this.#outside);
    this.#stopPlacing?.();
  }

  #outside = (e) => { if (this.#open && !this.contains(e.target)) this.#close(false); };

  #schedule() {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => { this.#queued = false; this.#render(); });
  }

  get #popup() { return this.querySelector('[role=listbox]'); }
  get #trigger() { return this.querySelector('.cd-listbox-trigger'); }

  #place = () => computePosition(this.#trigger, this.#popup, {
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 }), size({
      padding: 8,
      apply: ({ availableHeight, rects, elements }) => {
        elements.floating.style.width = `${rects.reference.width}px`;
        elements.floating.style.setProperty('--cd-popup-room', `${availableHeight}px`);
      },
    })],
  }).then(({ x, y }) => Object.assign(this.#popup.style, { left: `${x}px`, top: `${y}px` }));

  #show() {
    this.#active = Math.max(0, this.#options.findIndex((o) => o.value === this.#value));
    this.#open = true;
    this.#render();
    this.#stopPlacing = autoUpdate(this.#trigger, this.#popup, this.#place);
    this.#popup.focus();
  }

  #close(focus = true) {
    this.#stopPlacing?.();
    this.#stopPlacing = null;
    this.#open = false;
    this.#render();
    if (focus) this.#trigger.focus();
  }

  #pick(i) {
    this.#close();
    this.dispatchEvent(new CustomEvent('change', { detail: this.#options[i].value }));
  }

  #onTriggerKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.#show();
    }
  };

  #onPopupKey = (e) => {
    const last = this.#options.length - 1;
    const keys = {
      ArrowDown: () => { this.#active = Math.min(last, this.#active + 1); },
      ArrowUp: () => { this.#active = Math.max(0, this.#active - 1); },
      Home: () => { this.#active = 0; },
      End: () => { this.#active = last; },
      Enter: () => this.#pick(this.#active),
      ' ': () => this.#pick(this.#active),
      Escape: () => this.#close(),
      Tab: () => this.#close(false),
    };
    if (keys[e.key]) {
      if (e.key !== 'Tab') e.preventDefault();
      keys[e.key]();
    } else if (e.key.length === 1) {
      const now = Date.now();
      this.#typed = now - this.#typedAt > 700 ? e.key.toLowerCase() : this.#typed + e.key.toLowerCase();
      this.#typedAt = now;
      const i = this.#options.findIndex((o) => o.label.toLowerCase().startsWith(this.#typed));
      if (i >= 0) this.#active = i;
    }
    if (this.#open) this.#render();
  };

  #onPopupClick = (e) => {
    const li = e.target.closest('[role=option]');
    if (li) this.#pick(Number(li.dataset.index));
  };

  #render() {
    if (!this.isConnected) return;
    const id = this.#id;
    const current = this.#options.find((o) => o.value === this.#value);
    render(html`
      <span id="${id}-label" class="cd-sr-only">${this.#label}</span>
      <button type="button" class="cd-listbox-trigger" id="${id}-trigger" aria-haspopup="listbox"
        aria-expanded=${String(this.#open)} aria-labelledby="${id}-label ${id}-trigger"
        @click=${() => (this.#open ? this.#close() : this.#show())} @keydown=${this.#onTriggerKey}>
        <span>${chip(current?.swatch)}${current?.label ?? 'Choose'}</span>${icon('chevron')}
      </button>
      <ul role="listbox" class="cd-listbox-popup" id="${id}-list" tabindex="-1" aria-labelledby="${id}-label"
        aria-activedescendant="${id}-opt-${this.#active}" ?hidden=${!this.#open}
        @click=${this.#onPopupClick} @keydown=${this.#onPopupKey}>
        ${this.#options.map((o, i) => html`
          <li role="option" id="${id}-opt-${i}" data-index=${i} class="cd-listbox-option ${i === this.#active ? 'is-active' : ''}"
            aria-selected=${String(o.value === this.#value)}>${chip(o.swatch)}${o.label}</li>`)}
      </ul>`, this);
    if (this.#open) this.#popup.children[this.#active]?.scrollIntoView({ block: 'nearest' });
  }
}

if (!customElements.get('cd-listbox')) customElements.define('cd-listbox', Listbox);
