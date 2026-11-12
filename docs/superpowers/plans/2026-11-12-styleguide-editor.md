# Style Guide Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the CodyHouse style guide template into a hosted, browser-only style guide editor and live brand preview driven by one DTCG 2025.10 resolver file, with Fontsource fonts, open-ended asset groups and a brand kit ZIP export.

**Architecture:** Pure ES modules in `js/lib/` hold all logic (color, validation, resolution, scales, CSS generation, contrast, assets, fonts, IO) and run unchanged in Node for tests. DOM modules in `js/ui/` render the original page sections from state and host the editor. The original SCSS keeps its structure and selectors; its values become CSS custom properties generated from the brand file.

**Tech Stack:** Vanilla ES modules (no framework, no bundler), Dart Sass (`sass` npm), `fflate` (vendored) for ZIP, Node 26 `node --test`, IndexedDB + localStorage, Fontsource API.

**Spec:** `docs/superpowers/specs/2026-11-12-styleguide-editor-design.md`

## Global Constraints

- DTCG 2025.10 Format, Color and Resolver modules, followed completely. Resolver `version` is `"2025.10"`, `$schema` is `https://www.designtokens.org/schemas/2025.10/resolver.json`.
- CSS names: token path joined with `-` (`color.primary.background` -> `--color-primary-background`); `$root` drops out of the name.
- Output on `:root`; modifier contexts as `:root[data-<modifier>="<context>"]`; theme toggle sets `data-theme` on `<html>`.
- Colors stored as `{ "colorSpace": "oklch", "components": [L, C, H], "hex": "#rrggbb" }`, `alpha` omitted when 1.
- Shade scale: 11 shades `50,100,200,...,900,950`, L from 0.97 (50) to 0.15 (950), constant chroma reduced only to fit sRGB.
- Roles: `primary, secondary, destructive, success, warning, info, page, card, muted, input, focus`; properties `background, foreground, border` and their `-hover` / `-active` variants.
- Vendor key: reverse-domain of `HOSTED_URL` from `js/config.js` (`https://styleguide.example.com` -> `com.example.styleguide`).
- Every asset `src` is a relative path.
- Contrast failures warn, never block.
- One new dependency: `fflate`, vendored to `js/vendor/fflate.js`. `sass` is a dev dependency only.
- House rules: no emoji anywhere; pickers use a Listbox (no native `<select>`); lucide icons as inline SVG with `currentColor`; mobile-first (`min-width` media queries only).
- Kept behaviors from `js/main.js`: mobile nav toggle, smooth scroll to section, active-section highlight, live typography labels, button code snippets.
- Plans and docs describe only what is built.

## Review Focus

1. **A brand file from another DTCG tool with tokens outside our roles** (e.g. `color.accent.$root`, a `color.brand-alt` hue, a `size` group). Expected: it validates, renders in a generic "Other tokens" list in its section, appears in the CSS, and round-trips unchanged. Test added to Task 6 and Task 11.
2. **An out-of-gamut oklch color** (e.g. `[0.7, 0.4, 150]`). Expected: hex is the clipped sRGB value, never `NaN` or 7+ digits; the oklch value is kept as entered. Test added to Task 1.
3. **Loading a file over unsaved edits.** Expected: the previous draft is kept as "Restore previous draft" until the next load. Test added to Task 10.
4. **Dropping files whose names collide** (two missing paths `logos/logo.svg` and `icons/logo.svg`, one dropped `logo.svg`). Expected: listed as ambiguous with both candidates, nothing silently assigned. Test added to Task 9.
5. **Storage quota exceeded when saving uploads** (large photos or video in an asset group). Expected: a visible warning naming the files that were not persisted; the session copy still works and still exports. Test added to Task 10.

---

## File Structure

```
package.json                     scripts: test, build:css, vendor, start
js/config.js                     HOSTED_URL
js/vendor/fflate.js              vendored fflate ESM build
js/lib/color.js                  color math
js/lib/vendor-key.js             vendor key derivation
js/lib/schema.js                 DTCG validation, plain tokens -> resolver
js/lib/resolver.js               resolution order, aliases, $ref
js/lib/scale.js                  scale generation
js/lib/css.js                    CSS generation
js/lib/contrast.js               required pairs + checks
js/lib/fontsource.js             Fontsource API client and parsing
js/lib/fonts.js                  @font-face rules, FontFace registration
js/lib/assets.js                 asset resolution, missing list, drop matching
js/lib/state.js                  store, autosave, previous draft, file persistence
js/lib/io.js                     load JSON / ZIP / files, save JSON, export ZIP, README
js/ui/listbox.js                 Listbox component
js/ui/render.js                  sections from state
js/ui/editor.js                  edit drawer forms
js/ui/panels.js                  contrast, missing assets, warnings panels
js/ui/fontsource-picker.js       Fontsource search picker
js/main.js                       bootstrap + ported behaviors (replaces jQuery version)
library/manifest.json            library file list + brand presets
library/brands/default.resolver.json
library/logos/ library/favicons/ library/icons/   moved from assets/
scss/style-guide.scss, partials/_basic-style.scss, partials/_layout.scss   migrated
index.html                       migrated
tests/*.test.js, tests/fixtures/
```

Removed: `js/jquery-2.1.1.js`, `js/modernizr.js`, `assets/assets-download-file.zip`, `assets/branding/`, `assets/icons/`, `assets/logo.svg` (moved to `library/`).

---

### Task 0: Branch, tooling, config

**Files:**
- Create: `package.json`, `.gitignore`, `js/config.js`, `js/vendor/fflate.js`, `tests/smoke.test.js`

**Interfaces:**
- Produces: `npm test` runs `node --test tests/`; `npm run build:css` runs `sass --no-source-map scss/style-guide.scss css/style-guide.css`; `npm run vendor` copies `node_modules/fflate/esm/browser.js` to `js/vendor/fflate.js`; `npm start` runs `python3 -m http.server 8000`. `js/config.js` exports `HOSTED_URL = 'https://styleguide.example.com'`.

