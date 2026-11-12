// Color math for DTCG color values (oklch and srgb color spaces).
// OKLab matrices: Björn Ottosson, https://bottosson.github.io/posts/oklab/

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const num = (v) => (v === 'none' ? 0 : v);

const toLinear = (v) => (Math.abs(v) <= 0.04045 ? v / 12.92 : Math.sign(v) * ((Math.abs(v) + 0.055) / 1.055) ** 2.4);
const toGamma = (v) => (Math.abs(v) <= 0.0031308 ? v * 12.92 : Math.sign(v) * (1.055 * Math.abs(v) ** (1 / 2.4) - 0.055));

function oklabToSrgb(l, a, b) {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toGamma(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    toGamma(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    toGamma(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

const oklchToSrgb = (l, c, h) => oklabToSrgb(l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180));

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

// The other DTCG color spaces go through CIE XYZ (matrices from CSS Color 4).
const mul = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const D50_TO_D65 = [[0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753]];
const XYZ65_TO_LSRGB = [[3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786]];
const P3_TO_XYZ65 = [[0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745], [0, 0.04511338185890264, 1.043944368900976]];
const A98_TO_XYZ65 = [[0.5766690429101305, 0.1855582379065463, 0.1882286462349947],
  [0.29734497525053605, 0.6273635662554661, 0.07529145849399788], [0.02703136138641234, 0.07068885253582723, 0.9913375368376388]];
const REC2020_TO_XYZ65 = [[0.6369580483012914, 0.14461690358620832, 0.1688809751641721],
  [0.2627002120112671, 0.6779980715188708, 0.05930171646986196], [0, 0.028072693049087428, 1.060985057710791]];
const PROPHOTO_TO_XYZ50 = [[0.7977604896723027, 0.13518583717574031, 0.0313493495815248],
  [0.2880711282292934, 0.7118432178101014, 0.00008565396060525902], [0, 0, 0.8251046025104601]];
const D50_WHITE = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];
const signPow = (v, p) => Math.sign(v) * Math.abs(v) ** p;

function labToXyz50(L, a, b) {
  const e = 216 / 24389;
  const k = 24389 / 27;
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  return [fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k, L > k * e ? fy ** 3 : L / k, fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k]
    .map((v, i) => v * D50_WHITE[i]);
}

function toXyz65(space, [x, y, z]) {
  switch (space) {
    case 'xyz-d65': return [x, y, z];
    case 'xyz-d50': return mul(D50_TO_D65, [x, y, z]);
    case 'display-p3': return mul(P3_TO_XYZ65, [x, y, z].map(toLinear));
    case 'a98-rgb': return mul(A98_TO_XYZ65, [x, y, z].map((v) => signPow(v, 563 / 256)));
    case 'prophoto-rgb': return mul(D50_TO_D65, mul(PROPHOTO_TO_XYZ50, [x, y, z].map((v) => (Math.abs(v) <= 16 / 512 ? v / 16 : signPow(v, 1.8)))));
    case 'rec2020': {
      const a = 1.09929682680944;
      const b = 0.018053968510807;
      return mul(REC2020_TO_XYZ65, [x, y, z].map((v) => (Math.abs(v) < b * 4.5 ? v / 4.5 : signPow((Math.abs(v) + a - 1) / a, 1 / 0.45))));
    }
    case 'lab': return mul(D50_TO_D65, labToXyz50(x, y, z));
    case 'lch': return mul(D50_TO_D65, labToXyz50(x, y * Math.cos((z * Math.PI) / 180), y * Math.sin((z * Math.PI) / 180)));
    default: throw new Error(`Unsupported color space: ${space}`);
  }
}

function hslToSrgb(h, s, l) {
  const [S, L] = [s / 100, l / 100];
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return L - S * Math.min(L, 1 - L) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function hwbToSrgb(h, w, bl) {
  const [W, B] = [w / 100, bl / 100];
  if (W + B >= 1) return [W / (W + B), W / (W + B), W / (W + B)];
  return hslToSrgb(h, 100, 50).map((v) => v * (1 - W - B) + W);
}

export function toOklch(color) {
  const [x, y, z] = color.components.map(num);
  const alpha = color.alpha ?? 1;
  if (color.colorSpace === 'oklch') return [x, y, z, alpha];
  if (color.colorSpace === 'oklab') {
    const c = Math.hypot(y, z);
    return [x, c, c < 1e-7 ? 0 : ((Math.atan2(z, y) * 180) / Math.PI + 360) % 360, alpha];
  }
  const { r, g, b } = toSrgb(color);
  return [...srgbToOklch(r, g, b), alpha];
}

export function toSrgb(color) {
  const [x, y, z] = color.components.map(num);
  const alpha = color.alpha ?? 1;
  const rgb = (() => {
    switch (color.colorSpace) {
      case 'srgb': return [x, y, z];
      case 'srgb-linear': return [x, y, z].map(toGamma);
      case 'hsl': return hslToSrgb(x, y, z);
      case 'hwb': return hwbToSrgb(x, y, z);
      case 'oklch': return oklchToSrgb(x, y, z);
      case 'oklab': return oklabToSrgb(x, y, z);
      default: return mul(XYZ65_TO_LSRGB, toXyz65(color.colorSpace, [x, y, z])).map(toGamma);
    }
  })();
  return { r: rgb[0], g: rgb[1], b: rgb[2], alpha };
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

// Reads a typed CSS color (#rgb, #rrggbb, rgb(), oklch()) into a DTCG oklch color, or null.
export function parseCssColor(input) {
  const s = String(input).trim().toLowerCase();
  const round = (n) => Math.round(n * 1e4) / 1e4;
  const fromSrgb = (r, g, b, a = 1) => {
    const [l, c, h] = toOklch({ colorSpace: 'srgb', components: [r, g, b] });
    return oklch(round(l), round(c), round(h), a);
  };
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) {
    const hex = m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1];
    return fromSrgb(...[0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255));
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
  if (m) return fromSrgb(+m[1] / 255, +m[2] / 255, +m[3] / 255, m[4] === undefined ? 1 : +m[4]);
  m = s.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/);
  if (m) return oklch(round(m[2] ? +m[1] / 100 : +m[1]), +m[3], +m[4], m[5] === undefined ? 1 : +m[5]);
  return null;
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
