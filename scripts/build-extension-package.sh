#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
manifest_version="$(node -p "JSON.parse(require('fs').readFileSync('${repo_root}/manifest.json','utf8')).version")"
archive="${repo_root}/dist/alt-text-generator-pro-v${manifest_version}.zip"

npm --prefix "${repo_root}/ui" run build

cd "${repo_root}"
zip -q -r -FS "${archive}" \
  manifest.json \
  background.js \
  content.js \
  _locales \
  icons/action-icon-16.png \
  icons/action-icon-32.png \
  icons/icon-16.png \
  icons/icon-32.png \
  icons/icon-48.png \
  icons/icon-96.png \
  icons/icon-128.png \
  icons/icon-256.png \
  icons/icon-512.png \
  icons/ui-copy.svg \
  icons/ui-refresh-cw.svg \
  icons/ui-x.svg \
  ui-dist \
  utils/composeAltText.js \
  utils/env.js \
  utils/i18n.js \
  utils/imageTools.js \
  -x '*.DS_Store'

unzip -t "${archive}" >/dev/null
node "${repo_root}/scripts/verify-extension-package.mjs" "${archive}"
echo "Built ${archive}"
unzip -l "${archive}"
