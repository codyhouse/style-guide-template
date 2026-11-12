<script setup lang="ts">
import { ref } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
const props = withDefaults(
  defineProps<{ text: string; label?: string; title?: string; tabindex?: number }>(),
  { tabindex: 0 },
);
const status = ref('');
const { start: clearLater } = useTimeoutFn(() => (status.value = ''), 1500, { immediate: false });
async function copy() {
  try {
    await navigator.clipboard.writeText(props.text);
    status.value = 'Copied';
  } catch {
    status.value = 'Copy failed';
  }
  clearLater();
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
