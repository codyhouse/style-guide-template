<script setup lang="ts">
import { ref } from 'vue';
defineProps<{ label: string; accept?: string }>();
const emit = defineEmits<{ files: [files: File[]] }>();
const input = ref<HTMLInputElement>();
function change(e: Event) {
  const target = e.target as HTMLInputElement;
  emit('files', [...(target.files ?? [])]);
  target.value = '';
}
</script>

<template>
  <div>
    <input ref="input" type="file" multiple hidden :accept="accept" @change="change" />
    <button type="button" class="btn btn-secondary btn-small" @click="input?.click()">{{ label }}</button>
  </div>
</template>
