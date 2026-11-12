import { HOSTED_URL } from './config.js';
import { vendorKey } from './lib/vendor-key.js';
import { createStore, idbFileStore } from './lib/state.js';
import { generateCss } from './lib/css.js';
import { render, urlFor } from './ui/render.js';

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

function draw() {
  const doc = store.get();
  const css = generateCss(doc, { vendor, fontSrc: (f) => urlFor(f, ctx) ?? f.src });
  render({ doc, css, theme, session: store.files, library, vendor });
  setTypographyLabels();
  updateNavigation();
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

applyTheme();
store.subscribe(draw);
draw();

export { store, ctx, vendor, library, manifest, draw };
