import { deepMerge } from './schema.js';
import type { FlatToken, Json, ResolverDoc, TokenNode, Tokens } from './types.js';

export class ResolveError extends Error {
  path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.path = path;
  }
}

const isObj = (v: unknown): v is TokenNode => v !== null && typeof v === 'object' && !Array.isArray(v);

export const aliasTarget = (v: unknown): string | null =>
  typeof v === 'string' && /^\{[^{}]+\}$/.test(v) ? v.slice(1, -1) : null;

export function contexts(doc: ResolverDoc): Array<{ modifier: string; context: string; isDefault: boolean }> {
  return Object.entries(doc.modifiers ?? {}).flatMap(([modifier, m]) => {
    const def = m.default ?? Object.keys(m.contexts)[0];
    return Object.keys(m.contexts).map((context) => ({
      modifier,
      context,
      isDefault: context === def,
    }));
  });
}

export const defaultInputs = (doc: ResolverDoc): Record<string, string> =>
  Object.fromEntries(
    contexts(doc)
      .filter((c) => c.isDefault)
      .map((c) => [c.modifier, c.context]),
  );

export function mergedTree(doc: ResolverDoc, inputs = defaultInputs(doc)): TokenNode {
  let tree: TokenNode = {};
  for (const { $ref } of doc.resolutionOrder) {
    const [, kind, name] = $ref.match(/^#\/(sets|modifiers)\/(.+)$/) ?? [];
    const mod = kind === 'modifiers' ? doc.modifiers?.[name] : undefined;
    const sources =
      kind === 'sets'
        ? doc.sets[name]?.sources
        : mod && (mod.contexts[inputs[name]] ?? mod.contexts[defaultInputs(doc)[name]] ?? []);
    if (!sources) throw new ResolveError('resolutionOrder', `${$ref} does not point to a set or modifier`);
    for (const s of sources) tree = deepMerge(tree, s);
  }
  return tree;
}

export function flatten(
  tree: TokenNode,
  path = '',
  inherited?: string,
  out = new Map<string, FlatToken>(),
): Map<string, FlatToken> {
  const type = tree.$type ?? inherited;
  for (const [key, node] of Object.entries(tree)) {
    if ((key.startsWith('$') && key !== '$root') || !isObj(node)) continue;
    const p = path ? `${path}.${key}` : key;
    if ('$value' in node) {
      out.set(p, {
        type: node.$type ?? type,
        value: node.$value,
        extensions: node.$extensions,
        description: node.$description,
      });
    } else flatten(node, p, type, out);
  }
  return out;
}

const pointerSegments = (ref: string) =>
  ref
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));

export function resolve(doc: ResolverDoc, inputs = defaultInputs(doc)): Tokens {
  const tree = mergedTree(doc, inputs);
  const flat = flatten(tree);
  const done = new Map<string, unknown>();

  const resolveToken = (path: string, stack: string[]): Json => {
    if (done.has(path)) return done.get(path);
    if (stack.includes(path))
      throw new ResolveError(stack[0], `alias cycle: ${[...stack, path].join(' -> ')}`);
    const token = flat.get(path);
    if (!token) throw new ResolveError(stack.at(-1) ?? path, `alias target ${path} does not exist`);
    const value = resolveValue(token.value, [...stack, path]);
    done.set(path, value);
    return value;
  };

  const resolveRef = (ref: string, stack: string[]): unknown => {
    const segs = pointerSegments(ref);
    const at = segs.indexOf('$value');
    if (at === -1) throw new ResolveError(stack.at(-1) ?? ref, `$ref ${ref} must point into a token $value`);
    let v: Json = resolveToken(segs.slice(0, at).join('.'), stack);
    for (const s of segs.slice(at + 1)) v = v?.[s];
    if (v === undefined) throw new ResolveError(stack.at(-1) ?? ref, `$ref ${ref} does not exist`);
    return v;
  };

  const resolveValue = (v: unknown, stack: string[]): unknown => {
    const target = aliasTarget(v);
    if (target) return resolveToken(target, stack);
    if (isObj(v) && typeof v.$ref === 'string') return resolveRef(v.$ref, stack);
    if (Array.isArray(v)) return v.map((x) => resolveValue(x, stack));
    if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveValue(x, stack)]));
    return v;
  };

  const out: Tokens = new Map();
  for (const [path, token] of flat) out.set(path, { ...token, resolved: resolveToken(path, []) });
  return out;
}
