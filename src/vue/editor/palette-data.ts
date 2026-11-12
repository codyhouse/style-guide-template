import { ROLES } from '../../lib/contrast.js';
import type { EditorContext } from './context.js';
const shade = /^\d+$/;
export const huesOf = (tree: EditorContext['tree']) =>
  Object.keys(tree.color ?? {}).filter(
    (k) => !k.startsWith('$') && !ROLES.includes(k) && Object.keys(tree.color[k]).some((s) => shade.test(s)),
  );
export const shadesOf = (tree: EditorContext['tree'], hue: string) =>
  Object.keys(tree.color[hue]).filter((s) => shade.test(s));
export const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
