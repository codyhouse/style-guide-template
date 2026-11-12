<script setup lang="ts">
import { computed } from 'vue';
import { ROLES } from '../../lib/contrast.js';
import * as E from '../../lib/edit.js';
import Choice from './Choice.vue';
import type { EditorContext } from './context.js';
import { cap, huesOf, shadesOf } from './palette-data.js';
const props = defineProps<{ ctx: EditorContext }>();
const shades = computed(() =>
  huesOf(props.ctx.tree).flatMap((hue) =>
    shadesOf(props.ctx.tree, hue).map((s) => ({
      value: `{color.${hue}.${s}}`,
      label: `${hue}-${s}`,
      swatch: `var(--color-${hue}-${s})`,
    })),
  ),
);
const roleFields = computed(() =>
  ROLES.map((role) => ({
    role,
    tokens: [...props.ctx.tokens].filter(([p]) => p.startsWith(`color.${role}.`)),
  })).filter((group) => group.tokens.length),
);
function options(path: string, value: string) {
  return shades.value.some((o) => o.value === value)
    ? shades.value
    : [{ value, label: 'Custom value', swatch: `var(--${path.replace(/\./g, '-')})` }, ...shades.value];
}
function setRole(path: string, value: string) {
  props.ctx.set(
    E.setRole(props.ctx.session.store.get(), props.ctx.theme, path.replace(/^color\./, ''), value),
  );
}
</script>

<template>
  <p class="cd-hint">Editing the {{ ctx.theme }} theme. Switch the theme in the header to edit the other.</p>
  <div v-for="group in roleFields" :key="group.role">
    <Choice
      v-for="[path, token] in group.tokens"
      :key="path"
      :label="cap(path.split('.').slice(1).join(' ').replace(/-/g, ' '))"
      :options="options(path, token.value)"
      :value="token.value"
      @update:value="setRole(path, $event)"
    />
  </div>
</template>
