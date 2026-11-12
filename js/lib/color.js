// Color math for DTCG color values. Conversions and CSS parsing come from culori.
import { converter, parse } from '../vendor/culori.js';

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const num = (v) => (v === 'none' ? 0 : v);
const toLinear = (v) => (Math.abs(v) <= 0.04045 ? v / 12.92 : Math.sign(v) * ((Math.abs(v) + 0.055) / 1.055) ** 2.4);

// DTCG color space: culori mode, its channels in DTCG order, and DTCG's scale for each (hsl/hwb use 0-100).
const MODES = {
  srgb: ['rgb', 'rgb'],
  'srgb-linear': ['lrgb', 'rgb'],
  hsl: ['hsl', 'hsl', [1, 100, 100]],
  hwb: ['hwb', 'hwb', [1, 100, 100]],
  lab: ['lab', 'lab'],
  lch: ['lch', 'lch'],
  oklab: ['oklab', 'lab'],
  oklch: ['oklch', 'lch'],
  'display-p3': ['p3', 'rgb'],
  'a98-rgb': ['a98', 'rgb'],
  'prophoto-rgb': ['prophoto', 'rgb'],
  rec2020: ['rec2020', 'rgb'],
  'xyz-d65': ['xyz65', 'xyz'],
  'xyz-d50': ['xyz50', 'xyz'],
};

function toCulori(color) {
  const [mode, channels, scale = [1, 1, 1]] = MODES[color.colorSpace] ?? [];
  if (!mode) throw new Error(`Unsupported color space: ${color.colorSpace}`);
  return Object.fromEntries([['mode', mode], ...[...channels].map((k, i) => [k, num(color.components[i]) / scale[i]])]);
}

const rgb = converter('rgb');
const ok = converter('oklch');
// culori leaves the hue of a grey undefined; DTCG wants a number
const okParts = (c) => {
  const { l, c: chroma, h } = ok(c);
  return [l, chroma, chroma < 1e-7 || h === undefined ? 0 : h];
};

export function toOklch(color) {
  const alpha = color.alpha ?? 1;
  if (color.colorSpace === 'oklch') return [...color.components.map(num), alpha];
  return [...okParts(toCulori(color)), alpha];
}

export function toSrgb(color) {
  const { r, g, b } = rgb(toCulori(color));
  return { r, g, b, alpha: color.alpha ?? 1 };
}

// The color as CSS, in its own color space.
const FUNCTIONAL = new Set(['lab', 'lch', 'oklab', 'oklch']);
export function cssColor(color) {
  const c = color.components.map((v) => (v === 'none' ? 'none' : round(v)));
  const a = color.alpha === undefined || color.alpha === 1 ? '' : ` / ${color.alpha}`;
  if (FUNCTIONAL.has(color.colorSpace)) return `${color.colorSpace}(${c.join(' ')}${a})`;
  if (color.colorSpace === 'hsl' || color.colorSpace === 'hwb') return `${color.colorSpace}(${c[0]} ${c[1]}% ${c[2]}%${a})`;
  return `color(${color.colorSpace} ${c.join(' ')}${a})`;
}

export function inGamut(color) {
  const { r, g, b } = toSrgb(color);
  return [r, g, b].every((v) => v >= -1e-4 && v <= 1 + 1e-4);
}

const bytes = (color) => {
  const { r, g, b, alpha } = toSrgb(color);
  return [...[r, g, b].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)), alpha];
};

export function toHex(color) {
  return '#' + bytes(color).slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function oklch(l, c, h, alpha = 1) {
  const color = { colorSpace: 'oklch', components: [l, c, h] };
  if (alpha !== 1) color.alpha = alpha;
  color.hex = toHex(color);
  return color;
}

export function toRgbaString(color) {
  const [r, g, b, a] = bytes(color);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function toOklchString(color) {
  const [l, c, h, a] = toOklch(color);
  const base = `${round(l)} ${round(c)} ${round(h)}`;
  return a === 1 ? `oklch(${base})` : `oklch(${base} / ${a})`;
}

// Naive device CMYK from clamped sRGB. Real print values come from the brand book.
export function cmyk(color) {
  const [r, g, b] = bytes(color).slice(0, 3).map((v) => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return [0, 0, 0, 100];
  return [...[r, g, b].map((v) => Math.round(((1 - v - k) / (1 - k)) * 100)), Math.round(k * 100)];
}

// WCAG 2.2 contrast on the displayed 8-bit sRGB values.
export function contrastRatio(a, b) {
  const lum = (color) => {
    const [r, g, bl] = bytes(color).slice(0, 3).map((v) => toLinear(v / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function shadeScale(h, c) {
  const scale = {};
  SHADES.forEach((name, i) => {
    const l = round(0.97 - ((0.97 - 0.15) * i) / (SHADES.length - 1));
    let lo = 0;
    let hi = c;
    if (!inGamut({ colorSpace: 'oklch', components: [l, c, h] })) {
      for (let n = 0; n < 20; n++) {
        const mid = (lo + hi) / 2;
        if (inGamut({ colorSpace: 'oklch', components: [l, mid, h] })) lo = mid;
        else hi = mid;
      }
    } else lo = c;
    scale[name] = oklch(l, Math.floor(lo * 1e4) / 1e4, h);
  });
  return scale;
}

// Reads any CSS color (hex, a name, rgb(), hsl(), oklch(), color(display-p3 ...)) into a DTCG oklch color, or null.
export function parseCssColor(input) {
  const parsed = parse(String(input).trim());
  if (!parsed) return null;
  const [l, c, h] = okParts(parsed);
  return oklch(round(l), round(c), round(h), parsed.alpha ?? 1);
}

// A scale built around a typed color: the color is kept exactly as the shade whose
// target lightness is nearest; the other shades are generated from its hue and chroma.
export function anchoredScale(color) {
  const [l, c, h] = toOklch(color);
  const scale = shadeScale(h, c);
  const anchor = Object.keys(scale).reduce((best, k) =>
    (Math.abs(scale[k].components[0] - l) < Math.abs(scale[best].components[0] - l) ? k : best));
  scale[anchor] = color.colorSpace === 'oklch' && color.hex ? color : oklch(l, c, h, color.alpha ?? 1);
  return { scale, anchor };
}
