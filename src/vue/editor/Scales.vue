<script setup lang="ts">
import { computed } from 'vue';
import { applyScale, scaleOf, setStep, type ScaleSpec } from '../../lib/scale.js';
import { child, children, isHandSet, withVendorData } from '../../lib/tree.js';
import { VALUES } from '../../lib/schema.js';
import { valueAs } from '../../lib/values.js';
import type { EditorContext } from './context.js';
import NumberField from './NumberField.vue';

const props = defineProps<{ ctx: EditorContext }>();

const SCALES = [
  ['spacing', 'Spacing'],
  ['radius', 'Radius'],
  ['font-size', 'Font size'],
] as const;

const scales = computed(() =>
  SCALES.flatMap(([key, label]) => {
    const group = child(props.ctx.tree, key);
    if (!group) return [];
    const steps = children(group).map(([step, token]) => ({
      step,
      length: valueAs(VALUES.dimension, token.$value),
      byHand: isHandSet(token, props.ctx.vendor),
    }));
    return [{ key, label, spec: scaleOf(group, props.ctx.vendor), steps }];
  }),
);

function regenerate(key: string, patch: Partial<ScaleSpec>) {
  const group = child(props.ctx.tree, key);
  const spec = scaleOf(group, props.ctx.vendor);
  if (!group || !spec) return;
  const next = withVendorData(group, props.ctx.vendor, { scale: { ...spec, ...patch } });
  props.ctx.setToken(key, applyScale(next, props.ctx.vendor));
}

function setValue(key: string, step: string, value: number) {
  const group = child(props.ctx.tree, key);
  const length = valueAs(VALUES.dimension, child(group, step)?.$value);
  if (!group || !length) return;
  props.ctx.setToken(key, setStep(group, step, { ...length, value }, props.ctx.vendor));
}
</script>

<template>
  <div v-for="{ key, label, spec, steps } in scales" :key="key">
    <h4>{{ label }}</h4>
    <div v-if="spec" class="cd-field-row">
      <NumberField
        :label="`Base (${spec.base.unit})`"
        :value="spec.base.value"
        @commit="regenerate(key, { base: { ...spec.base, value: $event } })"
      />
      <NumberField
        v-if="spec.ratio !== undefined"
        label="Ratio"
        :value="spec.ratio"
        @commit="(value) => value > 0 && regenerate(key, { ratio: value })"
      />
    </div>
    <div class="cd-field-row">
      <template v-for="{ step, length, byHand } in steps" :key="step">
        <NumberField
          v-if="length"
          :label="byHand ? `${step} (set by hand)` : step"
          :value="length.value"
          @commit="setValue(key, step, $event)"
        />
      </template>
    </div>
  </div>
</template>
