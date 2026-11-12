<script setup lang="ts">
import { computed } from 'vue';
import { cssName } from '../../lib/css.js';
import type { Dimension, Tokens } from '../../lib/types.js';
import { dim } from './parts.js';
const props = defineProps<{ tokens: Tokens; kind: 'spacing' | 'radius' | 'shadow' }>();
const steps = computed(() => [...props.tokens].filter(([path]) => path.startsWith(`${props.kind}.`)));
const value = (path: string) => `var(${cssName(path)})`;
const radiusText = (v: Dimension) => (v.value * (v.unit === 'rem' ? 16 : 1) >= 9999 ? 'full' : dim(v));
</script>

<template>
  <div v-if="kind === 'spacing'" class="cd-box cd-token-list">
    <div v-for="[path, token] in steps" :key="path" class="cd-token-row">
      <span
        ><code>{{ cssName(path) }}</code> <span class="cd-token-value">{{ dim(token.resolved) }}</span></span
      >
      <div class="cd-bar" :style="{ width: value(path) }"></div>
    </div>
  </div>
  <div v-else :class="['cd-swatch-grid', { 'cd-shadow-stage': kind === 'shadow' }]">
    <figure v-for="[path, token] in steps" :key="path">
      <div
        :class="kind === 'radius' ? 'cd-radius-box' : 'cd-shadow-box'"
        :style="kind === 'radius' ? { borderRadius: value(path) } : { boxShadow: value(path) }"
      ></div>
      <figcaption>
        <code>{{ cssName(path) }}</code><span v-if="kind === 'radius'" class="cd-token-value">
          {{ radiusText(token.resolved) }}</span
        >
      </figcaption>
    </figure>
  </div>
</template>
