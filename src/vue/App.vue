<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue';
import {
  onKeyStroke,
  useColorMode,
  useDropZone,
  useElementBounding,
  useEventListener,
  useFileDialog,
  useMediaQuery,
  usePreferredReducedMotion,
  useStyleTag,
  useTitle,
  watchDebounced,
  whenever,
} from '@vueuse/core';
import { DialogClose, DialogContent, DialogRoot, DialogTitle, DialogTrigger } from 'reka-ui';
import type { Session } from '../app/session.js';
import { download } from './download.js';
import { urlFor } from './urls.js';
import Action from './Action.vue';
import Guide from './guide/Guide.vue';
import Editor from './editor/Editor.vue';
import { sectionsOf } from './guide/sections.js';
import { useSession } from './useSession.js';
import { deriveView } from './view.js';

const props = defineProps<{ session: Session }>();
const session = useSession(props.session);
const { state: theme, store: themeChoice } = useColorMode({
  attribute: 'data-theme',
  storageKey: 'styleguide:theme',
});
const editing = ref(false);
const editorMounted = ref(false);
const exporting = ref(false);
const current = ref<string[]>([]);
const links = new Map<string, HTMLElement>();
const wide = useMediaQuery('(min-width: 768px)');
const reduceMotion = usePreferredReducedMotion();
const { height: headerHeight } = useElementBounding(useTemplateRef('header'));
const view = computed(() => deriveView(session.value, theme.value));
const sections = computed(() => sectionsOf(view.value.meta, view.value.tokens));
const logo = computed(() => view.value.meta.assetGroups.find((g) => g.id === 'logos')?.items[0]);
const logoUrl = computed(() => logo.value && urlFor(logo.value, session.value.ctx));

useTitle(() => `${session.value.doc.name ?? 'Brand'} | Style Guide`);
useStyleTag(
  computed(() => view.value.css),
  { id: 'brand-css' },
);
watchDebounced(view, () => session.value.prune(), { debounce: 2000, immediate: true });
useEventListener(document.fonts, 'loadingerror', (e: FontFaceSetLoadEvent) =>
  session.value.warn(
    ...e.fontfaces.map(
      (f) => `Font could not be loaded: ${f.family.replace(/"/g, '')} ${f.weight} ${f.style}`,
    ),
  ),
);
whenever(editing, () => (editorMounted.value = true), { once: true });

function toggleTheme() {
  themeChoice.value = theme.value === 'dark' ? 'light' : 'dark';
}

function step(redo: boolean) {
  if (redo) session.value.store.redo();
  else session.value.store.undo();
}

onKeyStroke(['z', 'Z', 'y', 'Y'], (e) => {
  const y = e.key.toLowerCase() === 'y';
  if (!(e.ctrlKey || e.metaKey) || e.altKey || (y && e.shiftKey)) return;
  if ((e.target as Element).closest?.('input, textarea, [contenteditable], [role=listbox]')) return;
  e.preventDefault();
  step(y || e.shiftKey);
});

function save() {
  const file = session.value.brandJson();
  download(file.name, file.data, 'application/json');
}

async function exportKit() {
  if (exporting.value) return;
  exporting.value = true;
  try {
    const { name, data } = await session.value.brandKit();
    download(name, data, 'application/zip');
  } catch (e) {
    session.value.warn(`Export failed: ${(e as Error).message}`);
  } finally {
    exporting.value = false;
  }
}

const loadDialog = useFileDialog({ reset: true });
loadDialog.onChange((files) => files && void session.value.receive([...files]));

const { isOverDropZone: dragging } = useDropZone(document, {
  checkValidity: (items) => [...items].some((item) => item.kind === 'file'),
  onDrop(files, e) {
    // the missing-files zone loads its own drops
    if (files && !(e.target as Element).closest?.('.cd-drop-zone')) void session.value.receive(files);
  },
});

