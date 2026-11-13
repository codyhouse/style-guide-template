import { isNode } from '../../lib/tree.js';

export function dim(value: unknown): string {
  if (isNode(value) && typeof value.value === 'number' && typeof value.unit === 'string')
    return `${value.value}${value.unit}`;
  return typeof value === 'number' || typeof value === 'string' ? String(value) : '';
}

const images = new Set(['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico']);

export const isImage = (ext: string) => images.has(ext);

const KB = 1024;
const MB = 1024 * KB;

export function formatSize(bytes: number) {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

export const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
