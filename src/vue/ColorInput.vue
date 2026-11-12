<script lang="ts">
export const COLOR_ERROR =
  'Not a CSS color. Try #2e59aa, rgb(46 89 170), hsl(219 57% 42%), oklch(0.48 0.14 262) or a name like teal.';
</script>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { parseCssColor, toHex } from '../lib/color.js';
import type { DtcgColor } from '../lib/types.js';
const props = withDefaults(
  defineProps<{ label: string; placeholder?: string; picker?: boolean; error?: string }>(),
  { picker: true },
);
const emit = defineEmits<{ commit: [color: DtcgColor] }>();
const text = defineModel<string>({ default: '' });
const invalid = ref(false);
const errorId = `cd-color-error-${crypto.randomUUID()}`;
const error = computed(() => (invalid.value ? COLOR_ERROR : props.error));
const hex = computed({
  get: () => {
    const color = parseCssColor(text.value);
    return color ? toHex(color) : '#000000';
  },
  set: (value) => (text.value = value),
});
function commit() {
  const color = parseCssColor(text.value.trim());
  invalid.value = !color;
  if (color) emit('commit', color);
}
</script>

<template>
  <div class="cd-color-input">
    <input
      v-model.lazy="text"
      type="text"
      :placeholder="placeholder"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? errorId : undefined"
      @change="commit"
    />
    <input v-if="picker" v-model="hex" type="color" :aria-label="`Pick ${label}`" @change="commit" />
  </div>
  <span v-if="error" :id="errorId" class="cd-error">{{ error }}</span>
</template>
