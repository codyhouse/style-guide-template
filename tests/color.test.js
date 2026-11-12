import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  oklch, toOklch, toHex, inGamut, toOklchString, toRgbaString, cmyk, contrastRatio, shadeScale,
} from '../src/lib/color.js';

const srgb = (r, g, b) => ({ colorSpace: 'srgb', components: [r, g, b] });

test('srgb red <-> oklch', () => {
  const [l, c, h] = toOklch(srgb(1, 0, 0));
  assert.ok(Math.abs(l - 0.62796) < 1e-4, `l=${l}`);
  assert.ok(Math.abs(c - 0.25768) < 1e-4, `c=${c}`);
  assert.ok(Math.abs(h - 29.2339) < 1e-2, `h=${h}`);
  assert.equal(toHex(oklch(l, c, h)), '#ff0000');
});

test('white and black', () => {
  assert.equal(toHex(oklch(1, 0, 0)), '#ffffff');
  assert.equal(toHex(oklch(0, 0, 0)), '#000000');
  assert.equal(contrastRatio(oklch(1, 0, 0), oklch(0, 0, 0)), 21);
});

test('contrast #777 on white is 4.48', () => {
  const grey = srgb(0x77 / 255, 0x77 / 255, 0x77 / 255);
  assert.equal(contrastRatio(grey, oklch(1, 0, 0)).toFixed(2), '4.48');
});

