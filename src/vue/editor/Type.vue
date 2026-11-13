<script setup lang="ts">
import { computed } from 'vue';
import * as E from '../../lib/edit.js';
import { child, children } from '../../lib/tree.js';
import { VALUES } from '../../lib/schema.js';
import { valueAs } from '../../lib/values.js';
import { cap, dim } from '../guide/parts.js';
import FontPicker from '../FontPicker.vue';
import Choice from './Choice.vue';
import type { EditorContext } from './context.js';
import IconButton from './IconButton.vue';
import NumberField from './NumberField.vue';
import UploadButton from './UploadButton.vue';

const props = defineProps<{ ctx: EditorContext }>();
const generic = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'system-ui']);

const familiesOf = (value: unknown) => [valueAs(VALUES.fontFamily, value) ?? []].flat();
const aliasOrEmpty = (value: unknown) => (typeof value === 'string' ? value : '');

const fonts = computed(() =>
  children(child(props.ctx.tree, 'font')).map(([name, token]) => ({
    name,
    label: `${cap(name)} font`,
    family: familiesOf(token.$value)[0] ?? '',
  })),
);

const families = computed(() => {
  const uploaded = props.ctx.meta.fontFiles.map((file) => file.family);
  const named = fonts.value.map((font) => font.family).filter(Boolean);
  return [...new Set([...uploaded, ...named])].map((family) => ({ value: family, label: family }));
});

const fontOptions = computed(() =>
  fonts.value.map((font) => ({ value: `{font.${font.name}}`, label: font.label })),
);

const sizeOptions = computed(() =>
  children(child(props.ctx.tree, 'font-size')).map(([size, token]) => ({
    value: `{font-size.${size}}`,
    label: `${size} (${dim(token.$value)})`,
  })),
);

const styles = computed(() =>
  children(child(props.ctx.tree, 'typography')).flatMap(([name, token]) => {
    const style = valueAs(VALUES.typography, token.$value);
    if (!style) return [];
    return [
      {
        name,
        title: cap(name.replaceAll('-', ' ')),
        fontFamily: aliasOrEmpty(style.fontFamily),
        fontSize: aliasOrEmpty(style.fontSize),
        fontWeight: typeof style.fontWeight === 'number' ? style.fontWeight : undefined,
        lineHeight: typeof style.lineHeight === 'number' ? style.lineHeight : undefined,
      },
    ];
  }),
);

function put(name: string, patch: Record<string, unknown>) {
  props.ctx.patchValue(`typography.${name}`, patch);
}

function setFont(name: string, family: string) {
  const last = familiesOf(child(child(props.ctx.tree, 'font'), name)?.$value).at(-1);
  const fallback = last && generic.has(last) ? last : 'sans-serif';
  props.ctx.setToken(`font.${name}`, { $value: [family, fallback] });
}
</script>

<template>
  <Choice
    v-for="font in fonts"
    :key="font.name"
    :label="font.label"
    :options="families"
    :value="font.family"
    @update:value="setFont(font.name, $event)"
  />
  <div v-for="style in styles" :key="style.name">
    <h4>{{ style.title }}</h4>
    <div class="cd-field-row">
      <Choice
        label="Font"
        :options="fontOptions"
        :value="style.fontFamily"
        @update:value="put(style.name, { fontFamily: $event })"
      />
      <Choice
        label="Size"
        :options="sizeOptions"
        :value="style.fontSize"
        @update:value="put(style.name, { fontSize: $event })"
      />
    </div>
    <div class="cd-field-row">
      <NumberField
        label="Weight"
        :value="style.fontWeight"
        :min="1"
        :max="1000"
        @commit="(value) => value >= 1 && value <= 1000 && put(style.name, { fontWeight: value })"
      />
      <NumberField
        label="Line height"
        :value="style.lineHeight"
        :min="0"
        @commit="(value) => value > 0 && put(style.name, { lineHeight: value })"
      />
    </div>
  </div>
  <h4>Font files</h4>
  <ul class="cd-list-editor">
    <li v-for="file in ctx.meta.fontFiles" :key="file.src">
      <span
        >{{ file.family }} {{ file.weight }} {{ file.style
        }}{{ file.subset ? ` (${file.subset})` : '' }}</span
      >
      <IconButton
        name="trash"
        :label="`Remove ${file.src}`"
        @click="ctx.setMeta((m) => E.removeFontFile(m, file.src))"
      />
    </li>
  </ul>
  <UploadButton
    label="Upload font files"
    accept=".woff2,.woff,.ttf,.otf"
    @files="ctx.session.addFontUploads($event)"
  />
  <p class="cd-hint">woff2, woff, ttf or otf. Family, weight and style are read from the file name.</p>
  <h4>Add from {{ ctx.session.fonts.name }}</h4>
  <FontPicker :provider="ctx.session.fonts" @pick="(files) => ctx.setMeta((m) => E.addFontFiles(m, files))" />
</template>
