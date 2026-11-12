<script setup lang="ts">
import { useFileDialog } from '@vueuse/core';
const props = defineProps<{ label: string; accept?: string }>();
const emit = defineEmits<{ files: [files: File[]] }>();
const { open, onChange } = useFileDialog({ accept: props.accept, reset: true });
onChange((files) => files && emit('files', [...files]));
</script>

<template>
  <div>
    <button type="button" class="btn btn-secondary btn-small" @click="open()">{{ label }}</button>
  </div>
</template>
