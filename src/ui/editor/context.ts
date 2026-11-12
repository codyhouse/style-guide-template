// What every editor area works on, and how its edits reach the store.
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import type { Session } from '../../app/session.js';
import { withBrandMeta } from '../../lib/assets.js';
import * as E from '../../lib/edit.js';
import { checkBrand } from '../../lib/io.js';
import type { BrandMeta, ResolverDoc, TokenNode, Tokens } from '../../lib/types.js';
import { LightElement } from '../light-element.js';

export interface EditorContext {
  session: Session;
  doc: ResolverDoc;
  /** the foundation set's token tree */
  tree: TokenNode;
  /** tokens resolved in the theme being edited */
  tokens: Tokens;
  meta: BrandMeta;
  theme: string;
  /** applies a new document, or warns and refuses one the page could not show */
  set(next: ResolverDoc): void;
  setMeta(fn: (meta: BrandMeta) => BrandMeta): void;
  /** the token at a path as the store holds it now, so two edits in a row never undo each other */
  fresh(path: string): TokenNode;
}

export function editorContext(session: Session, theme: string, tokens: Tokens): EditorContext {
  const { store, vendor } = session;
  const set = (next: ResolverDoc) => {
    const [problem] = checkBrand(next);
    if (problem) session.warn(`Not applied: ${problem.path ? `${problem.path}: ` : ''}${problem.message}`);
    else store.set(next);
  };
  return {
    session,
    doc: store.get(),
    tree: E.foundation(store.get()),
    tokens,
    meta: session.meta,
    theme,
    set,
    setMeta: (fn) => set(withBrandMeta(store.get(), vendor, fn(session.meta))),
    fresh: (path) => E.getIn(E.foundation(store.get()), path),
  };
}

/** An area of the editor drawer: renders from the context it is given. */
export abstract class EditorArea extends LightElement {
  @property({ attribute: false }) ctx?: EditorContext;

  protected abstract renderArea(ctx: EditorContext): TemplateResult;

  protected override render() {
    return this.ctx ? this.renderArea(this.ctx) : html`${nothing}`;
  }
}
