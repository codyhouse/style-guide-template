import { HOSTED_URL } from './config.js';
import { vendorKey } from './lib/vendor-key.js';
import { createStore, idbFileStore } from './lib/state.js';
import { generateCss } from './lib/css.js';
import { checkContrast } from './lib/contrast.js';
import { brandMeta, withBrandMeta, missingAssets, matchDropped, allSrcs } from './lib/assets.js';
import { classify, parseBrandJson, loadZip, saveJson, slug, buildExport } from './lib/io.js';
import * as E from './lib/edit.js';
import { render, urlFor } from './ui/render.js';
import { renderPanels } from './ui/panels.js';
import { renderEditor } from './ui/editor.js';
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

const warn = (...messages) => {
  warnings = [...new Set([...warnings, ...messages])];
  drawPanels();
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

function loadBrand(doc, files) {
  store.load(withBrandMeta(doc, vendor, brandMeta(doc, vendor)), files);
  pending = [];
  ambiguous = [];
}

async function fillMissing(files) {
  const { matched, ambiguous: amb, unmatched } = matchDropped(missingAssets(brandMeta(store.get(), vendor), ctx), files);
  if (matched.size) await persist(matched);
  ambiguous = [...ambiguous, ...amb.map(({ name, candidates }) => ({ file: files.find((f) => f.name === name), candidates }))];
  return unmatched;
}

async function routeFiles(files) {
  const brandFiles = files.filter((f) => ['resolver', 'tokens', 'zip'].includes(classify(f.name)));
  const [brand] = brandFiles;
  if (brandFiles.length > 1) warn(`Loaded ${brand.name}; drop one brand file at a time (${brandFiles.length - 1} ignored).`);
  if (brand) {
    if (classify(brand.name) === 'zip') {
      const { doc, files: zipped, errors } = loadZip(new Uint8Array(await brand.arrayBuffer()));
      if (errors.length) warn(...errors.map((e) => `${brand.name}: ${e.path ? `${e.path}: ` : ''}${e.message}`));
      else loadBrand(doc, zipped);
    } else {
      const { doc, errors } = parseBrandJson(await brand.text(), brand.name);
      if (errors.length) warn(...errors.map((e) => `${brand.name}: ${e.path ? `${e.path}: ` : ''}${e.message}`));
      else loadBrand(doc);
    }
  }
  const rest = files.filter((f) => !brandFiles.includes(f));
  const fonts = rest.filter((f) => classify(f.name) === 'font');
  const others = rest.filter((f) => !fonts.includes(f));
  if (fonts.length) await addFontUploads(fonts);
  if (others.length) pending = [...pending, ...(await fillMissing(others))];
  drawPanels();
}

/*******************
	drawing
********************/
const panelHandlers = {
  onMissingFiles: async (files) => { pending = [...pending, ...(await fillMissing(files))]; drawPanels(); },
  onAssign: async (file, path) => {
    ambiguous = ambiguous.filter((a) => a.file !== file);
    await persist(new Map([[path, file]]));
  },
  onAddPending: async (groupId) => {
    let id = groupId;
    if (id === '__new') {
      const before = new Set(brandMeta(store.get(), vendor).assetGroups.map((g) => g.id));
      setMeta((m) => E.addGroup(m, 'Uploads'));
      id = brandMeta(store.get(), vendor).assetGroups.find((g) => !before.has(g.id)).id;
    }
    const files = pending;
    pending = [];
    await addUploads(files, id);
  },
  onDiscardPending: () => { pending = []; drawPanels(); },
  onDismissWarnings: () => { warnings = []; drawPanels(); },
};

function drawPanels() {
  const doc = store.get();
  const meta = brandMeta(doc, vendor);
  renderPanels(document.getElementById('cd-panels'), {
    contrast: checkContrast(doc),
    missing: missingAssets(meta, ctx),
    ambiguous,
    pending,
    groups: meta.assetGroups,
    warnings: store.saveError ? [...warnings, 'Your edits could not be saved in this browser. Save JSON to keep them.'] : warnings,
    handlers: panelHandlers,
  });
}

function checkFonts() {
  document.fonts?.ready.then(() => {
    const failed = [...document.fonts].filter((f) => f.status === 'error');
    if (failed.length) warn(...failed.map((f) => `Font could not be loaded: ${f.family.replace(/"/g, '')} ${f.weight} ${f.style}`));
  });
}

function draw() {
  const doc = store.get();
  const css = generateCss(doc, { vendor, fontSrc: (f) => urlFor(f, ctx) ?? f.src });
  render({ doc, css, theme, session: store.files, library, vendor });
  drawPanels();
  setTypographyLabels();
  updateNavigation();
  checkFonts();
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
  if (!drawer.hidden) renderEditor(drawerBody, app);
});

