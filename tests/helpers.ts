import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as z from 'zod/mini';
import { resolverDoc } from '../src/lib/schema.js';
import { isNode } from '../src/lib/tree.js';
import type { ResolverDoc, TokenNode, Tokens } from '../src/lib/types.js';

export function present<T>(value: T | null | undefined, what = 'value'): T {
  assert.ok(value !== null && value !== undefined, `${what} is missing`);
  return value;
}

export const token = (tokens: Tokens, path: string) => present(tokens.get(path), path);

export const V = 'com.example.styleguide';

const readJson = (url: URL): unknown => JSON.parse(readFileSync(url, 'utf8'));

export const fixture = (name: string) => readJson(new URL(`./fixtures/${name}`, import.meta.url));

export const load = (): ResolverDoc => z.parse(resolverDoc, fixture('minimal.resolver.json'));

export const preset = (): ResolverDoc =>
  z.parse(resolverDoc, readJson(new URL('../public/library/brands/default.resolver.json', import.meta.url)));

function parentOf(tree: TokenNode, path: string): [TokenNode, string] {
  const keys = path.split('.');
  const last = keys.pop() ?? path;
  const parent = keys.reduce<unknown>((node, key) => (isNode(node) ? node[key] : undefined), tree);
  assert.ok(isNode(parent), `${path} has no parent`);
  return [parent, last];
}

export function setAt(tree: TokenNode, path: string, value: unknown) {
  const [parent, key] = parentOf(tree, path);
  parent[key] = value;
}

export function removeAt(tree: TokenNode, path: string) {
  const [parent, key] = parentOf(tree, path);
  Reflect.deleteProperty(parent, key);
}
