#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_FILE="${ROOT_DIR}/autohjfy.xpi"

cd "${ROOT_DIR}"

zip -r "${OUT_FILE}" \
  manifest.json \
  bootstrap.js \
  chrome.manifest \
  chrome/

echo "Built: ${OUT_FILE}"
