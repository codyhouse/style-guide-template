<script setup lang="ts">
import { computed } from 'vue';
import {
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectRoot,
  SelectTrigger,
  SelectViewport,
} from 'reka-ui';
import Icon from './Icon.vue';
export interface ListboxOption {
  value: string;
  label: string;
  swatch?: string;
}
const props = defineProps<{ label: string; options: ListboxOption[] }>();
const value = defineModel<string>('value', { required: true });
const selected = computed(() => props.options.find((o) => o.value === value.value));
</script>

<template>
  <div class="cd-listbox">
    <!-- '' keeps it controlled while showing the placeholder -->
    <SelectRoot :model-value="value ?? ''" @update:model-value="value = $event as string">
      <SelectTrigger class="cd-listbox-trigger" :aria-label="label">
        <span
          ><span
            v-if="selected?.swatch"
            class="cd-chip"
            aria-hidden="true"
            :style="{ background: selected.swatch }"
          ></span
          >{{ selected?.label ?? 'Choose' }}</span
        >
        <Icon name="chevron" />
      </SelectTrigger>
      <SelectContent position="popper" :side-offset="4" :collision-padding="8" class="cd-listbox-popup">
        <SelectViewport>
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            class="cd-listbox-option"
          >
            <span
              v-if="option.swatch"
              class="cd-chip"
              aria-hidden="true"
              :style="{ background: option.swatch }"
            ></span>
            <SelectItemText>{{ option.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectRoot>
  </div>
</template>
