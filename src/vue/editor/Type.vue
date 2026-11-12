<script setup lang="ts">
import { computed } from 'vue';
import * as E from '../../lib/edit.js';
import type { TokenNode } from '../../lib/types.js';
import FontsourcePicker from '../FontsourcePicker.vue';
import Choice from './Choice.vue';
import type { EditorContext } from './context.js';
import IconButton from './IconButton.vue';
import NumberField from './NumberField.vue';
import UploadButton from './UploadButton.vue';
import { cap } from './palette-data.js';
const props = defineProps<{ ctx: EditorContext }>();
const generic = ['sans-serif', 'serif', 'monospace', 'cursive', 'system-ui'];
const own = (o?: TokenNode) => Object.keys(o ?? {}).filter((k) => !k.startsWith('$'));
const families = computed(() => {
  const tokenFamilies = Object.values<TokenNode>(props.ctx.tree.font ?? {}).flatMap((t) =>
    t?.$value ? [[t.$value].flat()[0]] : [],
  );
  return [...new Set([...props.ctx.meta.fontFiles.map((f) => f.family), ...tokenFamilies])].map((f) => ({
    value: f,
    label: f,
  }));
});
const styles = computed(() =>
  Object.entries<TokenNode>(props.ctx.tree.typography ?? {}).filter(
    ([k, t]) => !k.startsWith('$') && t.$value && typeof t.$value === 'object',
  ),
);
const fontOptions = computed(() =>
  own(props.ctx.tree.font).map((f) => ({ value: `{font.${f}}`, label: `${cap(f)} font` })),
);
const sizeOptions = computed(() =>
  own(props.ctx.tree['font-size']).map((s) => {
    const { value, unit } = props.ctx.tree['font-size'][s].$value;
    return { value: `{font-size.${s}}`, label: `${s} (${value}${unit})` };
  }),
);
function put(name: string, patch: Record<string, unknown>) {
  const path = `typography.${name}`,
    cur = props.ctx.fresh(path);
  props.ctx.set(
    E.setToken(props.ctx.session.store.get(), path, { ...cur, $value: { ...cur.$value, ...patch } }),
  );
}
function setFont(name: string, family: string) {
  const current = [props.ctx.tree.font[name].$value].flat();
  const suffix = generic.includes(current.at(-1)) ? current.at(-1) : 'sans-serif';
  props.ctx.set(E.setToken(props.ctx.session.store.get(), `font.${name}`, { $value: [family, suffix] }));
}
</script>

<template>
  <Choice
    v-for="name in own(ctx.tree.font)"
    :key="name"
    :label="`${cap(name)} font`"
    :options="families"
    :value="[ctx.tree.font[name].$value].flat()[0]"
    @change="setFont(name, $event)"
  />
  <div v-for="[name, token] in styles" :key="name">
    <h4>{{ cap(name.replace(/-/g, ' ')) }}</h4>
    <div class="cd-field-row">
      <Choice
        label="Font"
        :options="fontOptions"
        :value="token.$value.fontFamily"
        @change="put(name, { fontFamily: $event })"
      />
      <Choice
        label="Size"
        :options="sizeOptions"
        :value="token.$value.fontSize"
        @change="put(name, { fontSize: $event })"
      />
    </div>
    <div class="cd-field-row">
      <NumberField
        label="Weight"
        :value="token.$value.fontWeight"
        :min="1"
        :max="1000"
        @commit="(value) => value >= 1 && value <= 1000 && put(name, { fontWeight: value })"
      />
      <NumberField
        label="Line height"
        :value="token.$value.lineHeight"
        :min="0"
        @commit="(value) => value > 0 && put(name, { lineHeight: value })"
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
  <h4>Add from Fontsource</h4>
  <FontsourcePicker @pick="(files) => ctx.setMeta((m) => E.addFontFiles(m, files))" />
</template>
