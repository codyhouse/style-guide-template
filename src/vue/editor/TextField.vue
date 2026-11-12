<script setup lang="ts">
defineProps<{ label: string; value?: string; placeholder?: string; hint?: string }>();
const emit = defineEmits<{ commit: [value: string] }>();
function change(e: Event) {
  emit('commit', (e.target as HTMLInputElement).value.trim());
}
</script>

<template>
  <label class="cd-field"
    ><span>{{ label }}</span>
    <input type="text" :value="value ?? ''" :placeholder="placeholder" @change="change" />
    <span v-if="hint" class="cd-hint">{{ hint }}</span>
  </label>
</template>
