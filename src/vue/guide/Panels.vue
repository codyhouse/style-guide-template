<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Session } from '../../app/session.js';
import type { ContrastResult } from '../../lib/types.js';
import Icon from '../Icon.vue';
import Listbox from '../Listbox.vue';
const props = defineProps<{ session: Session; contrast: ContrastResult[]; missing: string[] }>();
const newGroup = '__new';
const pendingTarget = ref<string | null>(null);
const targets = new WeakMap<File, string>();
const targetVersion = ref(0);
const missingInput = ref<HTMLInputElement>();
const options = computed(() => [
  ...props.session.meta.assetGroups.map((g) => ({ value: g.id, label: g.label ?? g.id })),
  { value: newGroup, label: 'New group: Uploads' },
]);
const target = computed(() =>
  options.value.some((o) => o.value === pendingTarget.value)
    ? pendingTarget.value
    : (options.value[0]?.value ?? newGroup),
);
const failures = computed(() => props.contrast.filter((r) => !r.pass).length);
const warnings = computed(() =>
  props.session.store.saveError
    ? [...props.session.warnings, 'Your edits could not be saved in this browser. Save JSON to keep them.']
    : props.session.warnings,
);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
function targetFor(file: File, candidates: string[]) {
  void targetVersion.value;
  return targets.get(file) ?? candidates[0];
}
function chooseTarget(file: File, value: string) {
  targets.set(file, value);
  targetVersion.value++;
}
function onMissingFiles(e: Event) {
  const input = e.target as HTMLInputElement;
  void props.session.fillMissing([...(input.files ?? [])]);
  input.value = '';
}
function over(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  (e.currentTarget as Element).classList.add('is-over');
}
function leave(e: DragEvent) {
  (e.currentTarget as Element).classList.remove('is-over');
}
function drop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  leave(e);
  void props.session.fillMissing([...(e.dataTransfer?.files ?? [])]);
}
</script>

<template>
  <div v-if="warnings.length" class="cd-box cd-panel" role="alert">
    <h2>Warnings</h2>
    <ul>
      <li v-for="warning in warnings" :key="warning">
        <span class="cd-status is-warn"><Icon name="alert" /></span> {{ warning }}
      </li>
    </ul>
    <button type="button" class="btn btn-secondary btn-small" @click="session.dismissWarnings()">
      Dismiss
    </button>
  </div>
  <div v-if="session.pending.length" class="cd-box cd-panel">
    <h2>{{ plural(session.pending.length, 'file') }} to add</h2>
    <ul>
      <li v-for="file in session.pending" :key="file.name">{{ file.name }}</li>
    </ul>
    <div class="cd-field-row">
      <div class="cd-field">
        <span>Add to group</span
        ><Listbox label="Asset group" :options="options" :value="target" @change="pendingTarget = $event" />
      </div>
      <button
        type="button"
        class="btn btn-small"
        @click="session.addPending(target === newGroup ? null : target)"
      >
        Add files
      </button>
      <button type="button" class="btn btn-secondary btn-small" @click="session.discardPending()">
        Discard
      </button>
    </div>
  </div>
  <div v-if="missing.length" class="cd-box cd-panel">
    <h2>Missing files</h2>
    <p>This brand refers to files that are not loaded. Drop them here; they are matched by file name.</p>
    <ul>
      <li v-for="item in missing" :key="item">
        <code>{{ item }}</code>
      </li>
    </ul>
    <div v-for="{ file, candidates } in session.ambiguous" :key="file.name" class="cd-field-row">
      <div class="cd-field">
        <span>{{ file.name }} matches more than one file</span>
        <Listbox
          :label="`Where does ${file.name} go?`"
          :options="candidates.map((c) => ({ value: c, label: c }))"
          :value="targetFor(file, candidates)"
          @change="chooseTarget(file, $event)"
        />
      </div>
      <button type="button" class="btn btn-small" @click="session.assign(file, targetFor(file, candidates))">
        Use here
      </button>
    </div>
    <div class="cd-drop-zone" @dragover="over" @dragleave="leave" @drop="drop">
      Drop the missing files here, or
      <button type="button" class="btn btn-secondary btn-small" @click="missingInput?.click()">
        Choose files
      </button>
      <input ref="missingInput" type="file" multiple hidden @change="onMissingFiles" />
    </div>
  </div>
  <div class="cd-box cd-panel">
    <h2>Contrast</h2>
    <span class="cd-status" :class="failures ? 'is-warn' : 'is-pass'"
      ><Icon :name="failures ? 'alert' : 'check'" />{{
        failures
          ? `${plural(failures, 'pair')} below the minimum`
          : `All ${contrast.length} required pairs pass`
      }}</span
    >
    <details>
      <summary>Show all pairs</summary>
      <table class="cd-roles">
        <thead>
          <tr>
            <th>Theme</th>
            <th>Pair</th>
            <th>Ratio</th>
            <th>Minimum</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(pair, i) in contrast" :key="i">
            <td>{{ pair.context }}</td>
            <td>{{ pair.label }}</td>
            <td>{{ pair.ratio }}:1</td>
            <td>{{ pair.min }}:1</td>
            <td>
              <span class="cd-status" :class="pair.pass ? 'is-pass' : 'is-warn'"
                ><Icon :name="pair.pass ? 'check' : 'alert'" />{{ pair.pass ? 'Pass' : 'Warning' }}</span
              >
            </td>
          </tr>
        </tbody>
      </table>
    </details>
  </div>
</template>
