<script setup lang="ts">
import { ref } from 'vue';
import { parseCssColor } from '../../lib/color.js';
import { addShade, paletteId, type PaletteColor } from '../../lib/palette.js';
import ColorInput, { COLOR_ERROR } from '../ColorInput.vue';
import type { EditorContext } from './context.js';

const props = defineProps<{ ctx: EditorContext; color: PaletteColor }>();

const name = ref('');
const value = ref('');
const error = ref<string>();

function nameProblem(id: string) {
  if (!id) return 'Give the shade a name.';
  if (props.color.shades.some((shade) => shade.name === id)) return `${id} is already taken.`;
  return undefined;
}

function add() {
  const id = paletteId(name.value);
  const color = parseCssColor(value.value.trim());
  error.value = nameProblem(id) ?? (color ? undefined : COLOR_ERROR);
  if (error.value || !color) return;
  props.ctx.edit((doc) => addShade(doc, props.color.id, id, color, props.ctx.vendor));
  name.value = '';
  value.value = '';
}
</script>

<template>
  <form class="cd-field-row" @submit.prevent="add">
    <label class="cd-field"
      ><span>New shade name</span>
      <input v-model="name" type="text" placeholder="light" />
    </label>
    <ColorInput v-model="value" label="Shade color" placeholder="any CSS color" :error="error" />
    <button type="submit" class="btn btn-small">Add shade</button>
  </form>
</template>
