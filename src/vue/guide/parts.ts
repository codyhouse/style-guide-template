import type { Dimension } from '../../lib/types.js';

export const dim = (v: Dimension | number | string) =>
  v && typeof v === 'object' ? `${v.value}${v.unit}` : String(v);

const images = new Set(['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico']);
export const isImage = (ext: string) => images.has(ext);
export const formatSize = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
