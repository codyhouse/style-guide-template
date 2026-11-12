<script setup lang="ts">
import { computed, ref, shallowReactive } from 'vue';
import * as E from '../../lib/edit.js';
import { extension, fileName } from '../../lib/path.js';
import type { AssetGroup, AssetItem } from '../../lib/types.js';
import { urlFor } from '../urls.js';
import Listbox from '../Listbox.vue';
import IconButton from './IconButton.vue';
import TextField from './TextField.vue';
import UploadButton from './UploadButton.vue';
import type { EditorContext } from './context.js';
const props = defineProps<{ ctx: EditorContext }>();
const picks = shallowReactive(new Map<string, string>());
const newGroup = ref('');
const library = computed(() => [...props.ctx.session.library].filter((p) => !p.startsWith('brands/')));
const image = /\.(svg|png|jpe?g|gif|webp|avif|ico)$/i;
const pick = (group: AssetGroup) => picks.get(group.id) ?? library.value[0];
function addFromLibrary(group: AssetGroup) {
  const src = pick(group);
  if (src && !group.items.some((item) => item.src === src))
    props.ctx.setMeta((meta) => E.addItems(meta, group.id, [{ label: fileName(src), src }]));
}
function addGroup() {
  const label = newGroup.value.trim();
  if (!label) return;
  props.ctx.setMeta((meta) => E.addGroup(meta, label));
  newGroup.value = '';
}
function thumb(item: AssetItem) {
  return urlFor(item, props.ctx.session.ctx);
}
</script>

<template>
  <div v-for="group in ctx.meta.assetGroups" :key="group.id">
    <div class="cd-field-row">
      <TextField
        label="Group name"
        :value="group.label"
        @commit="(value) => value && ctx.setMeta((m) => E.renameGroup(m, group.id, value))"
      />
      <IconButton
        name="up"
        :label="`Move ${group.label ?? group.id} up`"
        @click="ctx.setMeta((m) => E.moveGroup(m, group.id, -1))"
      />
      <IconButton
        name="down"
        :label="`Move ${group.label ?? group.id} down`"
        @click="ctx.setMeta((m) => E.moveGroup(m, group.id, 1))"
      />
      <IconButton
        name="trash"
        :label="`Remove ${group.label ?? group.id}`"
        @click="ctx.setMeta((m) => E.removeGroup(m, group.id))"
      />
    </div>
    <ul class="cd-list-editor">
      <li v-for="item in group.items" :key="item.src">
        <img v-if="thumb(item) && image.test(item.src)" class="cd-thumb" :src="thumb(item) ?? ''" alt="" />
        <span v-else class="cd-thumb cd-thumb-file" aria-hidden="true">{{ extension(item.src) }}</span>
        <div>
          <TextField
            label="Label"
            :value="item.label"
            @commit="ctx.setMeta((m) => E.updateItem(m, group.id, item.src, { label: $event }))"
          />
          <TextField
            label="Description"
            :value="item.description"
            :hint="item.src"
            @commit="
              ctx.setMeta((m) => E.updateItem(m, group.id, item.src, { description: $event || undefined }))
            "
          />
        </div>
        <IconButton
          name="up"
          :label="`Move ${item.label} up`"
          @click="ctx.setMeta((m) => E.moveItem(m, group.id, item.src, -1))"
        />
        <IconButton
          name="down"
          :label="`Move ${item.label} down`"
          @click="ctx.setMeta((m) => E.moveItem(m, group.id, item.src, 1))"
        />
        <IconButton
          name="trash"
          :label="`Remove ${item.label}`"
          @click="ctx.setMeta((m) => E.removeItem(m, group.id, item.src))"
        />
      </li>
    </ul>
    <UploadButton
      :label="`Upload to ${group.label ?? group.id}`"
      @files="ctx.session.addUploads($event, group.id)"
    />
    <form v-if="library.length" class="cd-field-row" @submit.prevent="addFromLibrary(group)">
      <div class="cd-field">
        <span>From the library</span>
        <Listbox
          :label="`Library file for ${group.label ?? group.id}`"
          :options="library.map((src) => ({ value: src, label: src }))"
          :value="pick(group)"
          @update:value="picks.set(group.id, $event)"
        />
      </div>
      <button type="submit" class="btn btn-small">Add</button>
    </form>
  </div>
  <form class="cd-field-row" @submit.prevent="addGroup">
    <label class="cd-field"
      ><span>New group</span><input v-model="newGroup" type="text" placeholder="Patterns"
    /></label>
    <button type="submit" class="btn btn-small">Add group</button>
  </form>
</template>
