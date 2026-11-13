import { blobPart } from './download.js';
import { resolveAsset } from '../lib/assets.js';
import { extension } from '../lib/path.js';
import type { AssetContext, AssetItem, FileData } from '../lib/types.js';

const MIME: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
  pdf: 'application/pdf',
};

function cachedUrl(
  cache: Map<string, { data: FileData; url: string }>,
  path: string,
  data: FileData,
  type: string,
) {
  const cached = cache.get(path);
  if (cached?.data === data) return cached.url;
  if (cached) URL.revokeObjectURL(cached.url);
  const url = URL.createObjectURL(
    data instanceof Blob && type === '' ? data : new Blob([blobPart(data)], { type }),
  );
  cache.set(path, { data, url });
  return url;
}

const shown = new Map<string, { data: FileData; url: string }>();
const downloads = new Map<string, { data: FileData; url: string }>();

export const objectUrl = (path: string, data: FileData) =>
  cachedUrl(
    shown,
    path,
    data,
    data instanceof Blob ? '' : (MIME[extension(path)] ?? 'application/octet-stream'),
  );

export const downloadUrl = (path: string, data: FileData) =>
  cachedUrl(downloads, path, data, 'application/octet-stream');

export function urlFor(entry: AssetItem, ctx: AssetContext): string | null {
  const data = ctx.session.get(entry.src);
  const where = resolveAsset(entry, ctx);
  if (where.source === 'session' && data) return objectUrl(entry.src, data);
  return where.url ?? null;
}
