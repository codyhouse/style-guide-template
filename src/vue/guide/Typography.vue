<script setup lang="ts">
import { computed } from 'vue';
import { cssName } from '../../lib/css.js';
import { cssString } from '../../lib/fonts.js';
import type { BrandMeta, FontFile, Tokens } from '../../lib/types.js';
import { VALUES } from '../../lib/schema.js';
import { valueAs } from '../../lib/values.js';
import { dim } from './parts.js';

const props = defineProps<{ tokens: Tokens; meta: BrandMeta }>();
const sizes = computed(() =>
  [...props.tokens].filter(([p, t]) => p.startsWith('font-size.') && t.type === 'dimension'),
);
const styles = computed(() =>
  [...props.tokens].flatMap(([path, token]) => {
    const style = token.type === 'typography' ? valueAs(VALUES.typography, token.resolved) : null;
    if (!style) return [];
    const family = [style.fontFamily].flat()[0];
    const summary = `${family} ${style.fontWeight} ${dim(style.fontSize)} / ${style.lineHeight}`;
    return [{ path, name: path.slice('typography.'.length), summary }];
  }),
);
const families = computed(() => [...Map.groupBy(props.meta.fontFiles, (f: FontFile) => f.family)]);
const variable = (p: string, field: string) => `var(${cssName(p)}-${field})`;
</script>

<template>
  <div class="cd-box">
    <h3>Font sizes</h3>
    <p
      v-for="[path, token] in sizes"
      :key="path"
      class="cd-type-sample"
      :style="{ fontSize: `var(${cssName(path)})` }"
    >
      Aa
      <span class="cd-type-meta"
        ><code>{{ cssName(path) }}</code> <span class="cd-token-value">{{ dim(token.resolved) }}</span></span
      >
    </p>
  </div>
  <div class="cd-box">
    <h3>Text styles</h3>
    <p
      v-for="{ path, name, summary } in styles"
      :key="path"
      class="cd-type-sample"
      :style="{
        fontFamily: variable(path, 'font-family'),
        fontSize: variable(path, 'font-size'),
        fontWeight: variable(path, 'font-weight'),
        letterSpacing: variable(path, 'letter-spacing'),
        lineHeight: variable(path, 'line-height'),
      }"
    >
      {{ name }}
      <span class="cd-type-meta">{{ summary }}</span>
    </p>
  </div>
  <div class="cd-box">
    <h3>Fonts</h3>
    <template v-if="families.length">
      <div v-for="[family, files] in families" :key="family" class="cd-specimen">
        <b>{{ family }}</b>
        <p
          v-for="file in files"
          :key="file.src"
          :style="{ fontFamily: cssString(family), fontWeight: String(file.weight), fontStyle: file.style }"
        >
          {{ file.weight }} {{ file.style }}: The quick brown fox jumps over the lazy dog
          <span class="cd-type-meta">{{ file.src }}</span>
        </p>
      </div>
    </template>
    <p v-else>No font files loaded yet.</p>
  </div>
</template>
