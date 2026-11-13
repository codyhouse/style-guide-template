<script setup lang="ts">
import { computed } from 'vue';
import { ROLES } from '../../lib/contrast.js';
import * as E from '../../lib/edit.js';
import Choice from './Choice.vue';
import type { EditorContext } from './context.js';
import { cssName } from '../../lib/css.js';
import { paletteColors } from '../../lib/palette.js';
import { cap } from '../guide/parts.js';

const props = defineProps<{ ctx: EditorContext }>();
const shades = computed(() =>
  paletteColors(props.ctx.doc, props.ctx.vendor).flatMap((color) =>
    color.shades.map((shade) => {
      const path = `color.${color.id}.${shade.name}`;
      return { value: `{${path}}`, label: `${color.id}-${shade.name}`, swatch: `var(${cssName(path)})` };
    }),
  ),
);
const roleFields = computed(() =>
  ROLES.map((role) => ({
    role,
    tokens: [...props.ctx.tokens]
      .filter(([path]) => path.startsWith(`color.${role}.`))
      .map(([path, token]) => ({
        path,
        label: cap(path.split('.').slice(1).join(' ').replaceAll('-', ' ')),
        alias: typeof token.value === 'string' ? token.value : '',
      })),
  })).filter((group) => group.tokens.length),
);

function options(path: string, value: string) {
  return shades.value.some((o) => o.value === value)
    ? shades.value
    : [{ value, label: 'Custom value', swatch: `var(${cssName(path)})` }, ...shades.value];
}

function setRole(path: string, value: string) {
  props.ctx.edit((doc) => E.setRole(doc, props.ctx.theme, path.slice('color.'.length), value));
}
</script>

<template>
  <p class="cd-hint">Editing the {{ ctx.theme }} theme. Switch the theme in the header to edit the other.</p>
  <div v-for="group in roleFields" :key="group.role">
    <Choice
      v-for="{ path, label, alias } in group.tokens"
      :key="path"
      :label="label"
      :options="options(path, alias)"
      :value="alias"
      @update:value="setRole(path, $event)"
    />
  </div>
</template>
