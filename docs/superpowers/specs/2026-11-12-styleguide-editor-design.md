# Style Guide Editor: Design

Date: 2026-11-12
Status: draft, awaiting review

## Goal

Turn the CodyHouse style guide template into a hosted, data-driven style guide that is also its own editor and a live preview of the brand. A brand is one W3C Design Tokens (DTCG 2025.10) resolver document. Loading it configures the whole page; every section renders with the brand's own tokens, fonts and assets, in light and dark; editing re-renders immediately; exporting writes a brand kit ZIP computed once from the current state.

Keep the original code where possible: same page, same sections, same SCSS structure, same nav/scroll/typography behaviors.

## Decisions (agreed)

| Topic | Decision |
|---|---|
| Who edits | Both: brand files in the repo are the source of truth; the browser can edit and download a changed copy |
| Standard | DTCG 2025.10: Format, Color and Resolver modules, followed completely |
| Brand file | One `<name>.resolver.json` with tokens inline |
| Token structure | Category first: `color`, `spacing`, `radius`, `font`, `font-size`, `typography`, `shadow`, `duration` |
| CSS names | Token path joined with `-`: `--color-primary-background`, `--spacing-md`, `--radius-lg` |
| Scales | Spacing, radius and font-size are generated scales (base + steps / ratio), each step editable |
| Color storage | DTCG color objects in `oklch`, with the `hex` fallback filled in. hex / rgba / oklch shown in the guide are derived. CMYK and Pantone optional, hand-entered, in token `$extensions`. CMYK prefilled with a computed approximation until set |
| Light / dark | A resolver modifier `theme` with contexts `light` (default) and `dark` |
| CSS output | Plain CSS custom properties on `:root`, modifier contexts as `:root[data-<modifier>="<context>"]` |
| Vendor key | The site's origin in reverse-domain form (`https://styleguide.example.com` -> `com.example.styleguide`), taken from the configured `HOSTED_URL` |
| Live | Every edit re-renders immediately |
| Fonts | Loadable into the site: Fontsource (search and pick from 2,100+ open-source fonts, including all of Google Fonts), upload, or the library; available to every font token immediately. Exported kits self-host every font |
| Assets | Open-ended asset groups. Users work entirely in the browser with the files they have (resolver / tokens JSON, ZIP, images, fonts, any file); uploads travel in the ZIP. The site's library is curated by the site maintainers and read-only to users |
| Export | Brand kit ZIP. README points at the hosted site |
| Contrast | Failing required pairs show as warnings in the page and in the export README |

## Data model: `<name>.resolver.json`

Spec: https://www.designtokens.org/tr/2025.10/format/, `/color/`, `/resolver/`.

