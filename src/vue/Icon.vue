<script setup lang="ts">
defineOptions({ name: 'BrandIcon' });
import {
  Moon,
  Pencil,
  Upload,
  Save,
  Download,
  Undo2,
  Redo2,
  X,
  Check,
  TriangleAlert,
  ChevronDown,
  Copy,
  Trash2,
  ChevronUp,
} from '@lucide/vue';

const icons = {
  moon: Moon,
  edit: Pencil,
  load: Upload,
  save: Save,
  export: Download,
  undo: Undo2,
  redo: Redo2,
  close: X,
  check: Check,
  alert: TriangleAlert,
  chevron: ChevronDown,
  copy: Copy,
  trash: Trash2,
  up: ChevronUp,
  down: ChevronDown,
};

export type IconName = keyof typeof icons;
defineProps<{ name: IconName }>();
</script>

<template>
  <component :is="icons[name]" class="cd-icon" aria-hidden="true" />
</template>
