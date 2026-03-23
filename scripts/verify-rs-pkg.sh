#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

cd "$ROOT_DIR"
wasm-pack build --target web --scope weiqu_ --out-dir "$TMP_DIR/pkg" rs >/dev/null

for required_file in \
  "$TMP_DIR/pkg/match_pattern_rs_bg.wasm" \
  "$ROOT_DIR/rs/pkg/match_pattern_rs_bg.wasm"
do
  if [[ ! -f "$required_file" ]]; then
    echo "missing generated wasm asset: $required_file"
    exit 1
  fi
done

# wasm-pack currently emits non-deterministic .wasm binaries on this platform, so
# verification focuses on the wrapper files and manifest that must stay in sync
# with Rust exports and package metadata.
if ! diff -ru \
  --exclude match_pattern_rs_bg.wasm \
  "$TMP_DIR/pkg" \
  "$ROOT_DIR/rs/pkg"
then
  echo
  echo "rs/pkg is out of date. Run: yarn rebuild:rs-pkg"
  exit 1
fi
