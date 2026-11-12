Style Guide Template
=========

A hosted style guide that is also its own editor and a live preview of a brand. A brand is one [W3C Design Tokens](https://www.designtokens.org/tr/2025.10/) (DTCG 2025.10) resolver file: load it and the whole page is styled by its colors, fonts, scales and assets, in light and dark. Edit it in the browser, save the JSON, or export a brand kit ZIP.

Everything runs in the browser. There is no backend.

## Run it

```
pnpm install
pnpm dev             # http://localhost:8000
```

- `pnpm test`: unit tests (Node's built-in test runner)
- `pnpm build:css`: compile `scss/style-guide.scss` to `css/style-guide.css`
- `pnpm vendor`: refresh the vendored `fflate` ZIP library in `js/vendor/`

Set the site's address in `js/config.js` (`HOSTED_URL`). The README in every exported kit links there, and the brand file's `$extensions` key is derived from it (`https://styleguide.example.com` becomes `com.example.styleguide`).

## Using the site

- **Load:** drop a `.resolver.json`, a `.tokens.json` or a brand kit ZIP anywhere on the page, or use Load. Fonts and other files can be dropped too.
- **Edit:** palette (11 OKLCH shades per hue, with CMYK and Pantone), roles per theme, fonts and text styles, spacing / radius / font-size scales, shadows, and asset groups.
- **Fonts:** pick from [Fontsource](https://fontsource.org) (no API key), upload font files, or use the library.
- **Save JSON** downloads the brand file. **Export ZIP** downloads the kit: the brand file, `css/theme.css`, fonts with their licenses, and one folder per asset group.
- Edits are kept in the browser (localStorage and IndexedDB) until you clear the draft.
- The Contrast panel checks every role's text against its background, and input and focus borders against the page, in both themes. Failures are warnings.

## The brand file

One DTCG 2025.10 resolver document with the tokens inline:

- `color.<hue>.<50..950>`: the palette; `color.<role>.<background|foreground|border>[-hover|-active]`: the roles (`primary`, `secondary`, `destructive`, `success`, `warning`, `info`, `page`, `card`, `muted`, `input`, `focus`)
- `spacing`, `radius`, `font-size`: generated scales; the generator lives in the group's `$extensions`
- `font`, `typography`, `shadow`, `duration`
- a `theme` modifier with `light` and `dark` contexts
- logos, icons, other asset groups and font files in the `foundation` set's `$extensions`

CSS custom properties are the token path joined with `-`: `color.primary.background` becomes `--color-primary-background`. Dark values apply under `:root[data-theme="dark"]`.

The full design is in `docs/superpowers/specs/2026-11-12-styleguide-editor-design.md`.

## For maintainers: the library

Files under `library/` are offered to every user of the site. To add some:

1. Put the files under `library/` (for example `library/logos/acme.svg`).
2. List each path in `library/manifest.json` under `files`.
3. To add a brand preset, put its resolver file in `library/brands/` and add `{ "name": ..., "path": "brands/..." }` under `brands`. The first brand is the one a new visitor sees.

`pnpm test` checks that the manifest matches the files on disk and that every preset is valid, resolves, and passes contrast.

## Credits

Based on the [CodyHouse Style Guide Template](http://codyhouse.co/gem/css-style-guide-template/) ([Terms](http://codyhouse.co/terms/)).

Icons by [Petras Nargela](https://dribbble.com/petrasnargela), available for free download on [Freebiesbug](http://freebiesbug.com/psd-freebies/80-stroke-icons-psd-ai-webfont/). Interface icons from [Lucide](https://lucide.dev).
