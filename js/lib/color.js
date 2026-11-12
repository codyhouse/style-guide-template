// Color math for DTCG color values (oklch and srgb color spaces).
// OKLab matrices: Björn Ottosson, https://bottosson.github.io/posts/oklab/

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const num = (v) => (v === 'none' ? 0 : v);

const toLinear = (v) => (Math.abs(v) <= 0.04045 ? v / 12.92 : Math.sign(v) * ((Math.abs(v) + 0.055) / 1.055) ** 2.4);
const toGamma = (v) => (Math.abs(v) <= 0.0031308 ? v * 12.92 : Math.sign(v) * (1.055 * Math.abs(v) ** (1 / 2.4) - 0.055));

function oklchToSrgb(l, c, h) {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toGamma(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    toGamma(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    toGamma(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

function srgbToOklch(r, g, b) {
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  const H = C < 1e-7 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return [L, C, H];
}

export function toOklch(color) {
  const [x, y, z] = color.components.map(num);
  const alpha = color.alpha ?? 1;
  if (color.colorSpace === 'oklch') return [x, y, z, alpha];
  if (color.colorSpace === 'srgb') return [...srgbToOklch(x, y, z), alpha];
  throw new Error(`Unsupported color space: ${color.colorSpace}`);
}

export function toSrgb(color) {
  const [x, y, z] = color.components.map(num);
  const alpha = color.alpha ?? 1;
  if (color.colorSpace === 'srgb') return { r: x, g: y, b: z, alpha };
  const [l, c, h] = toOklch(color);
  const [r, g, b] = oklchToSrgb(l, c, h);
  return { r, g, b, alpha };
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
