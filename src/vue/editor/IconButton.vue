<script setup lang="ts">
import Icon, { type IconName } from '../Icon.vue';

defineProps<{ name: IconName; label: string }>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button type="button" class="cd-action" :title="label" @click="$emit('click')">
    <Icon :name="name" /><span>{{ label }}</span>
  </button>
</template>
