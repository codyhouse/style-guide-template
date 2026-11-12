<script setup lang="ts">
import { ref } from 'vue';
const props = withDefaults(
  defineProps<{ text: string; label?: string; title?: string; tabindex?: number }>(),
  { tabindex: 0 },
);
const status = ref('');
async function copy() {
  try {
    await navigator.clipboard.writeText(props.text);
    status.value = 'Copied';
  } catch {
    status.value = 'Copy failed';
  }
  setTimeout(() => (status.value = ''), 1500);
}
</script>

<template>
  <button
    type="button"
    :title="title ?? `Copy ${text}`"
    :aria-label="label"
    :tabindex="tabindex"
    @click="copy"
  >
    <slot /><span class="cd-copy-status" aria-live="polite">{{ status }}</span>
  </button>
</template>
