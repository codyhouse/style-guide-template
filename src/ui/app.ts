// <sg-app>: the page. Header (logo, section links, actions), the guide, and the editor drawer.
// Owns what is about the page rather than the brand: theme, the drawer, drag and drop, shortcuts.
import { html, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import type { Session } from '../app/session.js';
import { generateCss } from '../lib/css.js';
import { resolve } from '../lib/resolver.js';
import type { BrandMeta, FontFile, Tokens } from '../lib/types.js';
import { download, icon, type IconName } from './dom.js';
import './editor/editor.js';
import { sectionsOf } from './guide/guide.js';
import './guide/guide.js';
import { LightElement } from './light-element.js';
import { urlFor } from './urls.js';

const THEME_KEY = 'styleguide:theme';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const wideDrawer = matchMedia('(min-width: 768px)'); // $S: the drawer leaves part of the guide visible
const behavior = (): ScrollBehavior => (reduceMotion.matches ? 'auto' : 'smooth');

interface View {
  tokens: Tokens;
  meta: BrandMeta;
  css: string;
}

@customElement('sg-app')
export class App extends LightElement {
  @property({ attribute: false }) session?: Session;
  @state() private theme =
    localStorage.getItem(THEME_KEY) ??
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  @state() private editing = false;
  /** the editor stays mounted once opened, so its folds and searches survive closing the drawer */
  @state() private editorMounted = false;
  @state() private dragging = false;
  @state() private exporting = false;
  @state() private wide = wideDrawer.matches;

  @query('#cd-nav') private nav?: HTMLElement;
  @query('#cd-load-input') private loadInput?: HTMLInputElement;
  @query('#edit-toggle') private editToggle?: HTMLButtonElement;

  private view?: View;
  private dragDepth = 0;
  private pruneTimer?: ReturnType<typeof setTimeout>;
  private unsubscribe?: () => void;

  override connectedCallback() {
    super.connectedCallback();
    this.unsubscribe = this.session?.subscribe(() => this.requestUpdate());
    addEventListener('keydown', this.onShortcut);
    addEventListener('scroll', this.trackSection, { passive: true });
    addEventListener('dragenter', this.onDragEnter);
    addEventListener('dragleave', this.onDragLeave);
    addEventListener('dragover', this.onDragOver);
    addEventListener('drop', this.onDrop);
    wideDrawer.addEventListener('change', this.onWidth);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
    removeEventListener('keydown', this.onShortcut);
    removeEventListener('scroll', this.trackSection);
    removeEventListener('dragenter', this.onDragEnter);
    removeEventListener('dragleave', this.onDragLeave);
    removeEventListener('dragover', this.onDragOver);
    removeEventListener('drop', this.onDrop);
    wideDrawer.removeEventListener('change', this.onWidth);
  }

  /* the brand as shown: worked out before rendering, so a brand that cannot be shown leaves the page as it was */

  protected override willUpdate() {
    const { session } = this;
    if (!session) return;
    try {
      const doc = session.doc;
      const fontSrc = (f: FontFile) => urlFor(f, session.ctx) ?? f.src;
      this.view = {
        tokens: resolve(doc, { theme: this.theme }),
        meta: session.meta,
        css: generateCss(doc, { vendor: session.vendor, fontSrc }),
      };
    } catch (e) {
      if (session.doc === session.preset) throw e;
      session.fallBack(e);
    }
  }

  protected override updated() {
    const { session, view } = this;
    if (!session || !view) return;
    document.documentElement.dataset.theme = this.theme;
    document.title = `${session.doc.name ?? 'Brand'} | Style Guide`;
    const brandCss = document.getElementById('brand-css');
    if (brandCss) brandCss.textContent = view.css;
    this.classList.toggle('is-editing', this.editing);
    this.classList.toggle('is-dragging', this.dragging);
    this.trackSection();
    this.reportFontErrors();
    clearTimeout(this.pruneTimer);
    this.pruneTimer = setTimeout(() => session.prune(), 2000);
  }

  private reportFontErrors() {
    document.fonts?.ready.then(() => {
      const failed = [...document.fonts].filter((f) => f.status === 'error');
      if (failed.length) {
        this.session?.warn(
          ...failed.map(
            (f) => `Font could not be loaded: ${f.family.replace(/"/g, '')} ${f.weight} ${f.style}`,
          ),
        );
      }
    });
  }

  /* theme and drawer */

  private toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, this.theme);
  }

  private async openDrawer() {
    this.editing = true;
    this.editorMounted = true;
    await this.updateComplete;
    await this.querySelector('sg-editor')?.updateComplete;
    this.querySelector<HTMLElement>('#cd-drawer-body input, #cd-drawer-body button')?.focus();
  }

  private async closeDrawer() {
    this.editing = false;
    await this.updateComplete;
    this.editToggle?.focus();
  }

  private readonly onWidth = () => (this.wide = wideDrawer.matches);

  private onDrawerKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && !(e.target as Element).closest('[role=listbox]')) this.closeDrawer();
  }

  /* undo and redo: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y; text fields keep their own undo */

  private step(redo: boolean) {
    const { store } = this.session ?? {};
    if (redo) store?.redo();
    else store?.undo();
  }

  private readonly onShortcut = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    const redo = (key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey);
    if (key !== 'z' && !redo) return;
    if ((e.target as Element).closest?.('input, textarea, [contenteditable], [role=listbox]')) return;
    e.preventDefault();
    this.step(redo);
  };

  /* load, save, export */

  private onBrandAction(e: CustomEvent<'load' | 'save' | 'export'>) {
    ({ load: () => this.loadInput?.click(), save: () => this.save(), export: () => this.exportKit() })[
      e.detail
    ]();
  }

  private save() {
    const file = this.session?.brandJson();
    if (file) download(file.name, file.data, 'application/json');
  }

  private async exportKit() {
    if (!this.session || this.exporting) return;
    this.exporting = true;
    try {
      const { name, data } = await this.session.brandKit();
      download(name, data, 'application/zip');
    } catch (e) {
      this.session.warn(`Export failed: ${(e as Error).message}`);
    } finally {
      this.exporting = false;
    }
  }

  private onLoadInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this.session?.receive([...(input.files ?? [])]);
    input.value = '';
  }

  /* drag and drop anywhere */

  private static hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');

  private readonly onDragEnter = (e: DragEvent) => {
    if (!App.hasFiles(e)) return;
    this.dragDepth++;
    this.dragging = true;
  };

  private readonly onDragLeave = () => {
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (!this.dragDepth) this.dragging = false;
  };

  private readonly onDragOver = (e: DragEvent) => {
    if (App.hasFiles(e)) e.preventDefault();
  };

  private readonly onDrop = (e: DragEvent) => {
    this.dragDepth = 0;
    this.dragging = false;
    if (!App.hasFiles(e)) return;
    e.preventDefault();
    this.session?.receive([...(e.dataTransfer?.files ?? [])]);
  };

  /* section links */

  private onNavClick(e: MouseEvent) {
    const link = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    const target = link && document.getElementById(decodeURIComponent(link.hash.slice(1)));
    if (!link || !target) return;
    e.preventDefault();
    const header = this.querySelector('header')?.offsetHeight ?? 0;
    const top =
      target.getBoundingClientRect().top + scrollY - header - parseFloat(getComputedStyle(target).marginTop);
    scrollTo({ top, behavior: behavior() });
    history.replaceState(null, '', link.hash);
  }

  // a plain mouse wheel scrolls the strip sideways when it overflows
  private onNavWheel(e: WheelEvent) {
    const nav = e.currentTarget as HTMLElement;
    if (nav.scrollWidth <= nav.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    nav.scrollLeft += e.deltaY;
  }

  /** Marks the link of the section at the top of the window, and keeps it visible in the strip. */
  private readonly trackSection = () => {
    const { nav } = this;
    if (!nav) return;
    const header = this.querySelector('header')?.offsetHeight ?? 0;
    for (const section of this.querySelectorAll<HTMLElement>('main > section')) {
      const margin = parseFloat(getComputedStyle(section).marginTop);
      const top = section.getBoundingClientRect().top + scrollY - margin;
      const inView = top - header <= scrollY && top + section.offsetHeight > scrollY + 1;
      const anchor = nav.querySelector<HTMLElement>(`a[href="#${CSS.escape(section.id)}"]`);
      if (!anchor) continue;
      if (inView && !anchor.classList.contains('selected')) {
        nav.scrollTo({
          left: anchor.offsetLeft - (nav.clientWidth - anchor.offsetWidth) / 2,
          behavior: behavior(),
        });
      }
      anchor.classList.toggle('selected', inView);
      anchor.toggleAttribute('aria-current', inView);
    }
  };

  /* rendering */

  private action(
    id: string,
    iconName: IconName,
    label: string,
    title: string,
    extra: Partial<{ pressed: boolean; busy: boolean; onClick: () => void }> = {},
  ) {
    return html`
      <button
        type="button"
        class="cd-action"
        id=${id}
        title=${title}
        aria-pressed=${extra.pressed === undefined ? nothing : String(extra.pressed)}
        aria-busy=${extra.busy ? 'true' : nothing}
        ?disabled=${extra.busy}
        @click=${extra.onClick}
      >
        ${icon(iconName)}<span>${label}</span>
      </button>
    `;
  }

  private header(view: View) {
    const { session } = this;
    if (!session) return nothing;
    const [logo] = view.meta.assetGroups.find((g) => g.id === 'logos')?.items ?? [];
    const logoUrl = logo && urlFor(logo, session.ctx);
    const name = session.doc.name ?? 'Logo';
    return html`
      <header>
        <div class="cd-logo">
          ${logoUrl ? html`<img src=${logoUrl} alt=${name} />` : html`<span class="cd-sr-only">${name}</span>`}
        </div>
        <nav aria-label="Sections">
          <ul class="cd-main-nav" id="cd-nav" @click=${this.onNavClick} @wheel=${this.onNavWheel}>
            ${sectionsOf(view.meta, view.tokens).map((s) => html`<li><a href="#${s.id}">${s.title}</a></li>`)}
          </ul>
        </nav>
        <div class="cd-actions">
          ${this.action('theme-toggle', 'moon', 'Dark mode', 'Dark mode', { pressed: this.theme === 'dark', onClick: () => this.toggleTheme() })}
          ${this.action('edit-toggle', 'edit', 'Edit', 'Edit the brand', {
            pressed: this.editing,
            onClick: () => (this.editing ? this.closeDrawer() : this.openDrawer()),
          })}
          <div class="cd-actions-more">
            ${this.action('load-btn', 'load', 'Load', 'Load a brand file, ZIP, fonts or assets', { onClick: () => this.loadInput?.click() })}
            ${this.action('save-btn', 'save', 'Save JSON', 'Save the brand file as JSON', { onClick: () => this.save() })}
          </div>
          ${this.action('export-btn', 'export', 'Export ZIP', 'Export the brand kit as a ZIP', { busy: this.exporting, onClick: () => this.exportKit() })}
          <input type="file" id="cd-load-input" multiple hidden @change=${this.onLoadInput} />
        </div>
      </header>
    `;
  }

  private drawer(view: View) {
    const store = this.session?.store;
    return html`
      <aside
        id="cd-drawer"
        class="cd-drawer"
        aria-labelledby="cd-drawer-title"
        ?hidden=${!this.editing}
        @keydown=${this.onDrawerKey}
      >
        <div class="cd-drawer-header">
          <h2 id="cd-drawer-title">Edit brand</h2>
          <div class="cd-drawer-actions">
            <!-- aria-disabled, not disabled: the button keeps focus after the last undo -->
            <button
              type="button"
              class="cd-action"
              id="undo-btn"
              title="Undo (Ctrl+Z)"
              aria-keyshortcuts="Control+Z Meta+Z"
              aria-disabled=${String(!store?.canUndo())}
              @click=${() => this.step(false)}
            >
              ${icon('undo')}<span>Undo</span>
            </button>
            <button
              type="button"
              class="cd-action"
              id="redo-btn"
              title="Redo (Ctrl+Shift+Z)"
              aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
              aria-disabled=${String(!store?.canRedo())}
              @click=${() => this.step(true)}
            >
              ${icon('redo')}<span>Redo</span>
            </button>
            ${this.action('drawer-close', 'close', 'Close', 'Close the editor (Esc)', { onClick: () => this.closeDrawer() })}
          </div>
        </div>
        <div class="cd-drawer-body" id="cd-drawer-body" @brand-action=${this.onBrandAction}>
          ${this.editorMounted ? html`<sg-editor .session=${this.session} .tokens=${view.tokens} theme=${this.theme}></sg-editor>` : nothing}
        </div>
      </aside>
    `;
  }

  protected override render() {
    const { session, view } = this;
    if (!session || !view) return nothing;
    return html`
      ${this.header(view)}
      <sg-guide
        .session=${session}
        .doc=${session.doc}
        .tokens=${view.tokens}
        .meta=${view.meta}
        ?covered=${this.editing && !this.wide}
      ></sg-guide>
      <div class="cd-drop" aria-hidden="true">Drop files to load them</div>
      ${this.drawer(view)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sg-app': App;
  }
}
