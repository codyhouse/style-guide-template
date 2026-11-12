<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { Session } from '../app/session.js';
import { download } from './download.js';
import { urlFor } from './urls.js';
import Action from './Action.vue';
import Icon from './Icon.vue';
import Guide from './guide/Guide.vue';
import Editor from './editor/Editor.vue';
import { sectionsOf } from './guide/sections.js';
import { useSession } from './useSession.js';
import { deriveView } from './view.js';

const { session } = defineProps<{ session: Session }>();
const revision = useSession(session);
const theme = ref(
  localStorage.getItem('styleguide:theme') ??
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
);
const editing = ref(false);
const editorMounted = ref(false);
const dragging = ref(false);
const exporting = ref(false);
const wideQuery = matchMedia('(min-width: 768px)');
const wide = ref(wideQuery.matches);
const nav = ref<HTMLElement>();
const loadInput = ref<HTMLInputElement>();
const drawerBody = ref<HTMLElement>();
const editor = ref<InstanceType<typeof Editor>>();
const view = computed(() => {
  void revision.value;
  return deriveView(session, theme.value);
});
const sections = computed(() => sectionsOf(view.value.meta, view.value.tokens));
const logo = computed(() => view.value.meta.assetGroups.find((g) => g.id === 'logos')?.items[0]);
const logoUrl = computed(() => logo.value && urlFor(logo.value, session.ctx));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const scrollBehavior = (): ScrollBehavior => (reduceMotion.matches ? 'auto' : 'smooth');
let dragDepth = 0;
let pruneTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  [view, theme],
  () => {
    document.documentElement.dataset.theme = theme.value;
    document.title = `${session.doc.name ?? 'Brand'} | Style Guide`;
    const css = document.getElementById('brand-css');
    if (css) css.textContent = view.value.css;
    clearTimeout(pruneTimer);
    pruneTimer = setTimeout(() => session.prune(), 2000);
    document.fonts?.ready.then(() => {
      const failed = [...document.fonts].filter((f) => f.status === 'error');
      if (failed.length)
        session.warn(
          ...failed.map(
            (f) => `Font could not be loaded: ${f.family.replace(/"/g, '')} ${f.weight} ${f.style}`,
          ),
        );
    });
    nextTick(trackSection);
  },
  { immediate: true, flush: 'post' },
);

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  localStorage.setItem('styleguide:theme', theme.value);
}

async function openDrawer() {
  editing.value = true;
  editorMounted.value = true;
  await nextTick();
  await editor.value?.ready();
  drawerBody.value?.querySelector<HTMLElement>('input, button')?.focus();
}

async function closeDrawer() {
  editing.value = false;
  await nextTick();
  document.getElementById('edit-toggle')?.focus();
}

function onDrawerKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && !(e.target as Element).closest('[role=listbox]')) void closeDrawer();
}

function step(redo: boolean) {
  if (redo) session.store.redo();
  else session.store.undo();
}

function onShortcut(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const key = e.key.toLowerCase();
  const redo = (key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey);
  if (key !== 'z' && !redo) return;
  if ((e.target as Element).closest?.('input, textarea, [contenteditable], [role=listbox]')) return;
  e.preventDefault();
  step(redo);
}

function save() {
  const file = session.brandJson();
  download(file.name, file.data, 'application/json');
}

async function exportKit() {
  if (exporting.value) return;
  exporting.value = true;
  try {
    const { name, data } = await session.brandKit();
    download(name, data, 'application/zip');
  } catch (e) {
    session.warn(`Export failed: ${(e as Error).message}`);
  } finally {
    exporting.value = false;
  }
}

function onLoadInput(e: Event) {
  const input = e.target as HTMLInputElement;
  void session.receive([...(input.files ?? [])]);
  input.value = '';
}

const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');
function onDragEnter(e: DragEvent) {
  if (!hasFiles(e)) return;
  dragDepth++;
  dragging.value = true;
}
function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dragging.value = false;
}
function onDragOver(e: DragEvent) {
  if (hasFiles(e)) e.preventDefault();
}
function onDrop(e: DragEvent) {
  dragDepth = 0;
  dragging.value = false;
  if (!hasFiles(e)) return;
  e.preventDefault();
  void session.receive([...(e.dataTransfer?.files ?? [])]);
}

