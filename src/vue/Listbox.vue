<script setup lang="ts">
import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom';
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import Icon from './Icon.vue';
export interface ListboxOption {
  value: string;
  label: string;
  swatch?: string;
}
const props = defineProps<{ label: string; options: ListboxOption[]; value: string | null }>();
const emit = defineEmits<{ change: [value: string] }>();
const open = ref(false),
  active = ref(0),
  trigger = ref<HTMLButtonElement>(),
  popup = ref<HTMLElement>(),
  root = ref<HTMLElement>();
const key = `cd-lb-${crypto.randomUUID()}`;
let typed = '',
  typedAt = 0;
let stopPlacing: (() => void) | undefined;
function show() {
  active.value = Math.max(
    0,
    props.options.findIndex((o) => o.value === props.value),
  );
  open.value = true;
}
function close(focus = true) {
  open.value = false;
  if (focus) trigger.value?.focus();
}
function pick(i: number) {
  const value = props.options[i]?.value;
  if (value === undefined) return;
  close();
  emit('change', value);
}
function outside(e: PointerEvent) {
  if (open.value && !root.value?.contains(e.target as Node)) close(false);
}
async function place() {
  if (!trigger.value || !popup.value) return;
  const { x, y } = await computePosition(trigger.value, popup.value, {
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
  });
  Object.assign(popup.value.style, { left: `${x}px`, top: `${y}px` });
}
watch(open, async (isOpen) => {
  stopPlacing?.();
  stopPlacing = undefined;
  if (!isOpen) return;
  await nextTick();
  if (trigger.value && popup.value) {
    stopPlacing = autoUpdate(trigger.value, popup.value, () => void place());
    popup.value.focus();
  }
});
watch(active, () =>
  nextTick(() => popup.value?.children[active.value]?.scrollIntoView({ block: 'nearest' })),
);
onMounted(() => document.addEventListener('pointerdown', outside));
onUnmounted(() => {
  document.removeEventListener('pointerdown', outside);
  stopPlacing?.();
});
function onTriggerKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    show();
  }
}
function onPopupKey(e: KeyboardEvent) {
  const last = props.options.length - 1;
  const keys: Record<string, () => void> = {
    ArrowDown: () => (active.value = Math.min(last, active.value + 1)),
    ArrowUp: () => (active.value = Math.max(0, active.value - 1)),
    Home: () => (active.value = 0),
    End: () => (active.value = last),
    Enter: () => pick(active.value),
    ' ': () => pick(active.value),
    Escape: () => close(),
    Tab: () => close(false),
  };
  if (keys[e.key]) {
    if (e.key !== 'Tab') e.preventDefault();
    keys[e.key]();
  } else if (e.key.length === 1) {
    const now = Date.now();
    typed = now - typedAt > 700 ? e.key.toLowerCase() : typed + e.key.toLowerCase();
    typedAt = now;
    const i = props.options.findIndex((o) => o.label.toLowerCase().startsWith(typed));
    if (i >= 0) active.value = i;
  }
}
</script>

<template>
  <div ref="root" class="cd-listbox">
    <span :id="`${key}-label`" class="cd-sr-only">{{ label }}</span>
    <button
      :id="`${key}-trigger`"
      ref="trigger"
      type="button"
      class="cd-listbox-trigger"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-labelledby="`${key}-label ${key}-trigger`"
      @click="open ? close() : show()"
      @keydown="onTriggerKey"
    >
      <span
        ><span
          v-if="options.find((o) => o.value === value)?.swatch"
          class="cd-chip"
          aria-hidden="true"
          :style="{ background: options.find((o) => o.value === value)?.swatch }"
        ></span
        >{{ options.find((o) => o.value === value)?.label ?? 'Choose' }}</span
      >
      <Icon name="chevron" />
    </button>
    <ul
      :id="`${key}-list`"
      ref="popup"
      role="listbox"
      class="cd-listbox-popup"
      tabindex="-1"
      :aria-labelledby="`${key}-label`"
      :aria-activedescendant="`${key}-opt-${active}`"
      :hidden="!open"
      @keydown="onPopupKey"
    >
      <li
        v-for="(option, i) in options"
        :id="`${key}-opt-${i}`"
        :key="option.value"
        role="option"
        class="cd-listbox-option"
        :class="{ 'is-active': i === active }"
        :aria-selected="option.value === value"
        @click="pick(i)"
      >
        <span
          v-if="option.swatch"
          class="cd-chip"
          aria-hidden="true"
          :style="{ background: option.swatch }"
        ></span
        >{{ option.label }}
      </li>
    </ul>
  </div>
</template>
