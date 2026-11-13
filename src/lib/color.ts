import { converter, parse, type Color } from 'culori';
import type { DtcgColor } from './types.js';

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const num = (v: number | 'none') => (v === 'none' ? 0 : v);
const toLinear = (v: number) =>
  Math.abs(v) <= 0.04045 ? v / 12.92 : Math.sign(v) * ((Math.abs(v) + 0.055) / 1.055) ** 2.4;

type Channels = [number, number, number];

const CULORI: Record<DtcgColor['colorSpace'], (c: Channels) => Color> = {
  srgb: ([r, g, b]) => ({ mode: 'rgb', r, g, b }),
  'srgb-linear': ([r, g, b]) => ({ mode: 'lrgb', r, g, b }),
  hsl: ([h, s, l]) => ({ mode: 'hsl', h, s: s / 100, l: l / 100 }),
  hwb: ([h, w, b]) => ({ mode: 'hwb', h, w: w / 100, b: b / 100 }),
  lab: ([l, a, b]) => ({ mode: 'lab', l, a, b }),
  lch: ([l, c, h]) => ({ mode: 'lch', l, c, h }),
  oklab: ([l, a, b]) => ({ mode: 'oklab', l, a, b }),
  oklch: ([l, c, h]) => ({ mode: 'oklch', l, c, h }),
  'display-p3': ([r, g, b]) => ({ mode: 'p3', r, g, b }),
  'a98-rgb': ([r, g, b]) => ({ mode: 'a98', r, g, b }),
  'prophoto-rgb': ([r, g, b]) => ({ mode: 'prophoto', r, g, b }),
  rec2020: ([r, g, b]) => ({ mode: 'rec2020', r, g, b }),
  'xyz-d65': ([x, y, z]) => ({ mode: 'xyz65', x, y, z }),
  'xyz-d50': ([x, y, z]) => ({ mode: 'xyz50', x, y, z }),
};

const channels = (color: DtcgColor): Channels => {
  const [a, b, c] = color.components.map(num);
  return [a, b, c];
};

const toCulori = (color: DtcgColor): Color => CULORI[color.colorSpace](channels(color));

const toRgb = converter('rgb');
const toOk = converter('oklch');
const converted = <T>(out: T | undefined, color: unknown): T => {
  if (!out) throw new Error(`Color could not be converted: ${JSON.stringify(color)}`);
  return out;
};
const okParts = (c: Color): [number, number, number] => {
  const { l, c: chroma, h } = converted(toOk(c), c);
  return [l, chroma, chroma < 1e-7 || h === undefined ? 0 : h];
};

export function toOklch(color: DtcgColor): [number, number, number, number] {
  const alpha = color.alpha ?? 1;
  if (color.colorSpace === 'oklch') return [...channels(color), alpha];
  return [...okParts(toCulori(color)), alpha];
}

export function toSrgb(color: DtcgColor) {
  const { r, g, b } = converted(toRgb(toCulori(color)), color);
  return { r, g, b, alpha: color.alpha ?? 1 };
}

const FUNCTIONAL = new Set(['lab', 'lch', 'oklab', 'oklch']);

export function cssColor(color: DtcgColor): string {
  const c = color.components.map((v) => (v === 'none' ? 'none' : round(v)));
  const a = color.alpha === undefined || color.alpha === 1 ? '' : ` / ${color.alpha}`;
  if (FUNCTIONAL.has(color.colorSpace)) return `${color.colorSpace}(${c.join(' ')}${a})`;
  if (color.colorSpace === 'hsl' || color.colorSpace === 'hwb')
    return `${color.colorSpace}(${c[0]} ${c[1]}% ${c[2]}%${a})`;
  return `color(${color.colorSpace} ${c.join(' ')}${a})`;
}

export function inGamut(color: DtcgColor): boolean {
  const { r, g, b } = toSrgb(color);
  return [r, g, b].every((v) => v >= -1e-4 && v <= 1 + 1e-4);
}

const bytes = (color: DtcgColor): [number, number, number, number] => {
  const { r, g, b, alpha } = toSrgb(color);
  const [R, G, B] = [r, g, b].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
  return [R, G, B, alpha];
};

export function toHex(color: DtcgColor): string {
  return (
    '#' +
    bytes(color)
      .slice(0, 3)
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

export function oklch(l: number, c: number, h: number, alpha = 1): DtcgColor {
  const color: DtcgColor = { colorSpace: 'oklch', components: [l, c, h] };
  if (alpha !== 1) color.alpha = alpha;
  color.hex = toHex(color);
  return color;
}

export function toRgbaString(color: DtcgColor): string {
  const [r, g, b, a] = bytes(color);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function toOklchString(color: DtcgColor): string {
  const [l, c, h, a] = toOklch(color);
  const base = `${round(l)} ${round(c)} ${round(h)}`;
  return a === 1 ? `oklch(${base})` : `oklch(${base} / ${a})`;
}

export function cmyk(color: DtcgColor): number[] {
  const [r, g, b] = bytes(color)
    .slice(0, 3)
    .map((v) => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return [0, 0, 0, 100];
  return [...[r, g, b].map((v) => Math.round(((1 - v - k) / (1 - k)) * 100)), Math.round(k * 100)];
}

export function contrastRatio(a: DtcgColor, b: DtcgColor): number {
  const lum = (color: DtcgColor) => {
    const [r, g, bl] = bytes(color)
      .slice(0, 3)
      .map((v) => toLinear(v / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function shadeScale(h: number, c: number): Record<string, DtcgColor> {
  const scale: Record<string, DtcgColor> = {};
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

export function parseCssColor(input: string): DtcgColor | null {
  const parsed = parse(String(input).trim());
  if (!parsed) return null;
  const [l, c, h] = okParts(parsed);
  return oklch(round(l), round(c), round(h), parsed.alpha ?? 1);
}

export function anchoredScale(color: DtcgColor): { scale: Record<string, DtcgColor>; anchor: string } {
  const [l, c, h] = toOklch(color);
  const scale = shadeScale(h, c);
  const lightness = (k: string) => channels(scale[k])[0];
  const shades = Object.keys(scale);
  const anchor = shades.reduce(
    (best, k) => (Math.abs(lightness(k) - l) < Math.abs(lightness(best) - l) ? k : best),
    shades[0],
  );
  scale[anchor] = color.colorSpace === 'oklch' && color.hex ? color : oklch(l, c, h, color.alpha ?? 1);
  return { scale, anchor };
}
