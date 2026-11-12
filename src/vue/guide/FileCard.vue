<script setup lang="ts">
import { computed } from 'vue';
import type { AssetContext, AssetItem } from '../../lib/types.js';
import { extension, fileName } from '../../lib/path.js';
import { downloadUrl, urlFor } from '../urls.js';
import { formatSize, isImage } from './parts.js';
import Icon from '../Icon.vue';
const props = defineProps<{ item: AssetItem; ctx: AssetContext }>();
const url = computed(() => urlFor(props.item, props.ctx));
const ext = computed(() => extension(props.item.src));
const name = computed(() => fileName(props.item.src));
const data = computed(() => props.ctx.session.get(props.item.src));
const size = computed(() =>
  data.value ? formatSize(data.value instanceof Blob ? data.value.size : data.value.byteLength) : '',
);
const href = computed(() => (data.value ? downloadUrl(props.item.src, data.value) : url.value));
</script>

<template>
  <figure class="cd-file">
    <template v-if="url">
      <img v-if="isImage(ext)" :src="url" :alt="item.label ?? name" />
      <div v-else class="cd-file-card" aria-hidden="true">{{ ext }}</div>
      <figcaption>
        <b>{{ item.label ?? name }}</b>
        <small v-if="item.description">{{ item.description }}</small>
        <small>{{ `${name} ${ext.toUpperCase()} ${size}`.trim() }}</small>
        <a :href="href ?? undefined" :download="name">Download</a>
      </figcaption>
    </template>
    <template v-else>
      <div class="cd-missing">
        <Icon name="alert" /><span>Missing file</span><code>{{ item.src }}</code>
      </div>
      <figcaption>{{ item.label }}</figcaption>
    </template>
  </figure>
</template>
