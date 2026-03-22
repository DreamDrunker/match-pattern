#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR"
wasm-pack test --node rs
wasm-pack test --headless --chrome rs --test browser
