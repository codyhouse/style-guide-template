<script setup lang="ts">
import { watch } from 'vue';
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui';

export interface ConfirmChoice {
  value: string;
  label: string;
  primary?: boolean;
}

defineProps<{ title: string; message: string; items?: string[]; choices: ConfirmChoice[] }>();
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ choose: [value: string] }>();

let returnFocusTo: HTMLElement | null = null;

watch(open, (isOpen) => {
  if (isOpen && document.activeElement instanceof HTMLElement) returnFocusTo = document.activeElement;
});

function restoreFocus(event: Event) {
  event.preventDefault();
  returnFocusTo?.focus();
}
</script>

<template>
  <AlertDialogRoot v-model:open="open">
    <AlertDialogPortal>
      <AlertDialogOverlay class="cd-confirm-overlay" />
      <AlertDialogContent class="cd-confirm" @close-auto-focus="restoreFocus">
        <AlertDialogTitle as="h2">{{ title }}</AlertDialogTitle>
        <AlertDialogDescription>{{ message }}</AlertDialogDescription>
        <ul v-if="items?.length" class="cd-confirm-items">
          <li v-for="item in items" :key="item">
            <code>{{ item }}</code>
          </li>
        </ul>
        <div class="cd-field-row">
          <AlertDialogCancel class="btn btn-secondary btn-small">Cancel</AlertDialogCancel>
          <AlertDialogAction
            v-for="choice in choices"
            :key="choice.value"
            :class="['btn', 'btn-small', { 'btn-secondary': !choice.primary }]"
            @click="emit('choose', choice.value)"
          >
            {{ choice.label }}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