- [ ] **Step 1:** `git switch -c feat/styleguide-editor`, then commit the spec and this plan: `git add docs && git commit -m "docs: style guide editor spec and plan"`.
- [ ] **Step 2:** Create `package.json` (`"type": "module"`, `"private": true`, the four scripts above), `npm i -D sass`, `npm i fflate`, `npm run vendor`. `.gitignore`: `node_modules/`.
- [ ] **Step 3:** Write `tests/smoke.test.js`: imports `{ zipSync, unzipSync }` from `../js/vendor/fflate.js`, zips `{ 'a.txt': new TextEncoder().encode('hi') }`, unzips, asserts the text is `'hi'`.
- [ ] **Step 4:** Run `npm test`. Expected: 1 pass.
- [ ] **Step 5:** Commit: `git add package.json package-lock.json .gitignore js/config.js js/vendor tests && git commit -m "chore: tooling, config, vendored fflate"`.

---

### Task 1: Color math

**Files:**
- Create: `js/lib/color.js`, `tests/color.test.js`

**Interfaces:**
- Produces:
  - `oklch(l: number, c: number, h: number, alpha = 1) -> DtcgColor` (fills `hex`; omits `alpha` when 1)
  - `toOklch(color: DtcgColor) -> [l, c, h, alpha]` (accepts `oklch` and `srgb` color spaces; `"none"` component -> 0)
  - `toSrgb(color: DtcgColor) -> { r, g, b, alpha }` (0..1, unclamped)
  - `inGamut(color) -> boolean`
  - `toHex(color) -> '#rrggbb'` (clamped)
  - `toRgbaString(color) -> 'rgba(r, g, b, a)'` (0..255 ints)
  - `toOklchString(color) -> 'oklch(L C H)'` or `'oklch(L C H / a)'`, components rounded to 4 decimals
  - `cmyk(color) -> [c, m, y, k]` (0..100 ints, naive from clamped sRGB)
  - `contrastRatio(a: DtcgColor, b: DtcgColor) -> number` (WCAG 2.2 relative luminance)
  - `shadeScale(h: number, c: number) -> Record<'50'|'100'|...|'950', DtcgColor>`

- [ ] **Step 1: Write failing tests**

```js
test('srgb red <-> oklch', () => {
  const red = { colorSpace: 'srgb', components: [1, 0, 0] };
  const [l, c, h] = toOklch(red);
  assert.ok(Math.abs(l - 0.62796) < 1e-4 && Math.abs(c - 0.25768) < 1e-4 && Math.abs(h - 29.2339) < 1e-2);
  assert.equal(toHex(oklch(l, c, h)), '#ff0000');
});
test('white and black', () => {
  assert.equal(toHex(oklch(1, 0, 0)), '#ffffff');
  assert.equal(toHex(oklch(0, 0, 0)), '#000000');
  assert.equal(contrastRatio(oklch(1, 0, 0), oklch(0, 0, 0)), 21);
});
test('contrast #777 on white is 4.48', () => {
  const grey = { colorSpace: 'srgb', components: [0x77/255, 0x77/255, 0x77/255] };
  assert.equal(contrastRatio(grey, oklch(1, 0, 0)).toFixed(2), '4.48');
});
test('out-of-gamut keeps oklch, hex is clipped', () => {
  const c = oklch(0.7, 0.4, 150);
  assert.equal(inGamut(c), false);
  assert.match(c.hex, /^#[0-9a-f]{6}$/);
  assert.deepEqual(c.components, [0.7, 0.4, 150]);
});
test('strings', () => {
  assert.equal(toOklchString(oklch(0.55, 0.18, 260)), 'oklch(0.55 0.18 260)');
  assert.equal(toOklchString(oklch(0.55, 0.18, 260, 0.5)), 'oklch(0.55 0.18 260 / 0.5)');
  assert.equal(toRgbaString({ colorSpace: 'srgb', components: [1, 0, 0] }), 'rgba(255, 0, 0, 1)');
  assert.deepEqual(cmyk({ colorSpace: 'srgb', components: [1, 0, 0] }), [0, 100, 100, 0]);
});
test('shade scale', () => {
  const s = shadeScale(260, 0.18);
  assert.deepEqual(Object.keys(s), ['50','100','200','300','400','500','600','700','800','900','950']);
  assert.equal(s['50'].components[0], 0.97);
  assert.equal(s['950'].components[0], 0.15);
  for (const v of Object.values(s)) assert.ok(inGamut(v));
});
```

- [ ] **Step 2:** Run `node --test tests/color.test.js`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement `js/lib/color.js`. OKLab matrices from Björn Ottosson's reference (oklab <-> linear sRGB), sRGB transfer function per IEC 61966-2-1. `shadeScale`: L interpolated linearly over the 11 indices from 0.97 to 0.15 (rounded to 4 decimals); for each shade, binary-search the largest chroma `<= c` that is `inGamut` (20 iterations).
- [ ] **Step 4:** Run `node --test tests/color.test.js`. Expected: all pass.
- [ ] **Step 5:** Commit `feat: color math`.

---

### Task 2: Vendor key

**Files:**
- Create: `js/lib/vendor-key.js`, `tests/vendor-key.test.js`

**Interfaces:**
- Produces: `vendorKey(url: string) -> string` (the reversed hostname).

- [ ] **Step 1: Failing tests**

```js
assert.equal(vendorKey('https://styleguide.example.com'), 'com.example.styleguide');
assert.equal(vendorKey('https://example.com/path'), 'com.example');
assert.equal(vendorKey('http://localhost:8000'), 'localhost');
```

- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement with `new URL(url).hostname.split('.').reverse().join('.')`.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat: vendor key`.

---

### Task 3: DTCG validation

**Files:**
- Create: `js/lib/schema.js`, `tests/schema.test.js`, `tests/fixtures/minimal.resolver.json`

**Interfaces:**
- Produces:
  - `validateResolver(doc: object) -> { ok: boolean, errors: { path: string, message: string }[] }`
  - `validateTokens(tree: object, path = '') -> errors[]`
  - `toResolver(json: object, name: string) -> object` (a plain tokens tree becomes `{ $schema, version: '2025.10', name, sets: { foundation: { sources: [json] } }, modifiers: { theme: { contexts: { light: [], dark: [] }, default: 'light' } }, resolutionOrder: [{ $ref: '#/sets/foundation' }, { $ref: '#/modifiers/theme' }] }`; a resolver is returned as-is)
  - `isResolver(json) -> boolean` (has `resolutionOrder`)

Checks: `version === '2025.10'`; `resolutionOrder` array of `$ref`s that point to existing sets / modifiers; set `sources` and context arrays contain objects; every token has a `$type` (own or inherited from the nearest group) from `color, dimension, fontFamily, fontWeight, duration, cubicBezier, number, strokeStyle, border, transition, shadow, gradient, typography`; value shapes for `color` (`colorSpace` in the 14 spec spaces, `components` array of number or `"none"`, `alpha` 0..1, `hex` `#rrggbb`), `dimension` (`value` number, `unit` `px|rem`), `duration` (`ms|s`), `fontFamily` (string or string[]), `fontWeight` (1..1000 or a spec keyword), `typography`, `shadow` (object or array); alias values (`{a.b}`) are accepted here and checked by Task 4. Error paths use dots (`sets.foundation.sources[0].color.primary.background`).

- [ ] **Step 1: Failing tests**

```js
test('minimal fixture is valid', () => assert.equal(validateResolver(fixture).ok, true));
test('wrong version', () => assert.match(validateResolver({ ...fixture, version: '1' }).errors[0].message, /2025\.10/));
test('missing $type', () => {
  const doc = withToken(fixture, ['spacing'], { x: { $value: { value: 1, unit: 'px' } } }, { dropGroupType: true });
  assert.ok(validateResolver(doc).errors.some(e => e.path.endsWith('spacing.x') && /\$type/.test(e.message)));
});
test('bad dimension unit', () => { /* unit 'em' -> error mentioning px|rem */ });
test('bad color space', () => { /* colorSpace 'cmyk' -> error */ });
test('plain tokens become resolver', () => {
  const r = toResolver({ color: { $type: 'color' } }, 'X');
  assert.equal(r.version, '2025.10');
  assert.deepEqual(Object.keys(r.modifiers.theme.contexts), ['light', 'dark']);
});
test('$type inherited from group is valid', () => { /* group $type color, token with only $value -> ok */ });
```

`withToken` is a small helper in the test file. The fixture is the spec's example with one shade, one role, one of each other type.

- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement. Recursive walk; a node with `$value` is a token; keys starting with `$` other than `$type, $value, $description, $extensions, $deprecated, $extends, $root` are errors.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat: DTCG validation`.

---

### Task 4: Resolver

**Files:**
- Create: `js/lib/resolver.js`, `tests/resolver.test.js`

**Interfaces:**
- Consumes: `validateResolver` (Task 3).
- Produces:
  - `contexts(doc) -> { modifier: string, context: string, isDefault: boolean }[]`
  - `defaultInputs(doc) -> Record<modifier, context>`
  - `mergedTree(doc, inputs) -> object` (deep merge of sources in `resolutionOrder`, later wins)
  - `flatten(tree) -> Map<path, { type, value, extensions, description }>` (`$type` inherited; `$root` path segment kept in the key, e.g. `color.accent.$root`)
  - `resolve(doc, inputs = defaultInputs(doc)) -> Map<path, { type, value, resolved, extensions }>` where `value` is the raw `$value` (aliases intact) and `resolved` has every alias and `$ref` replaced recursively (composite fields too)
  - `aliasTarget(value) -> string | null` (`'{a.b}'` -> `'a.b'`)
  - Throws `ResolveError { path, message }` for a missing alias target or a cycle.

- [ ] **Step 1: Failing tests**

```js
test('dark overrides light', () => {
  assert.equal(toHex(resolve(doc, { theme: 'dark' }).get('color.page.background').resolved), toHex(neutral950));
  assert.equal(toHex(resolve(doc).get('color.page.background').resolved), toHex(neutral50));
});
test('chained alias', () => { /* a -> b -> c resolves to c's value */ });
test('$ref pointer', () => {
  /* token value { $ref: '#/color/brand/600/$value' } resolves like '{color.brand.600}' */
});
test('composite alias', () => {
  assert.deepEqual(resolve(doc).get('typography.heading-1').resolved.fontSize, { value: 3.0518, unit: 'rem' });
});
test('cycle throws', () => assert.throws(() => resolve(cyclic), /cycle/i));
test('missing target throws with path', () => assert.throws(() => resolve(missing), e => e.path === 'color.primary.background'));
test('contexts', () => assert.deepEqual(contexts(doc).map(c => c.context), ['light', 'dark']));
```

- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement. `$ref` pointers resolve against the merged tree (RFC 6901, `~0` / `~1` unescaping).
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat: resolver`.

---

### Task 5: Scales

**Files:**
- Create: `js/lib/scale.js`, `tests/scale.test.js`

**Interfaces:**
- Produces:
  - `generateScale(gen: { base: Dimension, steps: Record<string, number>, ratio?: number }) -> Record<string, Dimension>`: linear `base.value * step`, or with `ratio` `base.value * ratio ** step`; values rounded to 4 decimals; unit from `base`.
  - `applyScale(group: object, vendor: string) -> object`: reads `group.$extensions[vendor].scale`, writes every step's `$value`, skipping tokens with `$extensions[vendor].overridden === true`; returns a new group.
  - `setStep(group, step, dimension, vendor) -> object`: sets the value and marks it overridden.

