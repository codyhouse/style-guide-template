<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchFont, fetchList, fontEntries } from '../lib/fontsource.js';
import type { FontDetail, FontFile, FontListing } from '../lib/types.js';
import Listbox from './Listbox.vue';
type Detail =
  | { family: string; loading: true }
  | { family: string; error: string }
  | { font: FontDetail; error?: string }
  | { added: string };
const emit = defineEmits<{ pick: [files: FontFile[]] }>();
const list = ref<FontListing[] | null>(null),
  listError = ref<string | null>(null);
const category = ref('all'),
  query = ref(''),
  detail = ref<Detail | null>(null);
const categories = ['all', 'sans-serif', 'serif', 'display', 'handwriting', 'monospace'].map((c) => ({
  value: c,
  label: c === 'all' ? 'All categories' : c,
}));
async function load() {
  listError.value = null;
  try {
    list.value = await fetchList();
  } catch (e) {
    listError.value = (e as Error).message;
  }
}
onMounted(() => {
  if (!list.value && !listError.value) void load();
});
async function choose(font: FontListing) {
  detail.value = { family: font.family, loading: true };
  try {
    detail.value = { font: await fetchFont(font.id) };
  } catch (e) {
    detail.value = { family: font.family, error: `Could not load ${font.family}: ${(e as Error).message}` };
  }
}
const hits = computed(() =>
  (list.value ?? [])
    .filter((f) => category.value === 'all' || f.category === category.value)
    .filter((f) => !query.value.trim() || f.family.toLowerCase().includes(query.value.trim().toLowerCase()))
    .slice(0, 12),
);
const status = computed(() => {
  if (listError.value)
    return `Fontsource is unreachable (${listError.value}). Uploaded and library fonts still work.`;
  if (!list.value) return 'Loading the Fontsource catalog...';
  if (query.value.trim() || category.value !== 'all') return `${hits.value.length} shown`;
  return `${list.value.length} fonts available. Type to search.`;
});
const font = computed(() => (detail.value && 'font' in detail.value ? detail.value.font : null));
const added = computed(() => (detail.value && 'added' in detail.value ? detail.value.added : null));
const loading = computed(() => (detail.value && 'loading' in detail.value ? detail.value.family : null));
const detailError = computed(() => (detail.value && 'error' in detail.value ? detail.value.error : null));
function submit(e: Event) {
  e.preventDefault();
  if (!font.value) return;
  const data = new FormData(e.currentTarget as HTMLFormElement);
  const all = (name: string) => data.getAll(name).map(String);
  const entries = fontEntries(font.value, {
    weights: all('weights').map(Number),
    styles: all('styles'),
    subsets: all('subsets'),
  });
  if (!entries.length) {
    detail.value = { font: font.value, error: 'Pick at least one weight, style and subset.' };
    return;
  }
  emit(
    'pick',
    entries.map(({ url, ...entry }) => entry),
  );
  detail.value = { added: `Added ${font.value.family} (${entries.length} files).` };
}
</script>

<template>
  <div class="cd-field">
    <input
      type="search"
      placeholder="Search fonts"
      aria-label="Search Fontsource fonts"
      :value="query"
      @input="query = ($event.target as HTMLInputElement).value"
    />
  </div>
  <div class="cd-field">
    <Listbox label="Category" :options="categories" :value="category" @change="category = $event" />
  </div>
  <p class="cd-hint" aria-live="polite">{{ status }}</p>
  <button v-if="listError" type="button" class="btn btn-secondary btn-small" @click="load">
    Retry Fontsource
  </button>
  <ul class="cd-list-editor">
    <li v-for="entry in hits" :key="entry.id">
      <span>{{ entry.family }} ({{ entry.category }})</span>
      <button type="button" class="btn btn-secondary btn-small" @click="choose(entry)">Choose</button>
    </li>
  </ul>
  <div>
    <p v-if="added" class="cd-hint">{{ added }}</p>
    <p v-else-if="loading" class="cd-hint">Loading {{ loading }}...</p>
    <p v-else-if="!font && detailError" class="cd-error">{{ detailError }}</p>
    <form v-else-if="font" :key="font.id" @submit="submit">
      <h4>{{ font.family }}</h4>
      <fieldset class="cd-checks">
        <legend>weights</legend>
        <label v-for="weight in font.weights" :key="weight"
          ><input
            type="checkbox"
            name="weights"
            :value="String(weight)"
            :checked="weight === 400 || weight === 700"
          />{{ weight }}</label
        >
      </fieldset>
      <fieldset class="cd-checks">
        <legend>styles</legend>
        <label v-for="style in font.styles" :key="style"
          ><input type="checkbox" name="styles" :value="style" :checked="style === 'normal'" />{{
            style
          }}</label
        >
      </fieldset>
      <fieldset class="cd-checks">
        <legend>subsets</legend>
        <label v-for="subset in font.subsets" :key="subset"
          ><input type="checkbox" name="subsets" :value="subset" :checked="subset === font.defSubset" />{{
            subset
          }}</label
        >
      </fieldset>
      <button type="submit" class="btn btn-small">Add {{ font.family }}</button>
      <p v-if="detailError" class="cd-error">{{ detailError }}</p>
    </form>
  </div>
</template>
