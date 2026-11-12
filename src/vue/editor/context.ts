import type { Session } from '../../app/session.js';
import { withBrandMeta } from '../../lib/assets.js';
import * as E from '../../lib/edit.js';
import { checkBrand } from '../../lib/io.js';
import type { BrandMeta, ResolverDoc, TokenNode, Tokens } from '../../lib/types.js';

export interface EditorContext {
  session: Session;
  doc: ResolverDoc;
  tree: TokenNode;
  tokens: Tokens;
  meta: BrandMeta;
  theme: string;
  set(next: ResolverDoc): void;
  setMeta(fn: (meta: BrandMeta) => BrandMeta): void;
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
