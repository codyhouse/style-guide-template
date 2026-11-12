<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ label: string; value?: string; placeholder?: string; hint?: string }>();
const emit = defineEmits<{ commit: [value: string] }>();
const text = computed({ get: () => props.value ?? '', set: (value) => emit('commit', value) });
</script>

<template>
  <label class="cd-field"
    ><span>{{ label }}</span>
    <input v-model.lazy.trim="text" type="text" :placeholder="placeholder" />
    <span v-if="hint" class="cd-hint">{{ hint }}</span>
  </label>
</template>