```jsonc
{
  "$schema": "https://www.designtokens.org/schemas/2025.10/resolver.json",
  "version": "2025.10",
  "name": "Brand name",
  "sets": {
    "foundation": {
      "sources": [{
        "color": {
          "$type": "color",
          "brand": {
            "600": {
              "$value": { "colorSpace": "oklch", "components": [0.55, 0.18, 260], "hex": "#3f6fd1" },
              "$extensions": { "com.example.styleguide": { "cmyk": [70, 40, 0, 0], "pantone": "PANTONE 2727 C" } }
            }
          },
          "neutral": { },
          "primary": {
            "background":        { "$value": "{color.brand.600}" },
            "background-hover":  { "$value": "{color.brand.700}" },
            "background-active": { "$value": "{color.brand.800}" },
            "foreground":        { "$value": "{color.neutral.50}" }
          },
          "secondary": { }, "destructive": { }, "success": { }, "warning": { }, "info": { },
          "page": { }, "card": { }, "muted": { }, "input": { }, "focus": { }
        },
        "spacing": {
          "$type": "dimension",
          "$extensions": { "com.example.styleguide": { "scale": { "base": { "value": 4, "unit": "px" }, "steps": { "xs": 1, "sm": 2, "md": 4, "lg": 6, "xl": 8, "2xl": 12, "3xl": 16 } } } },
          "xs": { "$value": { "value": 4, "unit": "px" } },
          "md": { "$value": { "value": 16, "unit": "px" } }
        },
        "radius": {
          "$type": "dimension",
          "$extensions": { "com.example.styleguide": { "scale": { "base": { "value": 4, "unit": "px" }, "steps": { "none": 0, "sm": 1, "md": 2, "lg": 3, "xl": 4, "full": 9999 } } } },
          "md": { "$value": { "value": 8, "unit": "px" } }
        },
        "font": {
          "$type": "fontFamily",
          "heading": { "$value": ["Merriweather", "serif"] },
          "body":    { "$value": ["Open Sans", "sans-serif"] }
        },
        "font-size": {
          "$type": "dimension",
          "$extensions": { "com.example.styleguide": { "scale": { "base": { "value": 1, "unit": "rem" }, "ratio": 1.25, "steps": { "xs": -2, "sm": -1, "md": 0, "lg": 1, "xl": 2, "2xl": 3, "3xl": 4, "4xl": 5 } } } },
          "md": { "$value": { "value": 1, "unit": "rem" } }
        },
        "typography": {
          "$type": "typography",
          "heading-1": { "$value": {
            "fontFamily": "{font.heading}", "fontSize": "{font-size.4xl}",
            "fontWeight": 700, "letterSpacing": { "value": 0, "unit": "px" }, "lineHeight": 1.2 } }
        },
        "shadow": { "$type": "shadow", "md": { "$value": {
          "color": "{color.neutral.900}", "offsetX": { "value": 0, "unit": "px" },
          "offsetY": { "value": 2, "unit": "px" }, "blur": { "value": 8, "unit": "px" },
          "spread": { "value": 0, "unit": "px" } } } },
        "duration": { "$type": "duration", "fast": { "$value": { "value": 150, "unit": "ms" } } }
      }],
      "$extensions": {
        "com.example.styleguide": {
          "assetGroups": [
            { "id": "logos",    "label": "Logos",    "items": [{ "label": "Primary", "src": "logos/primary.svg" }] },
            { "id": "favicons", "label": "Favicons", "items": [{ "label": "32px", "src": "favicons/favicon-32.png" }] },
            { "id": "icons",    "label": "Icons",    "items": [{ "label": "check", "src": "icons/check.svg" }] },
            { "id": "patterns", "label": "Patterns", "items": [{ "label": "Dots", "src": "patterns/dots.svg", "description": "Hero backgrounds" }] }
          ],
          "fontFiles": [{ "family": "Merriweather", "weight": 700, "style": "normal", "src": "fonts/merriweather-700.woff2", "provider": "fontsource", "fontsourceId": "merriweather", "version": "5.3.0" }]
        }
      }
    }
  },
  "modifiers": {
    "theme": {
      "contexts": {
        "light": [],
        "dark":  [{ "color": { "page": { "background": { "$type": "color", "$value": "{color.neutral.950}" } } } }]
      },
      "default": "light"
    }
  },
  "resolutionOrder": [{ "$ref": "#/sets/foundation" }, { "$ref": "#/modifiers/theme" }]
}
```

Rules:
- **Color** has two layers inside `color`. Palette: `color.<hue>.<shade>` (`brand`, `neutral`, plus any added hue), 11 shades 50 to 950. Roles: `color.<role>.<property>`, where properties are `background`, `foreground`, `border` and their `-hover` / `-active` variants. Roles: `primary`, `secondary`, `destructive`, `success`, `warning`, `info`, `page`, `card`, `muted`, `input`, `focus`. Roles alias palette shades; components use roles only.
- **Scales:** `spacing`, `radius` and `font-size` carry their generator in the group's `$extensions` (`base`, `steps`, and `ratio` for font-size: `base * ratio^step`). The tokens hold the computed values, so any DTCG tool reads them without the generator. Editing base or ratio regenerates the scale; a step edited by hand keeps its value and is marked overridden.
- Picking a brand color generates its 11-shade OKLCH scale (L 97% at 50 down to 15% at 950, constant chroma). Any shade can be overridden by hand.
- `$type` is set on the group wherever all children share it (DTCG inheritance).
- Aliases use `{path}`; `$ref` JSON Pointers are accepted on load as the spec requires.
- `dark` context overrides role tokens only.
- Brand metadata lives in `$extensions` on the `foundation` set under the vendor key. CMYK and Pantone use the same key on palette tokens.
- Every `src` is a relative path.
- Assets are open-ended: users add any number of asset groups (illustrations, patterns, photography, templates, ...) and any file type to a group. `logos`, `favicons` and `icons` are ordinary groups that the original sections render; each item has `label`, `src` and an optional `description`.
- Load also accepts a plain `.tokens.json` (no resolver): it is treated as the `foundation` set with only the `light` context.

