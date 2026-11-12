// Listbox: a button that announces its value and opens a role="listbox" popup.
// Keyboard: arrows, Home/End, typeahead, Enter/Space to pick, Escape to close.
// An option may carry a swatch (any CSS color) shown as a chip next to its label.
// The open popup is placed by Floating UI: it flips above or shrinks when there is no room below.
import { h, icon } from './dom.js';
import { autoUpdate, computePosition, flip, offset, shift, size } from '../vendor/floating-ui.js';

const chip = (swatch) => (swatch ? h('span', { class: 'cd-chip', 'aria-hidden': 'true', style: { background: swatch } }) : null);

let uid = 0;

export function listbox(el, { label, options, value, onChange, typeahead = true }) {
  const id = `cd-lb-${++uid}`;
  let current = value;
  let active = Math.max(0, options.findIndex((o) => o.value === value));
  let typed = '';
  let typedAt = 0;

  const labelEl = h('span', { id: `${id}-label`, class: 'cd-sr-only' }, label);
  const valueEl = h('span', {});
  const trigger = h('button', {
    type: 'button', class: 'cd-listbox-trigger', 'aria-haspopup': 'listbox', 'aria-expanded': 'false',
    'aria-labelledby': `${id}-label ${id}-trigger`, id: `${id}-trigger`,
  }, valueEl, icon('chevron'));
  const popup = h('ul', { role: 'listbox', class: 'cd-listbox-popup', id: `${id}-list`, tabindex: '-1', 'aria-labelledby': `${id}-label`, hidden: true },
    options.map((o, i) => h('li', { role: 'option', id: `${id}-opt-${i}`, class: 'cd-listbox-option', 'aria-selected': String(o.value === value) }, chip(o.swatch), o.label)));
  const root = h('div', { class: 'cd-listbox' }, labelEl, trigger, popup);
  el.replaceChildren(root);

  const optionEls = () => [...popup.children];
  let stopPlacing = null;
  const place = () => computePosition(trigger, popup, {
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 }), size({
      padding: 8,
      apply: ({ availableHeight, rects }) => {
        popup.style.width = `${rects.reference.width}px`;
        popup.style.setProperty('--cd-popup-room', `${availableHeight}px`);
      },
    })],
  }).then(({ x, y }) => Object.assign(popup.style, { left: `${x}px`, top: `${y}px` }));
  const show = () => {
    const o = options.find((x) => x.value === current);
    valueEl.replaceChildren(chip(o?.swatch) ?? '', o?.label ?? 'Choose');
    optionEls().forEach((o, i) => {
      o.setAttribute('aria-selected', String(options[i].value === current));
      o.classList.toggle('is-active', i === active);
    });
    popup.setAttribute('aria-activedescendant', `${id}-opt-${active}`);
    optionEls()[active]?.scrollIntoView({ block: 'nearest' });
  };
  const open = () => {
    active = Math.max(0, options.findIndex((o) => o.value === current));
    popup.hidden = false;
    stopPlacing = autoUpdate(trigger, popup, place);
    trigger.setAttribute('aria-expanded', 'true');
    show();
    popup.focus();
  };
  const close = (focus = true) => {
    stopPlacing?.();
    stopPlacing = null;
    popup.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (focus) trigger.focus();
  };
  const pick = (i) => {
    current = options[i].value;
    close();
    show();
    onChange?.(current);
  };

  trigger.addEventListener('click', () => (popup.hidden ? open() : close()));
  trigger.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); open(); }
  });
  popup.addEventListener('click', (e) => {
    const li = e.target.closest('[role=option]');
    if (li) pick(optionEls().indexOf(li));
  });
  popup.addEventListener('keydown', (e) => {
    const last = options.length - 1;
    const keys = {
      ArrowDown: () => { active = Math.min(last, active + 1); },
      ArrowUp: () => { active = Math.max(0, active - 1); },
      Home: () => { active = 0; },
      End: () => { active = last; },
      Enter: () => pick(active),
      ' ': () => pick(active),
      Escape: () => close(),
      Tab: () => close(false),
    };
    if (keys[e.key]) {
      if (e.key !== 'Tab') e.preventDefault();
      keys[e.key]();
      if (!popup.hidden) show();
      return;
    }
    if (typeahead && e.key.length === 1) {
      const now = Date.now();
      typed = now - typedAt > 700 ? e.key.toLowerCase() : typed + e.key.toLowerCase();
      typedAt = now;
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(typed));
      if (i >= 0) { active = i; show(); }
    }
  });
  const outside = (e) => {
    if (!root.isConnected) {
      // re-rendered away
      document.removeEventListener('pointerdown', outside);
      stopPlacing?.();
    }
    else if (!popup.hidden && !root.contains(e.target)) close(false);
  };
  document.addEventListener('pointerdown', outside);
  show();

  return {
    set(v) { current = v; show(); },
    destroy() { root.remove(); },
  };
}
