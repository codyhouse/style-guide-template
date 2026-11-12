// <sg-editor>: the drawer's areas, each a fold that stays open or closed across renders.
import { html, LitElement, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Session } from '../../app/session.js';
import type { Tokens } from '../../lib/types.js';
import { LightElement } from '../light-element.js';
import './assets.js';
import './brand.js';
import { editorContext } from './context.js';
import './palette.js';
import './roles.js';
import './scales.js';
import './shadow.js';
import './type.js';

@customElement('sg-editor')
export class Editor extends LightElement {
  @property({ attribute: false }) session?: Session;
  @property({ attribute: false }) tokens: Tokens = new Map();
  @property() theme = 'light';
  @state() private open = new Set(['Brand', 'Palette']);

  /** Resolves once the areas have rendered too, so their fields can take focus. */
  protected override async getUpdateComplete() {
    const done = await super.getUpdateComplete();
    const areas = [...this.querySelectorAll('.cd-drawer-area > :not(summary)')].filter(
      (el) => el instanceof LitElement,
    );
    await Promise.all(areas.map((el) => el.updateComplete));
    return done;
  }

  private area(name: string, body: TemplateResult) {
    const toggle = (e: Event) => {
      const open = new Set(this.open);
      if ((e.currentTarget as HTMLDetailsElement).open) open.add(name);
      else open.delete(name);
      this.open = open;
    };
    return html`
      <details class="cd-drawer-area" ?open=${this.open.has(name)} @toggle=${toggle}>
        <summary><h3>${name}</h3></summary>
        ${body}
      </details>
    `;
  }

  protected override render() {
    if (!this.session) return html``;
    const ctx = editorContext(this.session, this.theme, this.tokens);
    return html`
      ${this.area('Brand', html`<sg-edit-brand .ctx=${ctx}></sg-edit-brand>`)}
      ${this.area('Palette', html`<sg-edit-palette .ctx=${ctx}></sg-edit-palette>`)}
      ${this.area('Roles', html`<sg-edit-roles .ctx=${ctx}></sg-edit-roles>`)}
      ${this.area('Fonts and type', html`<sg-edit-type .ctx=${ctx}></sg-edit-type>`)}
      ${this.area('Scales', html`<sg-edit-scales .ctx=${ctx}></sg-edit-scales>`)}
      ${this.area('Shadow', html`<sg-edit-shadow .ctx=${ctx}></sg-edit-shadow>`)}
      ${this.area('Assets', html`<sg-edit-assets .ctx=${ctx}></sg-edit-assets>`)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sg-editor': Editor;
  }
}