- [ ] **Step 1: Failing tests**

```js
const spacing = { base: { value: 4, unit: 'px' }, steps: { xs: 1, sm: 2, md: 4, lg: 6, xl: 8, '2xl': 12, '3xl': 16 } };
assert.deepEqual(generateScale(spacing).md, { value: 16, unit: 'px' });
assert.deepEqual(generateScale(spacing)['3xl'], { value: 64, unit: 'px' });
const type = { base: { value: 1, unit: 'rem' }, ratio: 1.25, steps: { xs: -2, md: 0, '4xl': 5 } };
assert.deepEqual(generateScale(type).xs, { value: 0.64, unit: 'rem' });
assert.deepEqual(generateScale(type)['4xl'], { value: 3.0518, unit: 'rem' });
// override survives regeneration
let g = applyScale(groupWith(spacing), V);
g = setStep(g, 'md', { value: 18, unit: 'px' }, V);
g.$extensions[V].scale.base.value = 8;
g = applyScale(g, V);
assert.deepEqual(g.md.$value, { value: 18, unit: 'px' });
assert.deepEqual(g.lg.$value, { value: 48, unit: 'px' });
```

- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat: scales`.

---

### Task 6: CSS generation

**Files:**
- Create: `js/lib/css.js`, `js/lib/fonts.js`, `tests/css.test.js`, `tests/fixtures/minimal.css`

**Interfaces:**
- Consumes: `resolve`, `contexts`, `defaultInputs` (Task 4); `toOklchString` (Task 1).
- Produces:
  - `cssName(path: string) -> string` (`color.accent.$root` -> `--color-accent`)
  - `cssValue(type, value) -> string` (aliases -> `var(--...)`; color -> `toOklchString`; dimension / duration -> `<value><unit>`; fontFamily -> names with spaces quoted, joined by `, `; fontWeight -> number or keyword; shadow -> `[inset ]x y blur spread color`, arrays joined by `, `; cubicBezier -> `cubic-bezier(...)`; number -> as is)
  - `cssDeclarations(tokens: Map) -> string[]` (typography expands to `-font-family`, `-font-size`, `-font-weight`, `-letter-spacing`, `-line-height`)
  - `generateCss(doc, { fontSrc: (entry) => string, vendor: string }) -> string`: `:root { ... }` for default inputs; for each non-default context, `:root[data-<modifier>="<context>"] { ... }` with only declarations whose text differs from the default; then `fontFaceRules`.
  - In `fonts.js`: `fontFaceRules(fontFiles, fontSrc) -> string` (one `@font-face` per entry: `font-family`, `font-weight`, `font-style`, `src: url(...) format('woff2'|'woff'|'truetype'|'opentype')` by extension, `unicode-range` when present, `font-display: swap`); `registerFonts(fontFiles, urlFor) -> Promise<{ failed: entry[] }>` (browser `FontFace`, untested in Node).

- [ ] **Step 1: Failing tests**

```js
assert.equal(cssName('color.primary.background'), '--color-primary-background');
assert.equal(cssName('color.accent.$root'), '--color-accent');
assert.equal(cssValue('color', '{color.brand.600}'), 'var(--color-brand-600)');
assert.equal(cssValue('dimension', { value: 16, unit: 'px' }), '16px');
assert.equal(cssValue('fontFamily', ['Open Sans', 'sans-serif']), '"Open Sans", sans-serif');
test('snapshot', () => assert.equal(generateCss(fixture, opts), readFileSync('tests/fixtures/minimal.css', 'utf8')));
test('dark block holds only differences', () => {
  const dark = generateCss(fixture, opts).split(':root[data-theme="dark"]')[1];
  assert.match(dark, /--color-page-background/);
  assert.doesNotMatch(dark, /--spacing-md/);
});
test('foreign tokens are emitted', () => { /* fixture plus color.accent.$root and size.huge -> --color-accent, --size-huge present */ });
test('font-face', () => assert.match(generateCss(fixture, opts), /@font-face \{[^}]*font-family: "Merriweather"[^}]*format\('woff2'\)/));
```

- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement; write `tests/fixtures/minimal.css` by hand from the fixture and check it line by line against the rules above before using it as the snapshot.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat: CSS generation`.

---

### Task 7: Contrast

**Files:**
- Create: `js/lib/contrast.js`, `tests/contrast.test.js`

**Interfaces:**
- Consumes: `resolve`, `contexts` (Task 4); `contrastRatio` (Task 1).
- Produces:
  - `ROLES = ['primary','secondary','destructive','success','warning','info','page','card','muted','input','focus']`
  - `requiredPairs(tokens: Map) -> { fg, bg, min, label }[]`: for each role with both, `color.<role>.foreground` on `color.<role>.background` (4.5); for `input` and `focus`, `color.<role>.border` on `color.page.background` (3).
  - `checkContrast(doc) -> { context: string, fg, bg, ratio: number, min: number, pass: boolean, label }[]` over every context of the `theme` modifier (ratio rounded to 2 decimals).

