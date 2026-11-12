<script setup lang="ts">
import Listbox, { type ListboxOption } from '../Listbox.vue';
defineProps<{ label: string; options: ListboxOption[]; value: string | null }>();
defineEmits<{ change: [value: string] }>();
</script>

<template>
  <div class="cd-field">
    <span aria-hidden="true">{{ label }}</span>
    <Listbox :label="label" :options="options" :value="value" @change="$emit('change', $event)" />
  </div>
</template>
