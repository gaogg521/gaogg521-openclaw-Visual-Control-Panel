#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
if ! command -v openclaw >/dev/null 2>&1; then
  echo "未找到 openclaw。请先运行 install-openclaw-macos-linux.sh" >&2
  exit 1
fi
"$DIR/run-onboard-from-env.sh"
"$DIR/start-lobster-standalone.sh"
sleep 3
"$DIR/wait-gateway-open-dashboards.sh"
