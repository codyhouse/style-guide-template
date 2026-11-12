import { LitElement } from 'lit';

/** A Lit element that renders into its own children, not a shadow root, so the page's stylesheet applies. */
export class LightElement extends LitElement {
  protected override createRenderRoot() {
    return this;
  }
}