- [ ] **Step 1: Failing tests**: a doc whose primary is white on `#777777` gives one failing entry `{ ratio: 4.48, min: 4.5, pass: false }` in `light`; the same pair passing in `dark` after a dark override; missing roles produce no pairs.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat: contrast checks`.

---

### Task 8: Fontsource client

**Files:**
- Create: `js/lib/fontsource.js`, `tests/fontsource.test.js`, `tests/fixtures/fontsource-list.json` (first 20 entries of the live list), `tests/fixtures/fontsource-merriweather.json` (live detail)

**Interfaces:**
- Produces:
  - `API = 'https://api.fontsource.org/v1/fonts'`
  - `parseList(json) -> { id, family, category, weights, styles, defSubset, license }[]`
  - `fontEntries(detail, { weights: number[], styles: string[], subsets = [detail.defSubset] }) -> FontFile[]` where `FontFile = { family, weight, style, subset, unicodeRange, src: 'fonts/<id>-<subset>-<weight>-<style>.woff2', url, provider: 'fontsource', fontsourceId, version }`; only combinations present in `detail.variants`; `unicodeRange` from `detail.unicodeRange[subset]`.
  - `licenseUrl(id, version) -> 'https://cdn.jsdelivr.net/npm/@fontsource/<id>@<version>/LICENSE'`
  - `fileUrl(entry) -> string` (rebuilds the jsDelivr woff2 URL from `fontsourceId`, `version`, subset, weight, style: `https://cdn.jsdelivr.net/fontsource/fonts/<id>@<version>/<subset>-<weight>-<style>.woff2`)
  - `fetchList(fetchFn = fetch, storage = localStorage) -> Promise<list>` (cached under `styleguide:fontsource-list` with a timestamp; 24 h)
  - `fetchFont(id, fetchFn = fetch) -> Promise<detail>`

- [ ] **Step 1:** Record fixtures: `curl -s https://api.fontsource.org/v1/fonts | node -e "..."` (keep 20 entries) and `curl -s https://api.fontsource.org/v1/fonts/merriweather > tests/fixtures/fontsource-merriweather.json`.
- [ ] **Step 2: Failing tests**

```js
const e = fontEntries(detail, { weights: [400, 700], styles: ['normal'] });
assert.equal(e.length, 2);
assert.equal(e[0].src, 'fonts/merriweather-latin-400-normal.woff2');
assert.equal(e[0].url, detail.variants['400'].normal.latin.url.woff2);
assert.equal(fileUrl(e[0]), e[0].url);
assert.equal(fontEntries(detail, { weights: [950], styles: ['normal'] }).length, 0);
assert.equal(licenseUrl('merriweather', '5.3.0'), 'https://cdn.jsdelivr.net/npm/@fontsource/merriweather@5.3.0/LICENSE');
// cache: second call within 24h does not fetch
```

- [ ] **Step 3:** Run, expect FAIL.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run, expect PASS.
- [ ] **Step 6:** Commit `feat: Fontsource client`.

---

### Task 9: Assets

**Files:**
- Create: `js/lib/assets.js`, `tests/assets.test.js`

