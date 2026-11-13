<script setup lang="ts">
import { computed } from 'vue';
import type { Session } from '../../app/session.js';
import type { Tokens } from '../../lib/types.js';
import { editorContext } from './context.js';
import Brand from './Brand.vue';
import Palette from './Palette.vue';
import Roles from './Roles.vue';
import Type from './Type.vue';
import Scales from './Scales.vue';
import Shadow from './Shadow.vue';
import Assets from './Assets.vue';

const props = defineProps<{ session: Session; tokens: Tokens; theme: string }>();
const emit = defineEmits<{ load: []; save: []; export: [] }>();
const ctx = computed(() => editorContext(props.session, props.theme, props.tokens));
const areas = [
  { name: 'Brand', component: Brand, open: true },
  { name: 'Palette', component: Palette, open: true },
  { name: 'Roles', component: Roles },
  { name: 'Fonts and type', component: Type },
  { name: 'Scales', component: Scales },
  { name: 'Shadow', component: Shadow },
  { name: 'Assets', component: Assets },
];
</script>

<template>
  <details v-for="area in areas" :key="area.name" class="cd-drawer-area" :open="area.open">
    <summary>
      <h3>{{ area.name }}</h3>
    </summary>
    <Brand
      v-if="area.name === 'Brand'"
      :ctx="ctx"
      @load="emit('load')"
      @save="emit('save')"
      @export="emit('export')"
    />
    <component :is="area.component" v-else :ctx="ctx" />
  </details>
</template>