test('out-of-gamut keeps oklch, hex is clipped', () => {
  const c = oklch(0.7, 0.4, 150);
  assert.equal(inGamut(c), false);
  assert.match(c.hex, /^#[0-9a-f]{6}$/);
  assert.deepEqual(c.components, [0.7, 0.4, 150]);
});

test('alpha omitted when 1', () => {
  assert.equal('alpha' in oklch(0.5, 0.1, 10), false);
  assert.equal(oklch(0.5, 0.1, 10, 0.5).alpha, 0.5);
});

test('none component reads as 0', () => {
  assert.deepEqual(toOklch({ colorSpace: 'oklch', components: [0.5, 'none', 'none'] }), [0.5, 0, 0, 1]);
});

test('strings', () => {
  assert.equal(toOklchString(oklch(0.55, 0.18, 260)), 'oklch(0.55 0.18 260)');
  assert.equal(toOklchString(oklch(0.55, 0.18, 260, 0.5)), 'oklch(0.55 0.18 260 / 0.5)');
  assert.equal(toRgbaString(srgb(1, 0, 0)), 'rgba(255, 0, 0, 1)');
  assert.deepEqual(cmyk(srgb(1, 0, 0)), [0, 100, 100, 0]);
});

test('shade scale', () => {
  const s = shadeScale(260, 0.18);
  assert.deepEqual(Object.keys(s), ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']);
  assert.equal(s['50'].components[0], 0.97);
  assert.equal(s['950'].components[0], 0.15);
  for (const v of Object.values(s)) assert.ok(inGamut(v));
});

test('parseCssColor reads hex, rgb and oklch', async () => {
  const { parseCssColor } = await import('../src/lib/color.js');
  assert.equal(parseCssColor('#ff0000').hex, '#ff0000');
  assert.equal(parseCssColor('#f00').hex, '#ff0000');
  assert.equal(parseCssColor('rgb(255, 0, 0)').hex, '#ff0000');
  assert.equal(parseCssColor('rgb(255 0 0)').hex, '#ff0000');
  assert.deepEqual(parseCssColor('oklch(0.55 0.18 260)').components, [0.55, 0.18, 260]);
  assert.deepEqual(parseCssColor('oklch(55% 0.18 260)').components, [0.55, 0.18, 260]);
  assert.equal(parseCssColor('oklch(0.5 0.1 10 / 0.5)').alpha, 0.5);
  assert.equal(parseCssColor('#ff0000').colorSpace, 'oklch');
  assert.equal(parseCssColor('blue-ish'), null);
});

test('parseCssColor reads any CSS color', async () => {
  const { parseCssColor, inGamut } = await import('../src/lib/color.js');
  assert.equal(parseCssColor('hsl(0 100% 50%)').hex, '#ff0000');
  assert.equal(parseCssColor('rebeccapurple').hex, '#663399');
  assert.deepEqual(parseCssColor('white').components, [1, 0, 0]);
  const p3 = parseCssColor('color(display-p3 1 0 0)');
  assert.equal(inGamut(p3), false);
  assert.equal(p3.hex, '#ff0000');
});

test('every DTCG color space converts', async () => {
  const { toHex } = await import('../src/lib/color.js');
  const red = {
    srgb: [1, 0, 0], 'srgb-linear': [1, 0, 0], hsl: [0, 100, 50], hwb: [0, 0, 0], 'display-p3': [0.9175, 0.2003, 0.1386],
    lab: [54.29, 80.8, 69.89], lch: [54.29, 106.84, 40.85], oklab: [0.628, 0.2249, 0.1258],
  };
  for (const [colorSpace, components] of Object.entries(red)) assert.equal(toHex({ colorSpace, components }), '#ff0000', colorSpace);
});

test('anchoredScale keeps the typed color exactly as the nearest shade', async () => {
  const { anchoredScale, parseCssColor, toHex } = await import('../src/lib/color.js');
  const typed = parseCssColor('#f0941d');
  const { scale, anchor } = anchoredScale(typed);
  assert.equal(anchor, '300');
  assert.equal(toHex(scale[anchor]), '#f0941d');
  assert.deepEqual(scale[anchor].components, typed.components);
  const ls = Object.values(scale).map((s) => s.components[0]);
  assert.deepEqual([...ls].sort((a, b) => b - a), ls, 'shades stay ordered light to dark');
});

test('every DTCG color space converts (white is white everywhere)', async () => {
  const { toHex } = await import('../src/lib/color.js');
  const white = {
    srgb: [1, 1, 1], 'srgb-linear': [1, 1, 1], hsl: [0, 0, 100], hwb: [0, 100, 0], lab: [100, 0, 0], lch: [100, 0, 0],
    oklab: [1, 0, 0], oklch: [1, 0, 0], 'display-p3': [1, 1, 1], 'a98-rgb': [1, 1, 1], 'prophoto-rgb': [1, 1, 1],
    rec2020: [1, 1, 1], 'xyz-d65': [0.95047, 1, 1.08883], 'xyz-d50': [0.96422, 1, 0.82521],
  };
  for (const [colorSpace, components] of Object.entries(white)) assert.equal(toHex({ colorSpace, components }), '#ffffff', colorSpace);
});

test('known reds in other spaces', async () => {
  const { toHex } = await import('../src/lib/color.js');
  assert.equal(toHex({ colorSpace: 'lab', components: [54.2905, 80.8049, 69.891] }), '#ff0000');
  assert.equal(toHex({ colorSpace: 'hsl', components: [0, 100, 50] }), '#ff0000');
  assert.equal(toHex({ colorSpace: 'display-p3', components: [1, 0, 0] }), '#ff0000');
});

test('cssColor writes each space natively', async () => {
  const { cssColor } = await import('../src/lib/color.js');
  assert.equal(cssColor({ colorSpace: 'display-p3', components: [1, 0, 0] }), 'color(display-p3 1 0 0)');
  assert.equal(cssColor({ colorSpace: 'lab', components: [50, 20, -30], alpha: 0.5 }), 'lab(50 20 -30 / 0.5)');
  assert.equal(cssColor({ colorSpace: 'hsl', components: [10, 50, 40] }), 'hsl(10 50% 40%)');
  assert.equal(cssColor({ colorSpace: 'oklch', components: [0.5, 0.1, 10] }), 'oklch(0.5 0.1 10)');
});
