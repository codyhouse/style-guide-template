<script setup lang="ts">
import { computed } from 'vue';
import type { AssetContext, AssetItem } from '../../lib/types.js';
import { urlFor } from '../urls.js';
import Icon from '../Icon.vue';

const props = defineProps<{ item: AssetItem; ctx: AssetContext; alt?: string }>();
const url = computed(() => urlFor(props.item, props.ctx));
</script>

<template>
  <img v-if="url" :src="url" :alt="alt ?? item.label ?? ''" />
  <div v-else class="cd-missing">
    <Icon name="alert" /><span>Missing file</span><code>{{ item.src }}</code>
  </div>
</template>
