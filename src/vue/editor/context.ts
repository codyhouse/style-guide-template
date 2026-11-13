import type { Session } from '../../app/session.js';
import { withBrandMeta } from '../../lib/assets.js';
import * as E from '../../lib/edit.js';
import { checkBrand, problemText } from '../../lib/io.js';
import { isNode, nodeAt } from '../../lib/tree.js';
import type { BrandMeta, ResolverDoc, TokenNode, Tokens } from '../../lib/types.js';

export interface EditorContext {
  session: Session;
  vendor: string;
  doc: ResolverDoc;
  tree: TokenNode;
  tokens: Tokens;
  meta: BrandMeta;
  theme: string;
  edit(fn: (doc: ResolverDoc) => ResolverDoc): void;
  setToken(path: string, token: TokenNode): void;
  patchValue(path: string, patch: Record<string, unknown>): void;
  setMeta(fn: (meta: BrandMeta) => BrandMeta): void;
  fresh(path: string): TokenNode;
}

export function editorContext(session: Session, theme: string, tokens: Tokens): EditorContext {
  const { store, vendor } = session;

  const edit = (fn: (doc: ResolverDoc) => ResolverDoc) => {
    const next = fn(store.get());
    const [problem] = checkBrand(next);
    if (problem) session.warn(`Not applied: ${problemText(problem)}`);
    else store.set(next);
  };
  const fresh = (path: string): TokenNode => nodeAt(E.foundation(store.get()), path) ?? {};
  const setToken = (path: string, token: TokenNode) => edit((doc) => E.setToken(doc, path, token));

  return {
    session,
    vendor,
    doc: store.get(),
    tree: E.foundation(store.get()),
    tokens,
    meta: session.meta,
    theme,
    edit,
    setToken,
    patchValue(path, patch) {
      const token = fresh(path);
      const value = isNode(token.$value) ? token.$value : {};
      setToken(path, { ...token, $value: { ...value, ...patch } });
    },
    setMeta: (fn) => edit((doc) => withBrandMeta(doc, vendor, fn(session.meta))),
    fresh,
  };
}