function onNavClick(e: MouseEvent) {
  const link = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
  const target = link && document.getElementById(decodeURIComponent(link.hash.slice(1)));
  if (!link || !target) return;
  e.preventDefault();
  const header = document.querySelector('header')?.offsetHeight ?? 0;
  const top =
    target.getBoundingClientRect().top + scrollY - header - parseFloat(getComputedStyle(target).marginTop);
  scrollTo({ top, behavior: scrollBehavior() });
  history.replaceState(null, '', link.hash);
}
function onNavWheel(e: WheelEvent) {
  const strip = e.currentTarget as HTMLElement;
  if (strip.scrollWidth <= strip.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  e.preventDefault();
  strip.scrollLeft += e.deltaY;
}
function trackSection() {
  if (!nav.value) return;
  const header = document.querySelector('header')?.offsetHeight ?? 0;
  for (const section of document.querySelectorAll<HTMLElement>('main > section')) {
    const margin = parseFloat(getComputedStyle(section).marginTop);
    const top = section.getBoundingClientRect().top + scrollY - margin;
    const inView = top - header <= scrollY && top + section.offsetHeight > scrollY + 1;
    const anchor = nav.value.querySelector<HTMLElement>(`a[href="#${CSS.escape(section.id)}"]`);
    if (!anchor) continue;
    if (inView && !anchor.classList.contains('selected')) {
      nav.value.scrollTo({
        left: anchor.offsetLeft - (nav.value.clientWidth - anchor.offsetWidth) / 2,
        behavior: scrollBehavior(),
      });
    }
    anchor.classList.toggle('selected', inView);
    if (inView) anchor.setAttribute('aria-current', 'true');
    else anchor.removeAttribute('aria-current');
  }
}
function onWidth() {
  wide.value = wideQuery.matches;
}
onMounted(() => {
  addEventListener('keydown', onShortcut);
  addEventListener('scroll', trackSection, { passive: true });
  addEventListener('dragenter', onDragEnter);
  addEventListener('dragleave', onDragLeave);
  addEventListener('dragover', onDragOver);
  addEventListener('drop', onDrop);
  wideQuery.addEventListener('change', onWidth);
  trackSection();
});
onUnmounted(() => {
  removeEventListener('keydown', onShortcut);
  removeEventListener('scroll', trackSection);
  removeEventListener('dragenter', onDragEnter);
  removeEventListener('dragleave', onDragLeave);
  removeEventListener('dragover', onDragOver);
  removeEventListener('drop', onDrop);
  wideQuery.removeEventListener('change', onWidth);
  clearTimeout(pruneTimer);
});
</script>

<template>
  <div :class="{ 'is-editing': editing, 'is-dragging': dragging }">
    <header>
      <div class="cd-logo">
        <img v-if="logoUrl" :src="logoUrl" :alt="session.doc.name ?? 'Logo'" />
        <span v-else class="cd-sr-only">{{ session.doc.name ?? 'Logo' }}</span>
      </div>
      <nav aria-label="Sections">
        <ul id="cd-nav" ref="nav" class="cd-main-nav" @click="onNavClick" @wheel="onNavWheel">
          <li v-for="section in sections" :key="section.id">
            <a :href="`#${section.id}`">{{ section.title }}</a>
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
        <Action
          id="edit-toggle"
          icon="edit"
          label="Edit"
          title="Edit the brand"
          :pressed="editing"
          @click="editing ? closeDrawer() : openDrawer()"
        />
        <div class="cd-actions-more">
          <Action
            id="load-btn"
            icon="load"
            label="Load"
            title="Load a brand file, ZIP, fonts or assets"
            @click="loadInput?.click()"
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
        <input id="cd-load-input" ref="loadInput" type="file" multiple hidden @change="onLoadInput" />
      </div>
    </header>
    <Guide
      :session="session"
      :doc="session.doc"
      :tokens="view.tokens"
      :meta="view.meta"
      :covered="editing && !wide"
    />
    <div class="cd-drop" aria-hidden="true">Drop files to load them</div>
    <aside
      id="cd-drawer"
      class="cd-drawer"
      aria-labelledby="cd-drawer-title"
      :hidden="!editing"
      @keydown="onDrawerKey"
    >
      <div class="cd-drawer-header">
        <h2 id="cd-drawer-title">Edit brand</h2>
        <div class="cd-drawer-actions">
          <button
            id="undo-btn"
            type="button"
            class="cd-action"
            title="Undo (Ctrl+Z)"
            aria-keyshortcuts="Control+Z Meta+Z"
            :aria-disabled="!session.store.canUndo()"
            @click="step(false)"
          >
            <Icon name="undo" /><span>Undo</span>
          </button>
          <button
            id="redo-btn"
            type="button"
            class="cd-action"
            title="Redo (Ctrl+Shift+Z)"
            aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
            :aria-disabled="!session.store.canRedo()"
            @click="step(true)"
          >
            <Icon name="redo" /><span>Redo</span>
          </button>
          <Action
            id="drawer-close"
            icon="close"
            label="Close"
            title="Close the editor (Esc)"
            @click="closeDrawer"
          />
        </div>
      </div>
      <div id="cd-drawer-body" ref="drawerBody" class="cd-drawer-body">
        <Editor
          v-if="editorMounted"
          ref="editor"
          :session="session"
          :tokens="view.tokens"
          :theme="theme"
          @load="loadInput?.click()"
          @save="save"
          @export="exportKit"
        />
      </div>
    </aside>
  </div>
</template>
