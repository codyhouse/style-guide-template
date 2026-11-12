import type { Session } from '../app/session.js';
import { generateCss } from '../lib/css.js';
import { resolve } from '../lib/resolver.js';
import type { BrandMeta, FontFile, Tokens } from '../lib/types.js';
import { urlFor } from './urls.js';

export interface View {
  tokens: Tokens;
  meta: BrandMeta;
  css: string;
}

export type ViewSession = Pick<Session, 'doc' | 'preset' | 'vendor' | 'ctx' | 'meta' | 'fallBack'>;

export function deriveView(session: ViewSession, theme: string): View {
  const build = (): View => {
    const doc = session.doc;
    const fontSrc = (f: FontFile) => urlFor(f, session.ctx) ?? f.src;
    return {
      tokens: resolve(doc, { theme }),
      meta: session.meta,
      css: generateCss(doc, { vendor: session.vendor, fontSrc }),
    };
  };
  try {
    return build();
  } catch (error) {
    if (session.doc === session.preset) throw error;
    session.fallBack(error);
    return build();
  }
}
