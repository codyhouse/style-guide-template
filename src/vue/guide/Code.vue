<script setup lang="ts">
import { computed, ref } from 'vue';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui';
import { exportFormats } from '../../lib/exports.js';
import type { ResolverDoc } from '../../lib/types.js';
import Icon from '../Icon.vue';
import CopyButton from './CopyButton.vue';

const props = defineProps<{ doc: ResolverDoc; vendor: string }>();
const selected = ref(exportFormats[0].key);
const format = computed(() => exportFormats.find((f) => f.key === selected.value) ?? exportFormats[0]);
const code = computed(() => format.value.render(props.doc, props.vendor));
</script>

<template>
  <TabsRoot v-model="selected" activation-mode="automatic">
    <div class="cd-code-bar">
      <TabsList class="cd-tabs" aria-label="Code format">
        <TabsTrigger v-for="item in exportFormats" :key="item.key" :value="item.key">
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
    <TabsContent v-for="item in exportFormats" :key="item.key" :value="item.key" class="cd-code">
      <pre><code>{{ code }}</code></pre>
    </TabsContent>
  </TabsRoot>
</template>
