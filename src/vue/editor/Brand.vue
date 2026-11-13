<script setup lang="ts">
import { Session } from '../../app/session.js';
import { errorMessage } from '../../lib/io.js';
import type { EditorContext } from './context.js';
import Choice from './Choice.vue';
import TextField from './TextField.vue';

const { ctx } = defineProps<{ ctx: EditorContext }>();
defineEmits<{ load: []; save: []; export: [] }>();

async function replace(path: string) {
  try {
    ctx.session.store.load(await Session.fetchPreset(path));
  } catch (e) {
    ctx.session.warn(`Could not load the preset: ${errorMessage(e)}`);
  }
}
</script>

<template>
  <TextField
    label="Name"
    :value="ctx.doc.name"
    @commit="(value) => value && ctx.edit((doc) => ({ ...doc, name: value }))"
  />
  <div class="cd-field-row">
    <button type="button" class="btn btn-secondary btn-small" @click="$emit('load')">Load file</button>
    <button type="button" class="btn btn-secondary btn-small" @click="$emit('save')">Save JSON</button>
    <button type="button" class="btn btn-secondary btn-small" @click="$emit('export')">Export ZIP</button>
  </div>
  <Choice
    label="Replace with a preset"
    :options="ctx.session.manifest.brands.map((b) => ({ value: b.path, label: b.name }))"
    value=""
    @update:value="replace"
  />
  <div class="cd-field-row">
    <button type="button" class="btn btn-secondary btn-small" @click="ctx.session.store.clearDraft()">
      Clear local draft
    </button>
    <button
      v-if="ctx.session.store.hasPrevious()"
      type="button"
      class="btn btn-secondary btn-small"
      @click="ctx.session.store.restorePrevious()"
    >
      Restore previous draft
    </button>
  </div>
  <p class="cd-hint">
    Clearing or replacing keeps your previous draft, so it can be restored. Undo (Ctrl+Z) steps back through
    every edit.
  </p>
</template>
