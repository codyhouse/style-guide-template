// <sg-guide>: the page's <main>: the brand's name, the panels, and one section per part of the brand.
import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type { Session } from '../../app/session.js';
import { checkContrast } from '../../lib/contrast.js';
import { cssValue, cssName } from '../../lib/css.js';
import { fileName } from '../../lib/path.js';
import type { AssetContext, BrandMeta, ResolverDoc, Tokens } from '../../lib/types.js';
import { missingAssets } from '../../lib/assets.js';
import { LightElement } from '../light-element.js';
import './code.js';
import './colors.js';
import './panels.js';
import { fileCard, image } from './parts.js';
import './scale.js';
import './typography.js';

const BUILT_IN_GROUPS = new Set(['logos', 'favicons', 'icons']);
const SHOWN = ['color.', 'spacing.', 'radius.', 'shadow.', 'font-size.', 'typography.', 'font.'];

export interface Section {
  id: string;
  title: string;
  cls?: string;
}

/** The guide's sections in page order; the nav lists the same ones. */
export function sectionsOf(meta: BrandMeta, tokens: Tokens): Section[] {
  const groups = meta.assetGroups
    .filter((g) => !BUILT_IN_GROUPS.has(g.id))
    .map((g) => ({ id: `group-${g.id}`, title: g.label ?? g.id, cls: 'cd-group' }));
  const other = [...tokens.keys()].some((p) => !SHOWN.some((x) => p.startsWith(x)));
  return [
    { id: 'branding', title: 'Branding', cls: 'cd-branding' },
    { id: 'colors', title: 'Colors', cls: 'cd-colors' },
    { id: 'typography', title: 'Typography', cls: 'cd-typography' },
    { id: 'icons', title: 'Icons', cls: 'cd-icons' },
    ...groups,
    { id: 'spacing', title: 'Spacing', cls: 'cd-spacing' },
    { id: 'radius', title: 'Radius', cls: 'cd-radius' },
    { id: 'shadow', title: 'Shadow', cls: 'cd-shadow' },
    ...(other ? [{ id: 'other-tokens', title: 'Other tokens' }] : []),
    { id: 'css-variables', title: 'Code', cls: 'cd-css-variables' },
  ];
}

// The specimen's labels ("300 Open Sans 31px") are measured after rendering; their spans have no binding.
const specimen = html`
  <div class="cd-box">
    <h1 role="none">Heading, <span class="cd-specimen-label"></span></h1>
    <p>
      Aa - <span class="cd-specimen-label"></span>. Lorem ipsum dolor sit amet, consectetur adipisicing elit.
      Omnis voluptate distinctio reprehenderit, autem deleniti ad <a href="#0">voluptatum eaque</a>. Optio ea
      aperiam nisi distinctio nemo repellat, voluptate fugiat. Quidem neque illum, blanditiis!
    </p>
  </div>
`;

const group = (meta: BrandMeta, id: string) => meta.assetGroups.find((g) => g.id === id)?.items ?? [];

@customElement('sg-guide')
export class Guide extends LightElement {
  @property({ attribute: false }) session?: Session;
  @property({ attribute: false }) doc?: ResolverDoc;
  @property({ attribute: false }) tokens: Tokens = new Map();
  @property({ attribute: false }) meta?: BrandMeta;
  /** the editor covers the guide on phones */
  @property({ type: Boolean }) covered = false;

  override connectedCallback() {
    super.connectedCallback();
    addEventListener('resize', this.measureSpecimen);
    document.fonts?.addEventListener('loadingdone', this.measureSpecimen);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    removeEventListener('resize', this.measureSpecimen);
    document.fonts?.removeEventListener('loadingdone', this.measureSpecimen);
  }

  protected override updated() {
    this.measureSpecimen();
  }

  private readonly measureSpecimen = () => {
    const heading = this.querySelector<HTMLElement>('#typography > .cd-box h1');
    for (const el of [heading, heading?.nextElementSibling]) {
      const label = el?.querySelector('.cd-specimen-label');
      if (!el || !label) continue;
      const s = getComputedStyle(el);
      label.textContent = `${s.fontWeight} ${s.fontFamily.split(',')[0].replace(/['"]/g, '')} ${Math.round(parseFloat(s.fontSize))}px`;
    }
  };

  private body(id: string, meta: BrandMeta, ctx: AssetContext): TemplateResult {
    const { doc, tokens, session } = this;
    switch (id) {
      case 'branding':
        return html`
          <ul class="cd-logos">
            ${group(meta, 'logos').map((l) => html`<li class="cd-box">${image(l, ctx)}</li>`)}
          </ul>
          <ul class="cd-favicons">
            ${group(meta, 'favicons').map((f) => html`<li>${image(f, ctx)}</li>`)}
          </ul>
        `;
      case 'colors':
        return html`<sg-colors .tokens=${tokens} vendor=${session?.vendor ?? ''}></sg-colors>`;
      case 'typography':
        return html`<sg-typography .tokens=${tokens} .meta=${meta}></sg-typography>`;
      case 'icons':
        return html`
          <ul class="cd-box">
            ${group(meta, 'icons').map(
              (i) =>
                html`<li>
                  <figure>
                    ${image(i, ctx, '')}
                    <figcaption>${i.label ?? fileName(i.src)}</figcaption>
                  </figure>
                </li>`,
            )}
          </ul>
        `;
      case 'spacing':
      case 'radius':
      case 'shadow':
        return html`<sg-scale .tokens=${tokens} kind=${id}></sg-scale>`;
      case 'other-tokens':
        return this.otherTokens();
      case 'css-variables':
        return html`<sg-code .doc=${doc} vendor=${session?.vendor ?? ''}></sg-code>`;
      default: {
        const items = meta.assetGroups.find((g) => `group-${g.id}` === id)?.items ?? [];
        return items.length
          ? html`<div class="cd-files">${items.map((i) => fileCard(i, ctx))}</div>`
          : html`<p>No files in this group yet.</p>`;
      }
    }
  }

  private otherTokens() {
    const rest = [...this.tokens].filter(([p]) => !SHOWN.some((x) => p.startsWith(x)));
    return html`
      <div class="cd-box">
        <table class="cd-roles">
          <thead>
            <tr>
              <th>Token</th>
              <th>Type</th>
              <th>CSS value</th>
            </tr>
          </thead>
          <tbody>
            ${rest.map(
              ([p, t]) => html`
                <tr>
                  <td><code>${cssName(p)}</code></td>
                  <td>${t.type}</td>
                  <td><code>${cssValue(t.type, t.value) ?? ''}</code></td>
                </tr>
              `,
            )}
          </tbody>
        </table>
      </div>
    `;
  }

  protected override render() {
    const { doc, meta, session } = this;
    if (!doc || !meta || !session) return nothing;
    return html`
      <main ?inert=${this.covered}>
        <h1>${doc.name ?? 'Style Guide'}</h1>
        <div class="cd-panels" aria-live="polite">
          <sg-panels
            .session=${session}
            .contrast=${checkContrast(doc)}
            .missing=${missingAssets(meta, session.ctx)}
          ></sg-panels>
        </div>
        ${repeat(
          sectionsOf(meta, this.tokens),
          (s) => s.id,
          (s) => html`
            <section id=${s.id} class=${s.cls ?? nothing}>
              <h2>${s.title}</h2>
              ${s.id === 'typography' ? specimen : nothing}
              <div class="cd-section-body">${this.body(s.id, meta, session.ctx)}</div>
            </section>
          `,
        )}
      </main>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sg-guide': Guide;
  }
}
