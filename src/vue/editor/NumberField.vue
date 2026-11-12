<script setup lang="ts">
const props = withDefaults(
  defineProps<{ label: string; value?: number; min?: number; max?: number; step?: number | string }>(),
  { step: 'any' },
);
const emit = defineEmits<{ commit: [value: number] }>();
function change(e: Event) {
  const value = (e.target as HTMLInputElement).value;
  if (value !== '' && Number.isFinite(Number(value))) emit('commit', Number(value));
}
</script>

<template>
  <label class="cd-field"
    ><span>{{ label }}</span>
    <input type="number" :value="props.value ?? ''" :min="min" :max="max" :step="step" @change="change" />
  </label>
</template>
