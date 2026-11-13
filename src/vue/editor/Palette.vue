<script setup lang="ts">
import { computed, ref } from 'vue';
import { parseCssColor, toHex } from '../../lib/color.js';
import { ROLES } from '../../lib/contrast.js';
import {
  addColor,
  generateShades,
  handSetShades,
  paletteColors,
  paletteId,
  referencesTo,
  removeColor,
  removeShade,
  setShade,
  type PaletteColor,
} from '../../lib/palette.js';
import type { DtcgColor } from '../../lib/types.js';
import ColorInput, { COLOR_ERROR } from '../ColorInput.vue';
import Confirm, { type ConfirmChoice } from '../Confirm.vue';
import { cap } from '../guide/parts.js';
import type { EditorContext } from './context.js';
import IconButton from './IconButton.vue';
import AddShadeForm from './AddShadeForm.vue';
import ShadeEditor from './ShadeEditor.vue';

interface Question {
  title: string;
  message: string;
  items: string[];
  choices: ConfirmChoice[];
  run: (choice: string) => void;
}

const props = defineProps<{ ctx: EditorContext }>();

const colors = computed(() => paletteColors(props.ctx.doc, props.ctx.vendor));
const baseHex = (color: PaletteColor) => {
  const base = color.shades.find((shade) => shade.isBase)?.color;
  return base ? toHex(base) : '';
};

const question = ref<Question>();
const asking = ref(false);

function ask(next: Question) {
  question.value = next;
  asking.value = true;
}

function describeReferences(colorId: string, shades?: string[]) {
  return referencesTo(props.ctx.doc, colorId, shades).map((ref) =>
    ref.context === 'foundation' ? ref.path : `${ref.path} (${ref.context})`,
  );
}

function confirmRemoval(name: string, items: string[], run: () => void) {
  if (!items.length) return run();
  ask({
    title: `Remove ${name}?`,
    message: 'These tokens use it. They keep the color they show now, as a fixed value.',
    items,
    choices: [{ value: 'remove', label: `Remove ${name}`, primary: true }],
    run,
  });
}

function removeWholeColor(id: string) {
  confirmRemoval(id, describeReferences(id), () => props.ctx.edit((doc) => removeColor(doc, id)));
}

function removeOneShade(id: string, shade: string) {
  confirmRemoval(`${id}-${shade}`, describeReferences(id, [shade]), () =>
    props.ctx.edit((doc) => removeShade(doc, id, shade, props.ctx.vendor)),
  );
}

function generate(id: string) {
  const run = (mode: string) =>
    props.ctx.edit((doc) =>
      generateShades(doc, id, props.ctx.vendor, mode === 'overwrite' ? 'overwrite' : 'keep'),
    );
  const handSet = handSetShades(props.ctx.doc, id, props.ctx.vendor);
  if (!handSet.length) return run('keep');
  ask({
    title: `Regenerate ${id} shades?`,
    message: 'These shades were set by hand. Keep them as they are, or replace them with generated ones.',
    items: handSet.map((shade) => `${id}-${shade}`),
    choices: [
      { value: 'overwrite', label: 'Replace them' },
      { value: 'keep', label: 'Keep hand-set shades', primary: true },
    ],
    run,
  });
}

function setBaseColor(color: PaletteColor, value: DtcgColor) {
  const base = color.shades.find((shade) => shade.isBase);
  if (base) props.ctx.edit((doc) => setShade(doc, color.id, base.name, value, props.ctx.vendor));
}

const newName = ref('');
const newColor = ref('');
const nameError = ref<string>();
const colorError = ref<string>();

function colorNameProblem(id: string) {
  if (!id) return 'Give the color a name.';
  if (ROLES.includes(id) || colors.value.some((color) => color.id === id)) return `${id} is already taken.`;
  return undefined;
}

function addNewColor() {
  const id = paletteId(newName.value);
  const value = parseCssColor(newColor.value.trim());
  nameError.value = colorNameProblem(id);
  colorError.value = value ? undefined : COLOR_ERROR;
  if (nameError.value || !value) return;
  props.ctx.edit((doc) => addColor(doc, id, value, props.ctx.vendor));
  newName.value = '';
  newColor.value = '';
}
</script>

<template>
  <section v-for="color in colors" :key="color.id" class="cd-hue" :aria-label="`${cap(color.id)} color`">
    <div class="cd-field-row">
      <ColorInput
        :label="`${cap(color.id)} base color`"
        :model-value="baseHex(color)"
        @commit="setBaseColor(color, $event)"
      />
      <IconButton name="trash" :label="`Remove ${color.id}`" @click="removeWholeColor(color.id)" />
    </div>
    <ol class="cd-mini-scale" :aria-label="`${color.id} shades`">
      <li v-for="shade in color.shades" :key="shade.name">
        <ShadeEditor
          :ctx="ctx"
          :color-id="color.id"
          :shade="shade"
          @remove="removeOneShade(color.id, shade.name)"
        />
      </li>
    </ol>
    <p class="cd-hint">
      {{ color.shades.length }} {{ color.shades.length === 1 ? 'shade' : 'shades' }}. Select a shade to edit
      it; a dot marks shades set by hand.
    </p>
    <div class="cd-field-row">
      <button type="button" class="btn btn-secondary btn-small" @click="generate(color.id)">
        {{ color.shades.length === 1 ? 'Generate shades 50 to 950' : 'Regenerate shades' }}
      </button>
    </div>
    <AddShadeForm :ctx="ctx" :color="color" />
  </section>
  <form class="cd-field-row" @submit.prevent="addNewColor">
    <label class="cd-field"
      ><span>New color name</span>
      <input
        v-model="newName"
        type="text"
        placeholder="accent"
        :aria-invalid="nameError ? 'true' : undefined"
        :aria-describedby="nameError ? 'new-color-name-error' : undefined"
      />
      <span v-if="nameError" id="new-color-name-error" class="cd-error">{{ nameError }}</span>
    </label>
    <ColorInput v-model="newColor" label="Color" placeholder="any CSS color" :error="colorError" />
    <button type="submit" class="btn btn-small">Add color</button>
  </form>
  <Confirm
    v-if="question"
    v-model:open="asking"
    :title="question.title"
    :message="question.message"
    :items="question.items"
    :choices="question.choices"
    @choose="question.run"
  />
</template>
