<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { generateCss } from '../../lib/css.js';
import { shadcnCss, tailwindCss } from '../../lib/exports.js';
import type { FontFile, ResolverDoc } from '../../lib/types.js';
import Icon from '../Icon.vue';
import CopyButton from './CopyButton.vue';
const props = defineProps<{ doc: ResolverDoc; vendor: string }>();
const fontSrc = (f: FontFile) => `../${f.src}`;
const formats = [
  {
    key: 'css',
    label: 'CSS variables',
    code: (doc: ResolverDoc, vendor: string) => generateCss(doc, { vendor, fontSrc }),
  },
  {
    key: 'tailwind',
    label: 'Tailwind v4',
    code: (doc: ResolverDoc, vendor: string) => tailwindCss(doc, { vendor, fontSrc }),
  },
  { key: 'shadcn', label: 'shadcn/ui', code: (doc: ResolverDoc) => shadcnCss(doc) },
];
const index = ref(0);
const format = computed(() => formats[index.value]);
const code = computed(() => format.value.code(props.doc, props.vendor));
async function select(i: number, focus = false) {
  index.value = (i + formats.length) % formats.length;
  await nextTick();
  if (focus) document.getElementById(`cd-code-${format.value.key}`)?.focus();
}
function onKey(e: KeyboardEvent) {
  const moves: Record<string, number> = {
    ArrowRight: index.value + 1,
    ArrowLeft: index.value - 1,
    Home: 0,
    End: formats.length - 1,
  };
  if (!(e.key in moves)) return;
  e.preventDefault();
  void select(moves[e.key], true);
}
</script>

<template>
  <div class="cd-code-bar">
    <div role="tablist" class="cd-tabs" aria-label="Code format" @keydown="onKey">
      <button
        v-for="(item, i) in formats"
        :id="`cd-code-${item.key}`"
        :key="item.key"
        type="button"
        role="tab"
        aria-controls="cd-code-panel"
        :aria-selected="i === index"
        :tabindex="i === index ? 0 : -1"
        @click="select(i)"
      >
        {{ item.label }}
      </button>
    </div>
    <div>
      <CopyButton
        :text="code"
        :label="`Copy ${format.label}`"
        :title="`Copy ${format.label}`"
        class="btn btn-secondary btn-small cd-copy"
      >
        <span><Icon name="copy" />Copy</span>
      </CopyButton>
    </div>
  </div>
  <div id="cd-code-panel" role="tabpanel" class="cd-code" :aria-labelledby="`cd-code-${format.key}`">
    <pre tabindex="0" :aria-label="format.label"><code>{{ code }}</code></pre>
  </div>
</template>
