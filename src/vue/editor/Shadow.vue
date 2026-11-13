<script setup lang="ts">
import { computed } from 'vue';
import { child, children, isNode } from '../../lib/tree.js';
import { VALUES } from '../../lib/schema.js';
import { valueAs } from '../../lib/values.js';
import type { EditorContext } from './context.js';
import NumberField from './NumberField.vue';

const props = defineProps<{ ctx: EditorContext }>();

const shadows = computed(() =>
  children(child(props.ctx.tree, 'shadow')).flatMap(([name, token]) => {
    const layer = token.$value;
    if (!isNode(layer)) return [];
    return [
      {
        name,
        offsetY: valueAs(VALUES.dimension, layer.offsetY),
        blur: valueAs(VALUES.dimension, layer.blur),
        color: valueAs(VALUES.color, layer.color),
      },
    ];
  }),
);

const px = (value: number) => ({ value, unit: 'px' });

function put(name: string, patch: Record<string, unknown>) {
  props.ctx.patchValue(`shadow.${name}`, patch);
}
</script>

<template>
  <div v-for="{ name, offsetY, blur, color } in shadows" :key="name">
    <h4>{{ name }}</h4>
    <div class="cd-field-row">
      <NumberField
        v-if="offsetY"
        label="Offset Y (px)"
        :value="offsetY.value"
        @commit="put(name, { offsetY: px($event) })"
      />
      <NumberField
        v-if="blur"
        label="Blur (px)"
        :value="blur.value"
        @commit="(value) => value >= 0 && put(name, { blur: px(value) })"
      />
      <NumberField
        v-if="color"
        label="Opacity"
        :value="color.alpha ?? 1"
        :min="0"
        :max="1"
        :step="0.05"
        @commit="(value) => value >= 0 && value <= 1 && put(name, { color: { ...color, alpha: value } })"
      />
    </div>
  </div>
</template>
