import type { TokenNode, VendorData } from './types.js';

export const isNode = (value: unknown): value is TokenNode =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const child = (parent: TokenNode | undefined, key: string): TokenNode | undefined => {
  const value = parent?.[key];
  return isNode(value) ? value : undefined;
};

export const nodeAt = (tree: TokenNode, path: string): TokenNode | undefined =>
  path.split('.').reduce<TokenNode | undefined>((node, key) => child(node, key), tree);

export const childKeys = (node?: TokenNode) => Object.keys(node ?? {}).filter((key) => !key.startsWith('$'));

export const children = (node?: TokenNode): [string, TokenNode][] =>
  childKeys(node).flatMap((key) => {
    const value = child(node, key);
    return value ? [[key, value]] : [];
  });

export const vendorData = (node: TokenNode | undefined, vendor: string): VendorData =>
  node?.$extensions?.[vendor] ?? {};

export const holds = (value: unknown, key: string) => isNode(value) && key in value;

export const isHandSet = (token: TokenNode | undefined, vendor: string) =>
  vendorData(token, vendor).overridden === true;

export const withVendorData = (
  node: TokenNode,
  vendor: string,
  patch: Record<string, unknown>,
): TokenNode => ({
  ...node,
  $extensions: { ...node.$extensions, [vendor]: { ...vendorData(node, vendor), ...patch } },
});

export function ensureChild(parent: TokenNode, key: string, created: TokenNode = {}): TokenNode {
  const existing = child(parent, key);
  if (existing) return existing;
  parent[key] = created;
  return created;
}