## CSS generation

One generator, used by the page and by the export:

1. Resolve the document for each context of each modifier, following `resolutionOrder` (later wins).
2. Name each token by its path joined with `-` (`color.primary.background` -> `--color-primary-background`, `spacing.md` -> `--spacing-md`; `$root` drops out of the name).
3. Values: color -> `oklch(L C H / alpha)`; dimension -> `<value><unit>`; duration -> `<value><unit>`; fontFamily -> CSS font list; shadow -> `box-shadow` value; typography -> one property per field (`--typography-heading-1-font-size`, ...). Aliases become `var(--...)` so the cascade carries overrides.
4. Output `:root { ... }` for the default contexts, then `:root[data-theme="dark"] { ... }` holding only the tokens that differ. Generic: any modifier `m` with context `c` becomes `[data-m="c"]`.
5. `@font-face` rules from `fontFiles`.

## Contrast

Required pairs come from the role structure: for every role, `foreground` on `background` (4.5:1), and `border` on `page.background` for `input` and `focus` (3:1, WCAG 1.4.11). Checked in every `theme` context.

## Fonts

- Three sources, one result: each loaded font becomes `fontFiles` entries and `@font-face` rules immediately, and its family is offered in every `font` token picker.
  - **Fontsource:** a searchable picker (family, category, weights, styles) backed by the Fontsource API, which needs no key and allows browser calls. The family list comes from `https://api.fontsource.org/v1/fonts`; picking a family calls `https://api.fontsource.org/v1/fonts/<id>`, whose `variants` give woff2 URLs per weight, style and subset on jsDelivr. The picker loads the font's `defSubset` (usually `latin`); other subsets are opt-in. Entries are saved with `"provider": "fontsource"`, the `fontsourceId`, the font `version`, and a local `src` path.
  - **Upload:** woff2, woff, ttf, otf.
  - **Library:** fonts shipped in `library/`.
- The family list is cached in localStorage for a day.
- Export downloads every Fontsource font file into `fonts/` together with the font's own license file (`https://cdn.jsdelivr.net/npm/@fontsource/<id>@<version>/LICENSE`, which carries the font's copyright notice), so the kit is fully self-hosted and meets the OFL's redistribution terms.
- A Fonts area in the Typography section shows each loaded family as a specimen per weight and style, with its file names.
- Uploaded font files travel in the ZIP like any other asset.

## Asset resolution

One rule, used by the page and by the exporter:

1. Session files (from a loaded ZIP or single uploads), keyed by path.
2. Site library: `library/`, listed in `library/manifest.json`, maintained in the site's repo by its maintainers.
3. Font entries with `"provider": "fontsource"`: fetched from Fontsource by `fontsourceId`, `version`, weight and style.
4. None of these: a visible "missing asset" placeholder with the path.

The library also holds brand presets: `library/brands/*.resolver.json`. "Start from" a preset is how users switch between projects.

## Bringing files in

Everything a user does happens in the browser:
- **Drop anywhere** on the page, or use Load: a `.resolver.json` / `.tokens.json` replaces the brand; a ZIP replaces the brand and adds its files to the session; images, fonts and other files are added to the session and offered for the asset group or font they belong in.
- **Missing assets panel:** when a loaded file references paths that are neither in the session nor the library, the panel lists them. Dropping files there fills them by matching file name, so someone sent only the JSON can complete it with the files they were sent separately.
- Session files persist in IndexedDB alongside the localStorage draft, so a refresh keeps uploads.

## Page

The page is the preview: every section is styled by the loaded brand's tokens, fonts and assets, and the theme toggle previews light and dark. The original six sections stay (Branding, Colors, Typography, Buttons, Icons, Form), rendered from state instead of hardcoded markup. Branding renders the `logos` and `favicons` groups, Icons the `icons` group. Changes:

- **Colors:** palette scales with hex / rgba / oklch / CMYK / Pantone per shade, then each role with its properties and the shade each one points to.
- **Typography:** the font-size scale, each `typography` token rendered with its resolved values, and the Fonts specimens; the existing live font labels stay.
- **Buttons:** primary, secondary, destructive, each shown in every applicable state (default, hover, focus, active, disabled, loading). The existing code-snippet behavior stays.
- **New sections:** CSS Variables (the live generated CSS, copyable), Spacing, Radius, Shadow (each scale shown visually with its token name and value), and one section per custom asset group, added to the nav. Images preview inline; other files show as a file card (name, type, size); every item downloads.
- **Header:** light / dark toggle (sets `data-theme` on `<html>`), Edit toggle, Load, Save JSON, Export ZIP.
- **Contrast panel:** the required pairs in every `theme` context, pass / fail, live.
- **Edit mode:** a drawer with forms per area (palette, roles, fonts and type, scales, shadow, assets: add / rename / reorder / remove groups, add files to a group by upload or from the library).
- Editor UI follows house rules: pickers use the kit's Listbox pattern, lucide icons as inline SVG, mobile-first.

