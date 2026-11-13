<script setup lang="ts">
import { computed } from 'vue';
import { PopoverContent, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { toHex } from '../../lib/color.js';
import { cssName } from '../../lib/css.js';
import { paletteId, renameShade, setBase, setShade, type Shade } from '../../lib/palette.js';
import { vendorData, withVendorData } from '../../lib/tree.js';
import ColorInput from '../ColorInput.vue';
import type { EditorContext } from './context.js';
import TextField from './TextField.vue';

const props = defineProps<{ ctx: EditorContext; colorId: string; shade: Shade }>();
const emit = defineEmits<{ remove: [] }>();

const path = computed(() => `color.${props.colorId}.${props.shade.name}`);
const label = computed(() => `${props.colorId}-${props.shade.name}`);
const own = computed(() => vendorData(props.ctx.fresh(path.value), props.ctx.vendor));
const cmyk = computed(() => (Array.isArray(own.value.cmyk) ? own.value.cmyk.join(' ') : ''));
const pantone = computed(() => (typeof own.value.pantone === 'string' ? own.value.pantone : ''));
const status = computed(() => {
  if (props.shade.isBase) return 'Base shade';
  return props.shade.byHand ? 'Set by hand' : 'Generated';
});

function rename(name: string) {
  const to = paletteId(name);
  if (to && to !== props.shade.name)
    props.ctx.edit((doc) => renameShade(doc, props.colorId, props.shade.name, to, props.ctx.vendor));
}

function setExtension(patch: Record<string, unknown>) {
  props.ctx.setToken(path.value, withVendorData(props.ctx.fresh(path.value), props.ctx.vendor, patch));
}

function setCmyk(value: string) {
  const parts = value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  const valid = parts.length === 4 && parts.every((n) => n >= 0 && n <= 100);
  setExtension({ cmyk: valid ? parts : undefined });
}
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger
      class="cd-swatch-button"
      :class="{ 'is-base': shade.isBase, 'is-hand': shade.byHand }"
      :style="{ background: `var(${cssName(path)})` }"
      :aria-label="`Edit ${label}, ${status.toLowerCase()}`"
      :title="label"
    />
    <PopoverContent class="cd-popover" side="bottom" :side-offset="6" :collision-padding="8">
      <h4>{{ label }}</h4>
      <p class="cd-hint">{{ status }}</p>
      <ColorInput
        label="Color"
        :model-value="shade.color ? toHex(shade.color) : ''"
        @commit="ctx.edit((doc) => setShade(doc, colorId, shade.name, $event, ctx.vendor))"
      />
      <TextField label="Name" :value="shade.name" @commit="rename" />
      <div class="cd-field-row">
        <TextField label="CMYK" :value="cmyk" placeholder="C M Y K" @commit="setCmyk" />
        <TextField
          label="Pantone"
          :value="pantone"
          @commit="setExtension({ pantone: $event || undefined })"
        />
      </div>
      <div v-if="!shade.isBase" class="cd-field-row">
        <button
          type="button"
          class="btn btn-secondary btn-small"
          @click="ctx.edit((doc) => setBase(doc, colorId, shade.name, ctx.vendor))"
        >
          Make base
        </button>
        <button type="button" class="btn btn-secondary btn-small" @click="emit('remove')">
          Remove shade
        </button>
      </div>
    </PopoverContent>
  </PopoverRoot>
</template>
