#!/bin/sh
# Copies the browser libraries into js/vendor/ as single ES modules (the site has no build step).
set -e
cd "$(dirname "$0")/.."
mkdir -p js/vendor
cp node_modules/fflate/esm/browser.js js/vendor/fflate.js
{ echo '/*! culori (MIT) https://culorijs.org */'; cat node_modules/culori/bundled/culori.min.mjs; } > js/vendor/culori.js
{ echo '/*! idb-keyval (Apache-2.0) https://github.com/jakearchibald/idb-keyval */'; cat node_modules/idb-keyval/dist/index.js; } > js/vendor/idb-keyval.js
npx esbuild node_modules/@floating-ui/dom/dist/floating-ui.dom.browser.mjs --bundle --format=esm --minify --log-level=warning \
  --banner:js='/*! Floating UI (MIT) https://floating-ui.com */' --outfile=js/vendor/floating-ui.js