## Styles

- SCSS keeps its files, structure and selectors. Values become `var(--...)` role, scale and font tokens.
- `lighten()` / `darken()` calls are replaced by the matching state tokens (`-hover`, `-active`).
- `MQ()` (already min-width) and the grid mixin stay. Bourbon is removed. The `http://` Google Fonts link is removed; fonts come from the generated `@font-face` rules.
- Build: `sass` via npm, output to `css/style-guide.css` as today.

## Scripts

Vanilla ES modules. jQuery and Modernizr removed; the behaviors in `js/main.js` (mobile nav, smooth scroll, active section, typography labels, button snippets) are ported as-is.

| Module | Job |
|---|---|
| `state.js` | holds the resolver document; notifies on change; autosaves the document to localStorage and session files to IndexedDB |
| `schema.js` | validates loaded files against DTCG 2025.10 (trust boundary): types, value shapes, alias targets, circular references, resolver structure; readable errors |
| `resolver.js` | applies `resolutionOrder` for a chosen set of modifier inputs; resolves `{}` aliases and `$ref` pointers |
| `css.js` | the CSS generation above |
| `scale.js` | spacing / radius / font-size generation from `base`, `steps`, `ratio`; keeps hand overrides |
| `color.js` | conversions between DTCG color spaces used here (oklch, srgb) and hex / rgba; approximate CMYK; 11-shade generation; WCAG contrast ratio |
| `fonts.js` | registers loaded font files (`FontFace` API) and builds `@font-face` rules |
| `fontsource.js` | family list (cached), file URLs per variant, license fetch |
| `assets.js` | the resolution rule |
| `render.js` | state -> DOM; injects generated CSS into one `<style>` |
| `io.js` | load resolver / tokens JSON, ZIP, single files (drop anywhere or Load); missing-file matching by name; save JSON; export ZIP |

One new dependency: `fflate` for ZIP read / write, vendored.

## Export ZIP

```
<brand-name>-brand-kit.zip
  README.md                  brand summary, contrast results, "view at <HOSTED_URL>: load this zip or the resolver file"
  <name>.resolver.json       src paths rewritten to the bundle layout
  css/theme.css              generated CSS + @font-face
  fonts/                     every font file, plus license files for Fontsource fonts
  <group-id>/ ...            one folder per asset group
```

- Only assets the brand references are included, from the library or uploads.
- Round trip: loading the exported ZIP reproduces the same state.
- `HOSTED_URL` is the one config value in the repo; the vendor key derives from it.

## Error handling

- Invalid file or schema errors: show what and where; keep the current state untouched.
- Unknown `$extensions` from other tools are preserved through load, edit and save (DTCG requirement).
- A file whose styleguide extensions use a different vendor key (saved from another origin) loads with that key's data and is saved under this site's key.
- Missing asset: placeholder, listed in a warnings area; export still works and the README lists missing files.
- A font file the browser cannot parse: named in the warnings area; the family falls back to the rest of its font list.
- Fontsource unreachable: the picker shows the reason; uploaded and library fonts keep working; export names any font it could not download.
- "Clear local draft" resets to the loaded or preset brand.

## Testing

Browser-free (CI and local):
- `node --test`: color conversions against known values, shade generation, scale generation with overrides, contrast ratio, resolver order and alias resolution (including `$ref` and chained aliases), circular-reference errors, CSS generation snapshots (names and values), vendor key derivation and foreign-key load, Fontsource response parsing and variant selection (against a recorded API response), foreign `$extensions` preserved, export -> load round trip.
- `lint_hardcodes.py`, `check_no_emoji.py` on the site code.

Render gates (need `npm install && npx playwright install chrome`; not installed today, so unmeasured until then): `verify_states.mjs` (light and dark), axe, `verify_responsive.mjs` at 280 / 320 / 414, `verify_mobile_first.mjs`, plus screenshots of both themes.