function onNavWheel(e: WheelEvent) {
  const strip = e.currentTarget as HTMLElement;
  if (strip.scrollWidth <= strip.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  e.preventDefault();
  strip.scrollLeft += e.deltaY;
}
watch(current, (ids, before) => {
  const id = ids.find((i) => !before.includes(i));
  links.get(id ?? '')?.scrollIntoView({
    block: 'nearest',
    inline: 'center',
    behavior: reduceMotion.value === 'reduce' ? 'auto' : 'smooth',
  });
});
</script>

<template>
  <DialogRoot v-model:open="editing" :modal="false" :unmount-on-hide="false">
    <div :class="{ 'is-editing': editing, 'is-dragging': dragging }">
      <header ref="header">
        <div class="cd-logo">
          <img v-if="logoUrl" :src="logoUrl" :alt="session.doc.name ?? 'Logo'" />
          <span v-else class="cd-sr-only">{{ session.doc.name ?? 'Logo' }}</span>
        </div>
        <nav aria-label="Sections">
          <ul id="cd-nav" class="cd-main-nav" @wheel="onNavWheel">
            <li v-for="section in sections" :key="section.id">
              <a
                :ref="(el) => el && links.set(section.id, el as HTMLElement)"
                :href="`#${section.id}`"
                :class="{ selected: current.includes(section.id) }"
                :aria-current="current.includes(section.id) || undefined"
                >{{ section.title }}</a
              >
            </li>
          </ul>
        </nav>
        <div class="cd-actions">
          <Action
            id="theme-toggle"
            icon="moon"
            label="Dark mode"
            title="Dark mode"
            :pressed="theme === 'dark'"
            @click="toggleTheme"
          />
          <DialogTrigger as-child>
            <Action id="edit-toggle" icon="edit" label="Edit" title="Edit the brand" />
          </DialogTrigger>
          <div class="cd-actions-more">
            <Action
              id="load-btn"
              icon="load"
              label="Load"
              title="Load a brand file, ZIP, fonts or assets"
              @click="loadDialog.open()"
            />
            <Action
              id="save-btn"
              icon="save"
              label="Save JSON"
              title="Save the brand file as JSON"
              @click="save"
            />
          </div>
          <Action
            id="export-btn"
            icon="export"
            label="Export ZIP"
            title="Export the brand kit as a ZIP"
            :busy="exporting"
            @click="exportKit"
          />
        </div>
      </header>
      <Guide
        v-model:current="current"
        :session="session"
        :doc="session.doc"
        :tokens="view.tokens"
        :meta="view.meta"
        :covered="editing && !wide"
        :inset="headerHeight"
      />
      <div class="cd-drop" aria-hidden="true">Drop files to load them</div>
      <DialogContent
        id="cd-drawer"
        as="aside"
        class="cd-drawer"
        :aria-describedby="undefined"
        @interact-outside.prevent
      >
        <div class="cd-drawer-header">
          <DialogTitle>Edit brand</DialogTitle>
          <div class="cd-drawer-actions">
            <Action
              id="undo-btn"
              icon="undo"
              label="Undo"
              title="Undo (Ctrl+Z)"
              aria-keyshortcuts="Control+Z Meta+Z"
              :aria-disabled="!session.store.canUndo()"
              @click="step(false)"
            />
            <Action
              id="redo-btn"
              icon="redo"
              label="Redo"
              title="Redo (Ctrl+Shift+Z)"
              aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
              :aria-disabled="!session.store.canRedo()"
              @click="step(true)"
            />
            <DialogClose as-child>
              <Action id="drawer-close" icon="close" label="Close" title="Close the editor (Esc)" />
            </DialogClose>
          </div>
        </div>
        <div id="cd-drawer-body" class="cd-drawer-body">
          <Editor
            v-if="editorMounted"
            :session="session"
            :tokens="view.tokens"
            :theme="theme"
            @load="loadDialog.open()"
            @save="save"
            @export="exportKit"
          />
        </div>
      </DialogContent>
    </div>
  </DialogRoot>
</template>
