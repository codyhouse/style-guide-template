// @font-face rules and runtime registration for the brand's font files.
const FORMATS = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };
const format = (src) => FORMATS[src.split('.').pop().toLowerCase()] ?? 'woff2';
// Brand files come from users: everything written into CSS is escaped or limited to safe forms.
export const cssString = (s) => `"${String(s).replace(/[\\"]/g, '\\$&').replace(/[\n\r]/g, ' ')}"`;
const STYLES = new Set(['normal', 'italic', 'oblique']);

export function fontFaceRules(fontFiles = [], fontSrc) {
  return fontFiles.map((f) => [
    '@font-face {',
    `  font-family: ${cssString(f.family)};`, // ds-allow-hardcode: generated from the brand's font files
    `  font-weight: ${Number(f.weight) || 400};`,
    `  font-style: ${STYLES.has(f.style) ? f.style : 'normal'};`,
    `  src: url(${cssString(fontSrc(f))}) format("${format(f.src)}");`,
    ...(/^[U+0-9A-Fa-f?, -]+$/.test(f.unicodeRange ?? '') ? [`  unicode-range: ${f.unicodeRange};`] : []),
    '  font-display: swap;',
    '}',
  ].join('\n')).join('\n');
}

// Browser only. Resolves with the entries the browser could not load.
export async function registerFonts(fontFiles = [], urlFor) {
  const failed = [];
  await Promise.all(fontFiles.map(async (f) => {
    try {
      const face = new FontFace(f.family, `url("${urlFor(f)}")`, {
        weight: String(f.weight), style: f.style, ...(f.unicodeRange ? { unicodeRange: f.unicodeRange } : {}),
      });
      document.fonts.add(await face.load());
    } catch {
      failed.push(f);
    }
  }));
  return { failed };
}