**Interfaces:**
- Consumes: `fileUrl` (Task 8).
- Produces:
  - `brandMeta(doc, vendor) -> { assetGroups, fontFiles }` (reads the foundation set's `$extensions`; if `vendor` is absent but exactly one other key has `assetGroups` or `fontFiles`, uses that one)
  - `withBrandMeta(doc, vendor, meta) -> doc` (writes under `vendor`, removes the foreign key it was read from, keeps every other extension)
  - `allSrcs(meta) -> { src, kind: 'asset'|'font', groupId? , entry }[]`
  - `resolveAsset(item, { session: Map<string, Blob|Uint8Array>, library: Set<string> }) -> { source: 'session'|'library'|'fontsource'|'missing', url?: string }` (library URL `library/<src>`; Fontsource only for font entries with `provider: 'fontsource'`; session URL created by the caller)
  - `missingAssets(meta, ctx) -> string[]`
  - `matchDropped(missing: string[], files: { name: string }[]) -> { matched: Map<src, file>, ambiguous: { name, candidates: string[] }[], unmatched: file[] }` (match by basename, case-insensitive)

- [ ] **Step 1: Failing tests**: resolution order session > library > fontsource > missing; `missingAssets` lists a src in neither; `matchDropped(['logos/logo.svg','icons/logo.svg'], [{ name: 'logo.svg' }])` returns `ambiguous[0].candidates` with both and an empty `matched`; `matchDropped(['logos/a.svg'], [{ name: 'A.SVG' }])` matches; `brandMeta` reads a doc saved under `com.other.site` and `withBrandMeta` moves it to the local key while a third-party `org.tool.x` extension stays.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat: asset resolution`.

---

### Task 10: State and persistence

**Files:**
- Create: `js/lib/state.js`, `tests/state.test.js`

**Interfaces:**
- Produces:
  - `createStore({ doc, storage, fileStore }) -> Store`
  - `Store.get() -> doc`, `Store.set(doc)`, `Store.update(fn: doc => doc)`, `Store.subscribe(fn) -> unsubscribe`, `Store.files: Map<string, Blob|Uint8Array>`
  - `Store.load(doc, files?: Map)`: moves the current draft to `styleguide:previous`, replaces doc and files, saves
  - `Store.restorePrevious() -> boolean`, `Store.hasPrevious() -> boolean`
  - `Store.clearDraft()`: removes `styleguide:draft`, resets to the last loaded or preset doc
  - `Store.addFiles(map) -> Promise<{ notPersisted: string[] }>`
  - Autosave writes `styleguide:draft` (JSON) on every change, debounced 300 ms (`Store.flush()` forces it, for tests).
  - `idbFileStore() -> { put(path, blob), getAll() -> Map, delete(path), clear() }` (IndexedDB database `styleguide`, store `files`; browser only). Node tests pass an in-memory `fileStore`.

- [ ] **Step 1: Failing tests**

```js
test('load keeps previous draft', () => {
  const s = createStore({ doc: a, storage: mem(), fileStore: memFiles() });
  s.update(d => edit(d)); s.flush();
  s.load(b);
  assert.equal(s.hasPrevious(), true);
  s.restorePrevious();
  assert.deepEqual(s.get(), edit(a));
});
test('quota exceeded is reported, file still in session', async () => {
  const s = createStore({ doc: a, storage: mem(), fileStore: quotaFiles() }); // put() rejects with QuotaExceededError
  const r = await s.addFiles(new Map([['photos/big.jpg', bytes]]));
  assert.deepEqual(r.notPersisted, ['photos/big.jpg']);
  assert.ok(s.files.has('photos/big.jpg'));
});
test('subscribers notified', () => { /* set -> fn called with new doc */ });
```

- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat: state and persistence`.

---

### Task 11: IO: load, save, export

**Files:**
- Create: `js/lib/io.js`, `tests/io.test.js`

**Interfaces:**
- Consumes: `validateResolver`, `toResolver`, `isResolver` (Task 3); `generateCss` (Task 6); `checkContrast` (Task 7); `licenseUrl`, `fileUrl` (Task 8); `brandMeta`, `withBrandMeta`, `allSrcs`, `resolveAsset` (Task 9).
- Produces:
  - `classify(name: string) -> 'resolver'|'tokens'|'zip'|'font'|'image'|'file'` (`.resolver.json`; `.tokens.json`, `.tokens`, other `.json`; `.zip`; `.woff2 .woff .ttf .otf`; `.png .jpg .jpeg .gif .svg .webp .avif .ico`)
  - `parseBrandJson(text, name) -> { doc, errors }` (JSON parse errors and `validateResolver` errors, both with paths)
  - `loadZip(bytes: Uint8Array) -> { doc, files: Map<string, Uint8Array>, errors }` (the root-level `*.resolver.json`, else `*.tokens.json`; `README.md`, `css/` excluded from files)
  - `saveJson(doc) -> string` (2-space indent, trailing newline)
  - `slug(name) -> string`
  - `exportLayout(meta) -> Map<oldSrc, newSrc>` (assets -> `<group-id>/<basename>`, fonts -> `fonts/<basename>`, duplicate basenames in one folder get `-2`, `-3`)
  - `buildExport(doc, { vendor, files, library, fetchBytes: (url) => Promise<Uint8Array>, hostedUrl }) -> Promise<{ zip: Uint8Array, warnings: string[] }>`: rewrites `src`s, writes `<slug>.resolver.json`, `css/theme.css` (`fontSrc` = `../` + new src), all referenced files, Fontsource files and each font's `LICENSE` as `fonts/<id>-LICENSE.txt`, and `README.md`
  - `readme(doc, { hostedUrl, contrast, missing, failedDownloads }) -> string`: brand name; "View this brand at <hostedUrl>: open the site and drop this ZIP or `<slug>.resolver.json` onto the page."; a contrast table (context, pair, ratio, minimum, pass / warning); missing and failed lists when non-empty.

- [ ] **Step 1: Failing tests**

```js
test('round trip', async () => {
  const { zip } = await buildExport(doc, ctx);
  const back = loadZip(zip);
  assert.deepEqual(back.errors, []);
  assert.deepEqual(resolve(back.doc), resolve(doc));
  assert.deepEqual(brandMeta(back.doc, V).assetGroups.map(g => g.id), brandMeta(doc, V).assetGroups.map(g => g.id));
  assert.ok(back.files.has('patterns/dots.svg'));
});
test('zip contents', async () => {
  const names = Object.keys(unzipSync((await buildExport(doc, ctx)).zip));
  for (const n of ['README.md', 'css/theme.css', 'brand-name.resolver.json', 'fonts/merriweather-latin-700-normal.woff2', 'fonts/merriweather-LICENSE.txt']) assert.ok(names.includes(n), n);
});
test('foreign tokens and extensions round-trip unchanged', async () => { /* doc with color.accent.$root and org.tool.x extension */ });
test('failed download is a warning in README, not an error', async () => { /* fetchBytes rejects for one font */ });
test('contrast warnings listed in README', async () => { /* failing pair -> README contains 'warning' row */ });
test('invalid JSON reports position', () => assert.match(parseBrandJson('{', 'x.json').errors[0].message, /JSON/));
test('classify', () => { assert.equal(classify('a.resolver.json'), 'resolver'); assert.equal(classify('a.WOFF2'), 'font'); assert.equal(classify('deck.pdf'), 'file'); });
```

`ctx.fetchBytes` is a stub returning fixed bytes per URL.

- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement with `zipSync` / `unzipSync` from `../vendor/fflate.js`.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat: load, save, export`.

---

### Task 12: Library and default brand

**Files:**
- Move: `assets/branding/logo-ver-1.jpg`, `logo-ver-2.jpg` -> `library/logos/`; `assets/branding/favicon-*.jpg`, `touch-icon-*.jpg` -> `library/favicons/`; `assets/icons/icon-1..8.svg` -> `library/icons/`; `assets/logo.svg` -> `library/logos/codyhouse.svg`
- Delete: `assets/assets-download-file.zip`
- Create: `library/manifest.json`, `library/brands/default.resolver.json`, `tests/library.test.js`

**Interfaces:**
- Produces: `library/manifest.json` = `{ "files": [<every path under library/ except brands/ and manifest.json>], "brands": [{ "name": "Default", "path": "brands/default.resolver.json" }] }`. The default brand is the template's original look: brand hue from `#5f8ee4` (Cornflower Blue), neutral from `#19191a`, destructive from `#e4655f`, success from `#6fce72`; fonts Merriweather (body, matching the original `$primary-font`) and Open Sans (headings) via Fontsource, weights 300 / 400 / 700; spacing, radius and font-size scales with the spec's generators; asset groups `logos`, `favicons`, `icons` with the moved files; `light` and `dark` contexts.

- [ ] **Step 1: Failing test** (`tests/library.test.js`): every `manifest.files` path exists on disk and every file under `library/` (except brands and the manifest) is listed; `validateResolver(default)` is ok; `checkContrast(default).filter(r => !r.pass)` is empty in both contexts; `missingAssets` for the default with `library` = manifest files is empty; all eleven roles exist.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Move the files with `git mv`, write the manifest, and build the default brand: shades from `shadeScale(h, c)` of each source color's oklch, roles aliased to shades, chosen so that every required pair passes.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit `feat: library and default brand`.

---

### Task 13: SCSS migration

**Files:**
- Modify: `scss/style-guide.scss`, `partials/_basic-style.scss`, `partials/_layout.scss`
- Generated: `css/style-guide.css`

**Interfaces:**
- Consumes: CSS names from Task 6 and the default brand (Task 12).

- [ ] **Step 1:** Remove `@import 'bourbon'`; replace `@include user-select(none)`, `transform(...)`, `appearance(none)`, `box-sizing(...)` with the plain properties.
- [ ] **Step 2:** Replace the color variables. Mapping: `$color-1` -> `var(--color-primary-background)` (backgrounds) / `var(--color-primary-border)` (borders, rings); `$color-2` -> `var(--color-page-foreground)` for text, `var(--color-secondary-background)` for the header and nav; `$color-4` -> `var(--color-card-border)`; `$color-5` -> `var(--color-page-background)` for surfaces, `var(--color-primary-foreground)` for text on primary; `$success` -> `var(--color-success-*)`; `$alert` -> `var(--color-destructive-*)`. Each `lighten()` / `darken()` becomes the matching `-hover` / `-active` token or `var(--color-muted-foreground)` for the lighter text shades. `rgba($x, .2)` glows become `var(--shadow-*)` or the focus role. Delete the `$color-*`, `$success`, `$alert`, `$primary-font`, `$secondary-font` variables.
- [ ] **Step 3:** Fonts: `$primary-font` -> `var(--font-body)`, `$secondary-font` -> `var(--font-heading)`.
- [ ] **Step 4:** Remove `html { font-size: 62.5% }` so 1rem is 16px, as in exported kits. Font sizes become scale tokens: `1.2rem` -> `--font-size-sm`, `1.4rem` and `1.6rem` -> `--font-size-md`, `1.8rem` -> `--font-size-lg`, `2.4rem` and `2.6rem` -> `--font-size-xl`, `3.2rem` -> `--font-size-2xl`, `4rem` -> `--font-size-3xl`. Paddings, margins and gaps become the nearest `--spacing-*`; radii `--radius-*`; shadows `--shadow-*`; transition timings `--duration-*`. Media-query breakpoints in `_layout.scss` and fixed artwork sizes (logo box width, icon size) keep their px with a `// ds-allow-hardcode: <reason>` comment.
- [ ] **Step 5:** Modernizr hooks: `.no-touch &:hover` -> `@media (hover: hover) { &:hover { ... } }`; `.no-js` uses removed.
- [ ] **Step 6:** Delete the `.cd-icon-1` ... `.cd-icon-8` background-image rules (icons are rendered from the `icons` group in Task 14) and the native `select` / `.cd-select` rules (replaced by the Listbox in Task 15).
- [ ] **Step 7:** Add styles for the new UI: header actions, theme toggle, edit drawer, Listbox, contrast / missing / warnings panels, drop overlay, file cards, swatch scale rows, scale visualizations (spacing bars, radius boxes, shadow cards), CSS Variables code block, focus-visible rings from `--color-focus-border`. Mobile base, `MQ()` for wider.
- [ ] **Step 8:** Run `npm run build:css`. Expected: exit 0, no deprecation warnings.
- [ ] **Step 9:** Run `python3 ~/.claude/plugins/cache/ux-ui-agent-skills/ux-ui-agent-skills/2.9.8/scripts/lint_hardcodes.py scss partials`. Expected: `PASS` (today: 82 violations).
- [ ] **Step 10:** Commit `refactor: SCSS on tokens`.

---

### Task 14: Page rendering and ported behaviors

**Files:**
- Modify: `index.html`, `js/main.js` (rewritten as an ES module)
- Create: `js/ui/render.js`
- Delete: `js/jquery-2.1.1.js`, `js/modernizr.js`

**Interfaces:**
- Consumes: `createStore`, `idbFileStore` (Task 10); `generateCss` (Task 6); `resolve` (Task 4); `brandMeta`, `resolveAsset` (Task 9); `toHex`, `toRgbaString`, `toOklchString`, `cmyk` (Task 1); `registerFonts` (Task 6); `HOSTED_URL` (Task 0); `vendorKey` (Task 2).
- Produces: `render(root: HTMLElement, { doc, files, library, vendor }) -> void` renders every section and the nav; `objectUrl(path, bytes) -> string` cache that revokes stale URLs; a single `<style id="brand-css">` holding `generateCss` output.

- [ ] **Step 1:** `index.html`: remove the Google Fonts link, Modernizr and jQuery scripts; load `css/reset.css`, `css/style-guide.css` and `<script type="module" src="js/main.js">`; keep the header, nav and section markup as containers (`<section id="branding" class="cd-branding">` etc.) with their content generated; add the header actions (theme toggle, Edit, Load, Save JSON, Export ZIP) as buttons with lucide inline SVGs; replace the static "Download assets" link with Export ZIP; add empty containers for the new sections (`#css-variables`, `#spacing`, `#radius`, `#shadow`) and for custom groups.
- [ ] **Step 2:** `render.js` sections, per the spec's Page section:
  - Branding: `logos` and `favicons` groups; Icons: `icons` group as `<img>` in the existing `.cd-icons` boxes.
  - Colors: one row per palette hue (11 swatches, each labelled with hex, rgba, oklch, CMYK (computed value marked "approx." unless set) and Pantone if set), then each role with its properties and the shade it aliases; tokens in `color` outside hues and roles under "Other tokens".
  - Typography: font-size scale, each `typography` token rendered with its values, font specimens per loaded family / weight / style with file names.
  - Buttons: primary, secondary, destructive in default, hover, focus, active, disabled, loading (forced states via `data-state` attributes that the SCSS styles identically to the real pseudo-classes), plus the original code-snippet block generated from the buttons' markup.
  - Form: inputs (default, success, error), radio, checkbox, Listbox (from Task 15).
  - Spacing, Radius, Shadow: each token visualized with name and value; CSS Variables: `<pre><code>` of the generated CSS with a Copy button.
  - One section per custom asset group (nav link added): images inline, other files as a card with name, type, size and a download link; `missing` sources as a placeholder showing the path.
- [ ] **Step 3:** `main.js`: bootstrap (store from the saved draft, else the default brand from `library/brands/default.resolver.json`), subscribe `render`, apply `data-theme` from the toggle, and port the kept behaviors from the jQuery version: mobile nav toggle on `.cd-nav-trigger` (`nav-is-visible` on `header`), smooth scroll (`scrollTo({ top, behavior: 'smooth' })` with the same header-height and margin offset), active section highlight on scroll (`IntersectionObserver` or the same offset math, `selected` class), typography labels (`<weight> <family> <size>px` from `getComputedStyle`, updated on resize and on every render).
- [ ] **Step 4:** Run `npm start`, open `http://localhost:8000`. Expected: the default brand renders in every section, light and dark, with no console errors. (Render gates in Task 16.)
- [ ] **Step 5:** Run `python3 .../check_no_emoji.py` over `index.html js scss partials`. Expected: PASS.
- [ ] **Step 6:** Commit `feat: page rendered from the brand file`.

---

### Task 15: Editor, panels, Fontsource picker, drag and drop

**Files:**
- Create: `js/ui/listbox.js`, `js/ui/editor.js`, `js/ui/panels.js`, `js/ui/fontsource-picker.js`
- Modify: `js/main.js`

**Interfaces:**
- Consumes: everything from Tasks 1-11.
- Produces:
  - `listbox(el, { label, options: { value, label }[], value, onChange, typeahead = true }) -> { set(value), destroy() }`: kit Listbox pattern (button trigger with `aria-haspopup="listbox"` and `aria-expanded`, popup `role="listbox"`, `aria-activedescendant`, arrows / Home / End / typeahead / Enter / Escape, focus returns to the trigger).
  - `openEditor(store, ctx)`: drawer (`role="dialog"`, focus trapped, Escape closes) with areas: Palette (add hue from any CSS color, regenerate, per-shade override, CMYK / Pantone fields), Roles (each property: shade Listbox or a custom color), Fonts and type (font tokens, typography tokens, Fontsource picker, upload), Scales (base, ratio, steps, per-step override), Shadow, Assets (add / rename / reorder / remove groups; add files by upload or from the library).
  - `renderPanels(root, { contrast, missing, warnings, store })`: contrast table per context with pass / warning (icon plus text); missing assets with a drop zone that calls `matchDropped` and lists ambiguous matches with a Listbox to pick the target; warnings (schema errors, failed fonts, not-persisted files, failed downloads).
  - `fontsourcePicker(el, { onPick: (entries: FontFile[]) => void })`: search over `fetchList`, category filter, weights / styles checkboxes, subsets opt-in, shows the reason when the API is unreachable.
  - Drop anywhere: a full-page overlay on `dragenter`; files routed by `classify`: resolver / tokens -> `parseBrandJson` -> `store.load` (errors shown, state untouched on error), zip -> `loadZip` -> `store.load(doc, files)`, font -> font upload flow, image / file -> "add to group" Listbox.
  - Header actions: Load (file input, same routing), Save JSON (`saveJson` -> download `<slug>.resolver.json`), Export ZIP (`buildExport` -> download `<slug>-brand-kit.zip`, warnings shown), Start from (Listbox over `manifest.brands`), Restore previous draft (shown when `hasPrevious()`), Clear local draft.

- [ ] **Step 1:** Build `listbox.js`, then replace the Form section's select with it.
- [ ] **Step 2:** Build `panels.js` and wire the contrast, missing and warnings panels to every store change.
- [ ] **Step 3:** Build `fontsource-picker.js`; picked entries are added to `fontFiles` and registered with `registerFonts`.
- [ ] **Step 4:** Build `editor.js` areas one by one; every input writes through `store.update`, scales through `applyScale` / `setStep`, palette through `shadeScale`.
- [ ] **Step 5:** Wire drag and drop and the header actions in `main.js`.
- [ ] **Step 6:** Manual check in the browser: load the default, change the brand hue (page re-themes), add a Fontsource font and use it for headings, add a custom group "Patterns" with an SVG and a PDF, export, clear the draft, drop the ZIP back in. Expected: identical page; the README in the ZIP has the hosted URL and contrast table.
- [ ] **Step 7:** Run `npm test` and the emoji and hardcode lints. Expected: all pass.
- [ ] **Step 8:** Commit `feat: editor, panels, Fontsource picker, drag and drop`.

---

### Task 16: Render gates and README

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** `npx playwright install chrome`.
- [ ] **Step 2:** With `npm start` running, and `K=~/.claude/plugins/cache/ux-ui-agent-skills/ux-ui-agent-skills/2.9.8/scripts`, run with `DS_REQUIRE_BROWSER=1`: `node $K/verify_states.mjs index.html`, `node $K/verify_states.mjs index.html --dark`, `node $K/axe_audit.mjs index.html`, `node $K/verify_responsive.mjs index.html`, `node $K/verify_mobile_first.mjs index.html`, `node $K/verify_keyboard.mjs index.html`, `node $K/verify_focustrap.mjs index.html`. Expected: every gate passes; fix and re-run until green. Report the real output lines.
- [ ] **Step 3:** Screenshot the page in light and dark at 320 px and 1280 px, with the drawer open and closed, and look at each.
- [ ] **Step 4:** Rewrite `README.md`: what the site is, `npm install`, `npm start`, `npm test`, `npm run build:css`, setting `HOSTED_URL` in `js/config.js`, how maintainers add library files and brand presets (files under `library/`, entries in `library/manifest.json`), the brand file format (link to the DTCG 2025.10 specs and the spec doc), keep the original credits.
- [ ] **Step 5:** Commit `docs: README; verify render gates`.
