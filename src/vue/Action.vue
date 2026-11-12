<script setup lang="ts">
import Icon, { type IconName } from './Icon.vue';
defineProps<{
  id: string;
  icon: IconName;
  label: string;
  title: string;
  pressed?: boolean;
  busy?: boolean;
}>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button
    :id="id"
    type="button"
    class="cd-action"
    :title="title"
    :aria-pressed="pressed"
    :aria-busy="busy ? 'true' : undefined"
    :disabled="busy || undefined"
    @click="$emit('click')"
  >
    <Icon :name="icon" /><span>{{ label }}</span>
  </button>
</template>
