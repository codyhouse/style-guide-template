import { extension } from './path.js';
import type { FontFile } from './types.js';

const FORMATS: Record<string, string> = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };
const format = (src: string) => FORMATS[extension(src)] ?? 'woff2';
export const cssString = (s: unknown) =>
  `"${String(s)
    .replace(/[\\"]/g, String.raw`\$&`)
    .replace(/[\n\r]/g, ' ')}"`;
const STYLES = new Set(['normal', 'italic', 'oblique']);

export function fontFaceRules(fontFiles: FontFile[] | undefined, fontSrc: (f: FontFile) => string): string {
  return (fontFiles ?? [])
    .map((f) =>
      [
        '@font-face {',
        `  font-family: ${cssString(f.family)};`,
        `  font-weight: ${Number(f.weight) || 400};`,
        `  font-style: ${STYLES.has(f.style) ? f.style : 'normal'};`,
        `  src: url(${cssString(fontSrc(f))}) format("${format(f.src)}");`,
        ...(/^[U+0-9A-Fa-f?, -]+$/.test(f.unicodeRange ?? '') ? [`  unicode-range: ${f.unicodeRange};`] : []),
        '  font-display: swap;',
        '}',
      ].join('\n'),
    )
    .join('\n');
}
