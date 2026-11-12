import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { brandMeta } from '../src/lib/assets.js';
import type { ResolverDoc } from '../src/lib/types.js';
import { deriveView, type ViewSession } from '../src/vue/view.js';

const preset = JSON.parse(
  readFileSync(new URL('../public/library/brands/default.resolver.json', import.meta.url), 'utf8'),
) as ResolverDoc;
const vendor = 'com.example.styleguide';
const ctx = { session: new Map(), library: new Set<string>() };

function fixture(doc: ResolverDoc) {
  let current = doc;
  let recovered = false;
  const session = {
    get doc() {
      return current;
    },
    preset,
    vendor,
    ctx,
    get meta() {
      return brandMeta(current, vendor);
    },
    fallBack() {
      recovered = true;
      current = preset;
    },
  } satisfies ViewSession;
  return {
    session,
    get recovered() {
      return recovered;
    },
  };
}

test('derives tokens and brand CSS from the same valid document and theme', () => {
  const state = fixture(preset);
  const view = deriveView(state.session, 'dark');
  assert.equal(state.recovered, false);
  assert.ok(view.tokens.size > 0);
  assert.ok(view.css.includes('--color-'));
  assert.deepEqual(
    view.meta.assetGroups.map((g) => g.id),
    ['logos', 'favicons', 'icons'],
  );
});

test('falls back to the preset when the current draft cannot resolve', () => {
  const state = fixture({ ...preset, resolutionOrder: [{ $ref: '#/sets/missing' }] });
  const view = deriveView(state.session, 'light');
  assert.equal(state.recovered, true);
  assert.ok(view.tokens.size > 0);
});
