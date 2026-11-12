// @font-face rules and runtime registration for the brand's font files.
const FORMATS = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };
const format = (src) => FORMATS[src.split('.').pop().toLowerCase()] ?? 'woff2';

export function fontFaceRules(fontFiles = [], fontSrc) {
  return fontFiles.map((f) => [
    '@font-face {',
    `  font-family: "${f.family}";`,
    `  font-weight: ${f.weight};`,
    `  font-style: ${f.style};`,
    `  src: url("${fontSrc(f)}") format("${format(f.src)}");`,
    ...(f.unicodeRange ? [`  unicode-range: ${f.unicodeRange};`] : []),
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
