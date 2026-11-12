<script setup lang="ts">
import { computed } from 'vue';
import * as E from '../../lib/edit.js';
import { applyScale, setStep } from '../../lib/scale.js';
import type { EditorContext } from './context.js';
import NumberField from './NumberField.vue';
const props = defineProps<{ ctx: EditorContext }>();
const scales = computed(() =>
  (
    [
      ['spacing', 'Spacing'],
      ['radius', 'Radius'],
      ['font-size', 'Font size'],
    ] as const
  )
    .map(([key, label]) => ({ key, label, group: props.ctx.tree[key] }))
    .filter((x) => x.group),
);
function regenerate(key: string, patch: Record<string, unknown>) {
  const group = props.ctx.tree[key],
    vendor = props.ctx.session.vendor;
  const next = structuredClone(group);
  next.$extensions[vendor].scale = { ...group.$extensions?.[vendor]?.scale, ...patch };
  props.ctx.set(E.setToken(props.ctx.session.store.get(), key, applyScale(next, vendor)));
}
function setValue(key: string, step: string, value: number) {
  const group = props.ctx.tree[key],
    token = group[step];
  props.ctx.set(
    E.setToken(
      props.ctx.session.store.get(),
      key,
      setStep(group, step, { ...token.$value, value }, props.ctx.session.vendor),
    ),
  );
}
const steps = (key: string) => Object.keys(props.ctx.tree[key]).filter((k) => !k.startsWith('$'));
</script>

<template>
  <div v-for="{ key, label, group } in scales" :key="key">
    <h4>{{ label }}</h4>
    <div v-if="group.$extensions?.[ctx.session.vendor]?.scale" class="cd-field-row">
      <NumberField
        :label="`Base (${group.$extensions[ctx.session.vendor].scale.base.unit})`"
        :value="group.$extensions[ctx.session.vendor].scale.base.value"
        @commit="
          regenerate(key, { base: { ...group.$extensions[ctx.session.vendor].scale.base, value: $event } })
        "
      />
      <NumberField
        v-if="group.$extensions[ctx.session.vendor].scale.ratio !== undefined"
        label="Ratio"
        :value="group.$extensions[ctx.session.vendor].scale.ratio"
        @commit="(value) => value > 0 && regenerate(key, { ratio: value })"
      />
    </div>
    <div class="cd-field-row">
      <NumberField
        v-for="step in steps(key)"
        :key="step"
        :label="`${step}${group[step].$extensions?.[ctx.session.vendor]?.overridden ? ' (set by hand)' : ''}`"
        :value="group[step].$value.value"
        @commit="setValue(key, step, $event)"
      />
    </div>
  </div>
</template>
