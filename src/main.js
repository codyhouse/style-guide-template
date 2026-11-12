import { render } from 'lit-html';
import { HOSTED_URL } from './config.js';
import { vendorKey } from './lib/vendor-key.js';
import { createStore, idbFileStore } from './lib/state.js';
import { generateCss } from './lib/css.js';
import { resolve } from './lib/resolver.js';
import { checkContrast } from './lib/contrast.js';
import { brandMeta, withBrandMeta, missingAssets, matchDropped, allSrcs, adoptVendor } from './lib/assets.js';
import { classify, parseBrandJson, loadZip, saveJson, slug, buildExport } from './lib/io.js';
import * as E from './lib/edit.js';
import { sections, guideView, navView, logoView, urlFor } from './ui/render.js';
import { editorView } from './ui/editor.js';
import { download } from './ui/dom.js';

const vendor = vendorKey(HOSTED_URL);
const THEME_KEY = 'styleguide:theme';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const manifest = await fetch('library/manifest.json').then((r) => r.json());
const library = new Set(manifest.files);
const preset = await fetch(`library/${manifest.brands[0].path}`).then((r) => r.json());
const store = createStore({ doc: preset, storage: localStorage, fileStore: idbFileStore() });
await store.ready;

const ctx = { session: store.files, library };
let theme = localStorage.getItem(THEME_KEY) ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
let warnings = [];
let pending = [];
let ambiguous = [];

const addWarnings = (messages) => { warnings = [...new Set([...warnings, ...messages])]; };
const warn = (...messages) => {
  addWarnings(messages);
  draw();
};

/*******************
	files coming in
********************/
const takenPaths = () => new Set([...store.files.keys(), ...allSrcs(brandMeta(store.get(), vendor)).map((s) => s.src)]);
const stem = (name) => name.replace(/\.[^.]+$/, '');
const setMeta = (fn) => store.set(withBrandMeta(store.get(), vendor, fn(brandMeta(store.get(), vendor))));

async function persist(map) {
  const { notPersisted } = await store.addFiles(map);
  if (notPersisted.length) warn(...notPersisted.map((p) => `Not saved in this browser (storage full): ${p}. It is still in this session and in exports.`));
}

async function addUploads(files, groupId) {
  const taken = takenPaths();
  const map = new Map();
  const items = files.map((file) => {
    const src = E.uniquePath(`${groupId}/${file.name}`, taken);
    taken.add(src);
    map.set(src, file);
    return { label: stem(file.name), src };
  });
  await persist(map);
  setMeta((m) => E.addItems(m, groupId, items));
}

async function addFontUploads(files) {
  const taken = takenPaths();
  const map = new Map();
  const entries = files.map((file) => {
    const src = E.uniquePath(`fonts/${file.name}`, taken);
    taken.add(src);
    map.set(src, file);
    return { ...E.fontFromFileName(file.name), src };
  });
  await persist(map);
  setMeta((m) => E.addFontFiles(m, entries));
}

async function loadBrand(doc, files) {
  const own = adoptVendor(doc, vendor);
  store.load(withBrandMeta(own, vendor, brandMeta(own, vendor)));
  pending = [];
  ambiguous = [];
  if (files?.size) await persist(files);
}

async function fillMissing(files) {
  const { matched, ambiguous: amb, unmatched } = matchDropped(missingAssets(brandMeta(store.get(), vendor), ctx), files);
  if (matched.size) await persist(matched);
  ambiguous = [...ambiguous, ...amb.map(({ name, candidates }) => ({ file: files.find((f) => f.name === name), candidates }))];
  return unmatched;
}

async function routeFiles(files) {
  try {
    await routeFilesUnsafe(files);
  } catch (e) {
    warn(`Could not load ${files.map((f) => f.name).join(', ')}: ${e.message}`);
  }
}

async function routeFilesUnsafe(files) {
  const brandFiles = files.filter((f) => ['resolver', 'tokens', 'zip'].includes(classify(f.name)));
  const [brand] = brandFiles;
  if (brandFiles.length > 1) warn(`Loaded ${brand.name}; drop one brand file at a time (${brandFiles.length - 1} ignored).`);
  if (brand) {
    if (classify(brand.name) === 'zip') {
      const { doc, files: zipped, errors } = loadZip(new Uint8Array(await brand.arrayBuffer()));
      if (errors.length) warn(...errors.map((e) => `${brand.name}: ${e.path ? `${e.path}: ` : ''}${e.message}`));
      else await loadBrand(doc, zipped);
    } else {
      const { doc, errors } = parseBrandJson(await brand.text(), brand.name);
      if (errors.length) warn(...errors.map((e) => `${brand.name}: ${e.path ? `${e.path}: ` : ''}${e.message}`));
      else await loadBrand(doc);
    }
  }
  const rest = files.filter((f) => !brandFiles.includes(f));
  const fonts = rest.filter((f) => classify(f.name) === 'font');
  const others = rest.filter((f) => !fonts.includes(f));
  if (fonts.length) await addFontUploads(fonts);
  if (others.length) pending = [...pending, ...(await fillMissing(others))];
  draw();
}

