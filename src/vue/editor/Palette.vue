<script setup lang="ts">
import { computed, ref } from 'vue';
import { parseCssColor, toHex, toOklchString } from '../../lib/color.js';
import { ROLES } from '../../lib/contrast.js';
import * as E from '../../lib/edit.js';
import ColorInput, { COLOR_ERROR } from '../ColorInput.vue';
import IconButton from './IconButton.vue';
import TextField from './TextField.vue';
import type { EditorContext } from './context.js';
import { cap, huesOf, shadesOf } from './palette-data.js';
const props = defineProps<{ ctx: EditorContext }>();
const nameError = ref<string>();
const colorError = ref<string>();
const hues = computed(() => huesOf(props.ctx.tree));
function group(hue: string) {
  return props.ctx.tree.color[hue];
}
function base(hue: string) {
  const shades = shadesOf(props.ctx.tree, hue);
  return (
    group(hue).$extensions?.[props.ctx.session.vendor]?.base ??
    ('600' in group(hue) ? '600' : shades[Math.floor(shades.length / 2)])
  );
}
function name(hue: string, shade: string) {
  return `${hue}-${shade}${shade === base(hue) ? ' (your color)' : ''}`;
}
function setExt(path: string, patch: Record<string, unknown>) {
  const current = props.ctx.fresh(path),
    vendor = props.ctx.session.vendor;
  const own = { ...current.$extensions?.[vendor], ...patch };
  props.ctx.set(
    E.setToken(props.ctx.session.store.get(), path, {
      ...current,
      $extensions: { ...current.$extensions, [vendor]: own },
    }),
  );
}
function setCmyk(path: string, value: string) {
  const parts = value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  setExt(path, { cmyk: parts.length === 4 && parts.every((n) => n >= 0 && n <= 100) ? parts : undefined });
}
function setShade(path: string, color: Parameters<typeof E.setHue>[2]) {
  props.ctx.set(E.setToken(props.ctx.session.store.get(), path, { ...props.ctx.fresh(path), $value: color }));
}
function addHue(e: Event) {
  e.preventDefault();
  const data = new FormData(e.currentTarget as HTMLFormElement);
  const id = String(data.get('name') ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '');
  const color = parseCssColor(String(data.get('color') ?? '').trim());
  nameError.value = !id
    ? 'Give the hue a name.'
    : ROLES.includes(id) || hues.value.includes(id)
      ? `${id} is already taken.`
      : undefined;
  colorError.value = color ? undefined : COLOR_ERROR;
  if (nameError.value || !color) return;
  props.ctx.set(E.setHue(props.ctx.session.store.get(), id, color, props.ctx.session.vendor));
  (e.currentTarget as HTMLFormElement).reset();
}
</script>

<template>
  <div v-for="hue in hues" :key="hue" class="cd-hue">
    <div class="cd-field-row">
      <label class="cd-field"
        ><span>{{ cap(hue) }} base color</span>
        <ColorInput
          :label="`${hue} base color`"
          :value="toHex(group(hue)[base(hue)].$value)"
          @commit="ctx.set(E.setHue(ctx.session.store.get(), hue, $event, ctx.session.vendor))"
        />
      </label>
      <IconButton
        name="trash"
        :label="`Remove ${hue}`"
        @click="ctx.set(E.removeHue(ctx.session.store.get(), hue))"
      />
    </div>
    <p class="cd-hint">
      Your color is kept as {{ hue }}-{{ base(hue) }}. The other
      {{ shadesOf(ctx.tree, hue).length - 1 }} shades are generated from it.
    </p>
    <ol class="cd-mini-scale" :aria-label="`${hue} shades`">
      <li
        v-for="shade in shadesOf(ctx.tree, hue)"
        :key="shade"
        :class="{ 'is-base': shade === base(hue) }"
        :title="name(hue, shade)"
        :style="{ background: `var(--color-${hue}-${shade})` }"
      >
        <span class="cd-sr-only">{{ name(hue, shade) }}</span>
      </li>
    </ol>
    <details>
      <summary>{{ cap(hue) }} shades, CMYK and Pantone</summary>
      <div v-for="shade in shadesOf(ctx.tree, hue)" :key="shade" class="cd-field-row">
        <label class="cd-field"
          ><span>{{ hue }}-{{ shade }}</span>
          <ColorInput
            :label="`${hue}-${shade}`"
            :value="toOklchString(group(hue)[shade].$value)"
            :picker="false"
            @commit="setShade(`color.${hue}.${shade}`, $event)"
          />
        </label>
        <TextField
          label="CMYK"
          :value="group(hue)[shade].$extensions?.[ctx.session.vendor]?.cmyk?.join(' ')"
          placeholder="C M Y K"
          @commit="setCmyk(`color.${hue}.${shade}`, $event)"
        />
        <TextField
          label="Pantone"
          :value="group(hue)[shade].$extensions?.[ctx.session.vendor]?.pantone"
          @commit="setExt(`color.${hue}.${shade}`, { pantone: $event || undefined })"
        />
      </div>
    </details>
  </div>
  <form class="cd-field-row" @submit="addHue">
    <label class="cd-field"
      ><span>New hue name</span>
      <input
        type="text"
        name="name"
        placeholder="accent"
        :aria-invalid="nameError ? 'true' : undefined"
        :aria-describedby="nameError ? 'new-hue-name-error' : undefined"
      />
      <span v-if="nameError" id="new-hue-name-error" class="cd-error">{{ nameError }}</span>
    </label>
    <label class="cd-field"
      ><span>Color</span>
      <ColorInput name="color" label="the new hue color" placeholder="any CSS color" :error="colorError" />
    </label>
    <button type="submit" class="btn btn-small">Add hue</button>
  </form>
</template>