/*******************
	typography
********************/
const heading = document.querySelector('#typography > .cd-box h1');
const body = heading.nextElementSibling;

function setTypography(element) {
  const s = getComputedStyle(element);
  const family = s.fontFamily.split(',')[0].replace(/['"]/g, '');
  element.querySelector('span').textContent = `${s.fontWeight} ${family} ${Math.round(parseFloat(s.fontSize))}px`;
}
function setTypographyLabels() {
  setTypography(heading);
  setTypography(body);
}
addEventListener('resize', setTypographyLabels);
document.fonts?.addEventListener('loadingdone', setTypographyLabels);

/*******************
	main navigation
********************/
const header = document.querySelector('header');
const trigger = document.querySelector('.cd-nav-trigger');
const nav = document.getElementById('cd-nav');

// open navigation on mobile
trigger.addEventListener('click', () => {
  const open = header.classList.toggle('nav-is-visible');
  trigger.setAttribute('aria-expanded', String(open));
});

// smooth scroll to the selected section
nav.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  event.preventDefault();
  header.classList.remove('nav-is-visible');
  trigger.setAttribute('aria-expanded', 'false');
  const target = document.querySelector(link.hash);
  const topMargin = parseFloat(getComputedStyle(target).marginTop);
  scrollTo({ top: target.getBoundingClientRect().top + scrollY - header.offsetHeight - topMargin, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  history.replaceState(null, '', link.hash);
});

// update selected navigation element
function updateNavigation() {
  for (const section of document.querySelectorAll('main > section')) {
    const top = section.getBoundingClientRect().top + scrollY;
    const topMargin = parseFloat(getComputedStyle(section).marginTop);
    const anchor = nav.querySelector(`a[href="#${section.id}"]`);
    const inView = top - header.offsetHeight - topMargin <= scrollY && top + section.offsetHeight - topMargin > scrollY + 1;
    anchor?.classList.toggle('selected', inView);
    if (inView) anchor?.setAttribute('aria-current', 'true');
    else anchor?.removeAttribute('aria-current');
  }
}
addEventListener('scroll', updateNavigation, { passive: true });

/*******************
	editor drawer
********************/
const drawer = document.getElementById('cd-drawer');
const drawerBody = document.getElementById('cd-drawer-body');
const editToggle = document.getElementById('edit-toggle');
const app = {
  store, vendor, library, manifest, theme: () => theme, addUploads, addFontUploads, warn,
  urlFor: (item) => urlFor(item, ctx),
  load: () => document.getElementById('load-btn').click(),
  save: () => document.getElementById('save-btn').click(),
  export: () => document.getElementById('export-btn').click(),
};

function openDrawer() {
  renderEditor(drawerBody, app);
  drawer.hidden = false;
  editToggle.setAttribute('aria-pressed', 'true');
  drawer.querySelector('input, button')?.focus();
}
function closeDrawer() {
  drawer.hidden = true;
  editToggle.setAttribute('aria-pressed', 'false');
  editToggle.focus();
}
editToggle.addEventListener('click', () => (drawer.hidden ? openDrawer() : closeDrawer()));
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
