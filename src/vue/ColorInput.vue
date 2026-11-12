<script lang="ts">
export const COLOR_ERROR =
  'Not a CSS color. Try #2e59aa, rgb(46 89 170), hsl(219 57% 42%), oklch(0.48 0.14 262) or a name like teal.';
</script>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { parseCssColor, toHex } from '../lib/color.js';
import type { DtcgColor } from '../lib/types.js';
const props = withDefaults(
  defineProps<{
    value?: string;
    label: string;
    name?: string;
    placeholder?: string;
    picker?: boolean;
    error?: string;
  }>(),
  { value: '', picker: true },
);
const emit = defineEmits<{ commit: [color: DtcgColor] }>();
const text = ref<HTMLInputElement>();
const pick = ref<HTMLInputElement>();
const invalid = ref(false);
const errorId = `cd-color-error-${crypto.randomUUID()}`;
const parsed = computed(() => (props.value ? parseCssColor(props.value) : null));
const error = computed(() => (invalid.value ? COLOR_ERROR : props.error));
function commit() {
  const color = parseCssColor(text.value?.value.trim() ?? '');
  invalid.value = !color;
  if (!color) return;
  if (pick.value) pick.value.value = toHex(color);
  emit('commit', color);
}
function inputColor(e: Event) {
  if (text.value) text.value.value = (e.target as HTMLInputElement).value;
}
</script>

<template>
  <div class="cd-color-input">
    <input
      ref="text"
      type="text"
      :name="name"
      :placeholder="placeholder"
      :value="value"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? errorId : undefined"
      @change="commit"
    />
    <input
      v-if="picker"
      ref="pick"
      type="color"
      :aria-label="`Pick ${label}`"
      :value="parsed ? toHex(parsed) : '#000000'"
      @input="inputColor"
      @change="commit"
    />
  </div>
  <span v-if="error" :id="errorId" class="cd-error">{{ error }}</span>
</template>
