#!/usr/bin/env bash
# 在龙虾项目根执行: bash packaging/openclaw-oneclick/scripts/prepare-lobster-standalone-bundle.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
npm run build
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
echo "[ok] Bundle ready under .next/standalone (static + public copied)."
