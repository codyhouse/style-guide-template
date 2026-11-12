import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateResolver } from '../src/lib/schema.js';
import { resolve } from '../src/lib/resolver.js';
import { checkContrast, ROLES } from '../src/lib/contrast.js';
import { brandMeta, missingAssets } from '../src/lib/assets.js';

const V = 'com.example.styleguide';
const root = new URL('../public/library/', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const walk = (dir, base = '') =>
  readdirSync(dir).flatMap((n) => {
    const rel = base ? `${base}/${n}` : n;
    return statSync(join(dir, n)).isDirectory() ? walk(join(dir, n), rel) : [rel];
  });
const brand = JSON.parse(readFileSync(join(root, manifest.brands[0].path), 'utf8'));

test('manifest lists exactly the library files', () => {
  const onDisk = walk(root)
    .filter((p) => !p.startsWith('brands/') && p !== 'manifest.json')
    .sort();
  assert.deepEqual([...manifest.files].sort(), onDisk);
  for (const b of manifest.brands) assert.ok(existsSync(join(root, b.path)), b.path);
});

test('default brand is valid DTCG and resolves', () => {
  assert.deepEqual(validateResolver(brand).errors, []);
  assert.doesNotThrow(() => resolve(brand));
});

test('default brand has every role', () => {
  const tokens = resolve(brand);
  for (const role of ROLES)
    assert.ok(
      [...tokens.keys()].some((k) => k.startsWith(`color.${role}.`)),
      role,
    );
});

test('default brand passes every required contrast pair in light and dark', () => {
  const failing = checkContrast(brand).filter((r) => !r.pass);
  assert.deepEqual(failing, []);
  assert.deepEqual([...new Set(checkContrast(brand).map((r) => r.context))], ['light', 'dark']);
});

test('default brand assets all resolve from the library', () => {
  const meta = brandMeta(brand, V);
  assert.deepEqual(
    meta.assetGroups.map((g) => g.id),
    ['logos', 'favicons', 'icons'],
  );
  assert.deepEqual(missingAssets(meta, { session: new Map(), library: new Set(manifest.files) }), []);
  assert.ok(meta.fontFiles.length > 0 && meta.fontFiles.every((f) => f.provider === 'fontsource'));
});
