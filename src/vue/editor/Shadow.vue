<script setup lang="ts">
import { computed } from 'vue';
import * as E from '../../lib/edit.js';
import type { TokenNode } from '../../lib/types.js';
import type { EditorContext } from './context.js';
import NumberField from './NumberField.vue';
const props = defineProps<{ ctx: EditorContext }>();
const shadows = computed(() =>
  Object.entries<TokenNode>(props.ctx.tree.shadow ?? {}).filter(
    ([key, token]) =>
      !key.startsWith('$') && !Array.isArray(token.$value) && typeof token.$value === 'object',
  ),
);
const px = (value: number) => ({ value, unit: 'px' });
function put(name: string, patch: Record<string, unknown>) {
  const path = `shadow.${name}`,
    current = props.ctx.fresh(path);
  props.ctx.set(
    E.setToken(props.ctx.session.store.get(), path, { ...current, $value: { ...current.$value, ...patch } }),
  );
}
</script>

<template>
  <div v-for="[name, token] in shadows" :key="name">
    <h4>{{ name }}</h4>
    <div class="cd-field-row">
      <NumberField
        label="Offset Y (px)"
        :value="token.$value.offsetY.value"
        @commit="put(name, { offsetY: px($event) })"
      />
      <NumberField
        label="Blur (px)"
        :value="token.$value.blur.value"
        @commit="(value) => value >= 0 && put(name, { blur: px(value) })"
      />
      <NumberField
        v-if="typeof token.$value.color === 'object'"
        label="Opacity"
        :value="token.$value.color.alpha ?? 1"
        :min="0"
        :max="1"
        :step="0.05"
        @commit="
          (value) => value >= 0 && value <= 1 && put(name, { color: { ...token.$value.color, alpha: value } })
        "
      />
    </div>
  </div>
</template>