/*******************
	drawing
********************/
const panelHandlers = {
  refresh: () => draw(),
  onMissingFiles: async (files) => { pending = [...pending, ...(await fillMissing(files))]; draw(); },
  onAssign: async (file, path) => {
    ambiguous = ambiguous.filter((a) => a.file !== file);
    await persist(new Map([[path, file]]));
  },
  onAddPending: async (groupId) => {
    let id = groupId;
    if (!id) {
      const before = new Set(brandMeta(store.get(), vendor).assetGroups.map((g) => g.id));
      setMeta((m) => E.addGroup(m, 'Uploads'));
      id = brandMeta(store.get(), vendor).assetGroups.find((g) => !before.has(g.id)).id;
    }
    const files = pending;
    pending = [];
    await addUploads(files, id);
  },
  onDiscardPending: () => { pending = []; draw(); },
  onDismissWarnings: () => { warnings = []; draw(); },
};

function checkFonts() {
  document.fonts?.ready.then(() => {
    const failed = [...document.fonts].filter((f) => f.status === 'error');
    if (failed.length) warn(...failed.map((f) => `Font could not be loaded: ${f.family.replace(/"/g, '')} ${f.weight} ${f.style}`));
  });
}

let pruneTimer;
// Every template is built before anything is rendered, so a brand that cannot be shown leaves the page as it was.
function paint(doc) {
  const meta = brandMeta(doc, vendor);
  const tokens = resolve(doc, { theme });
  const css = generateCss(doc, { vendor, fontSrc: (f) => urlFor(f, ctx) ?? f.src });
  const list = sections({ doc, tokens, meta, ctx, vendor, refresh: draw });
  const guide = guideView({ doc, list, panels: {
    contrast: checkContrast(doc),
    missing: missingAssets(meta, ctx),
    ambiguous,
    pending,
    groups: meta.assetGroups,
    warnings: store.saveError ? [...warnings, 'Your edits could not be saved in this browser. Save JSON to keep them.'] : warnings,
    handlers: panelHandlers,
  } });
  const editor = drawer.hidden ? null : editorView(app);
  document.getElementById('brand-css').textContent = css;
  document.title = `${doc.name ?? 'Brand'} | Style Guide`;
  render(logoView(doc, meta, ctx), document.getElementById('cd-logo'));
  render(guide, main);
  render(navView(list), nav);
  if (editor) render(editor, drawerBody);
}

function draw() {
  const doc = store.get();
  try {
    paint(doc);
  } catch (e) {
    // A draft that cannot be shown must never lock the page: fall back, keep the draft as the previous one.
    if (doc === preset) throw e;
    addWarnings([`This brand could not be shown (${e.message}). Showing the default brand; your draft is under Edit > Restore previous draft.`]);
    store.load(preset, undefined, { record: false });
    return;
  }
  // aria-disabled, not disabled: the button keeps focus after the last undo
  undoBtn.setAttribute('aria-disabled', String(!store.canUndo()));
  redoBtn.setAttribute('aria-disabled', String(!store.canRedo()));
  setTypographyLabels();
  updateNavigation();
  checkFonts();
  clearTimeout(pruneTimer);
  pruneTimer = setTimeout(() => store.prune(new Set(store.drafts().flatMap((d) => allSrcs(brandMeta(d, vendor)).map((x) => x.src)))), 2000);
}

/*******************
	theme
********************/
const themeToggle = document.getElementById('theme-toggle');
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
}
themeToggle.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
  draw();
});

