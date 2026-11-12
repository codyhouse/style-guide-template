<script setup lang="ts">
import { computed, ref } from 'vue';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui';
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
const selected = ref(formats[0].key);
const format = computed(() => formats.find((f) => f.key === selected.value) ?? formats[0]);
const code = computed(() => format.value.code(props.doc, props.vendor));
</script>

<template>
  <TabsRoot v-model="selected" activation-mode="automatic">
    <div class="cd-code-bar">
      <TabsList class="cd-tabs" aria-label="Code format">
        <TabsTrigger v-for="item in formats" :key="item.key" :value="item.key">
          {{ item.label }}
        </TabsTrigger>
      </TabsList>
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
    <TabsContent v-for="item in formats" :key="item.key" :value="item.key" class="cd-code" tabindex="-1">
      <pre tabindex="0" :aria-label="item.label"><code>{{ code }}</code></pre>
    </TabsContent>
  </TabsRoot>
</template>