/*******************
	typography
********************/
function setTypography(element) {
  const s = getComputedStyle(element);
  const family = s.fontFamily.split(',')[0].replace(/['"]/g, '');
  element.querySelector('.cd-specimen-label').textContent = `${s.fontWeight} ${family} ${Math.round(parseFloat(s.fontSize))}px`;
}
function setTypographyLabels() {
  const heading = document.querySelector('#typography > .cd-box h1');
  if (!heading) return;
  setTypography(heading);
  setTypography(heading.nextElementSibling);
}
addEventListener('resize', setTypographyLabels);
document.fonts?.addEventListener('loadingdone', setTypographyLabels);

/*******************
	main navigation
********************/
const header = document.querySelector('header');
const nav = document.getElementById('cd-nav');

// smooth scroll to the selected section
nav.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  event.preventDefault();
  const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
  if (!target) return;
  const topMargin = parseFloat(getComputedStyle(target).marginTop);
  scrollTo({ top: target.getBoundingClientRect().top + scrollY - header.offsetHeight - topMargin, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  history.replaceState(null, '', link.hash);
});

// update selected navigation element
function updateNavigation() {
  for (const section of document.querySelectorAll('main > section')) {
    const top = section.getBoundingClientRect().top + scrollY;
    const topMargin = parseFloat(getComputedStyle(section).marginTop);
    const anchor = nav.querySelector(`a[href="#${CSS.escape(section.id)}"]`);
    const inView = top - header.offsetHeight - topMargin <= scrollY && top + section.offsetHeight - topMargin > scrollY + 1;
    if (inView && anchor && !anchor.classList.contains('selected')) {
      nav.scrollTo({ left: anchor.offsetLeft - (nav.clientWidth - anchor.offsetWidth) / 2, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }
    anchor?.classList.toggle('selected', inView);
    if (inView) anchor?.setAttribute('aria-current', 'true');
    else anchor?.removeAttribute('aria-current');
  }
}
addEventListener('scroll', updateNavigation, { passive: true });
nav.addEventListener('wheel', (e) => {
  if (nav.scrollWidth <= nav.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  e.preventDefault();
  nav.scrollLeft += e.deltaY;
}, { passive: false });

/*******************
	editor drawer
********************/
const drawer = document.getElementById('cd-drawer');
const drawerBody = document.getElementById('cd-drawer-body');
const editToggle = document.getElementById('edit-toggle');
const main = document.querySelector('main');
const wideDrawer = matchMedia('(min-width: 768px)'); // $S
wideDrawer.addEventListener('change', () => { if (!drawer.hidden) main.inert = !wideDrawer.matches; });
const app = {
  store, vendor, library, manifest, theme: () => theme, addUploads, addFontUploads, warn, refresh: () => draw(),
  urlFor: (item) => urlFor(item, ctx),
  load: () => document.getElementById('load-btn').click(),
  save: () => document.getElementById('save-btn').click(),
  export: () => document.getElementById('export-btn').click(),
};

function openDrawer() {
  drawer.hidden = false;
  draw();
  document.body.classList.add('is-editing');
  main.inert = !wideDrawer.matches; // on phones the drawer covers the guide
  editToggle.setAttribute('aria-pressed', 'true');
  drawerBody.querySelector('input, button')?.focus();
}
function closeDrawer() {
  drawer.hidden = true;
  document.body.classList.remove('is-editing');
  main.inert = false;
  editToggle.setAttribute('aria-pressed', 'false');
  editToggle.focus();
}
editToggle.addEventListener('click', () => (drawer.hidden ? openDrawer() : closeDrawer()));

/*******************
	undo and redo
********************/
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const step = (redo) => (redo ? store.redo() : store.undo());
undoBtn.addEventListener('click', () => step(false));
redoBtn.addEventListener('click', () => step(true));
addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const key = e.key.toLowerCase();
  const redo = (key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey);
  if (key !== 'z' && !redo) return;
  // text fields keep their own undo
  if (e.target.closest?.('input, textarea, [contenteditable], [role=listbox]')) return;
  e.preventDefault();
  step(redo);
});
document.getElementById('drawer-close').addEventListener('click', closeDrawer);
drawer.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !e.target.closest('[role=listbox]')) closeDrawer();
});

/*******************
	load, save, export
********************/
const loadInput = document.getElementById('load-input');
document.getElementById('load-btn').addEventListener('click', () => loadInput.click());
loadInput.addEventListener('change', () => { routeFiles([...loadInput.files]); loadInput.value = ''; });

document.getElementById('save-btn').addEventListener('click', () => {
  const doc = store.get();
  download(`${slug(doc.name ?? 'brand')}.resolver.json`, saveJson(doc), 'application/json');
});

const exportBtn = document.getElementById('export-btn');
exportBtn.addEventListener('click', async () => {
  exportBtn.setAttribute('aria-busy', 'true');
  exportBtn.disabled = true;
  try {
    const doc = store.get();
    const fetchBytes = async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    };
    const { zip, warnings: w } = await buildExport(doc, { vendor, files: store.files, library, fetchBytes, hostedUrl: HOSTED_URL });
    download(`${slug(doc.name ?? 'brand')}-brand-kit.zip`, zip, 'application/zip');
    if (w.length) warn(...w.map((x) => `Export: ${x}`));
  } catch (e) {
    warn(`Export failed: ${e.message}`);
  } finally {
    exportBtn.removeAttribute('aria-busy');
    exportBtn.disabled = false;
  }
});

/*******************
	drag and drop anywhere
********************/
let dragDepth = 0;
const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');
addEventListener('dragenter', (e) => {
  if (!hasFiles(e)) return;
  dragDepth++;
  document.body.classList.add('is-dragging');
});
addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) document.body.classList.remove('is-dragging');
});
addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
addEventListener('drop', (e) => {
  dragDepth = 0;
  document.body.classList.remove('is-dragging');
  if (!hasFiles(e)) return;
  e.preventDefault();
  routeFiles([...e.dataTransfer.files]);
});

applyTheme();
store.subscribe(draw);
draw();
