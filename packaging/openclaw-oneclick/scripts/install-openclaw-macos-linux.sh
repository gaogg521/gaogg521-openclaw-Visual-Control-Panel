#!/usr/bin/env bash
# 静默安装 OpenClaw CLI（官方 install.sh，跳过交互与 onboard）
# 文档: https://docs.openclaw.ai/install/installer
# 已安装检测与端口冲突: ./check-openclaw-conflicts.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
set +e
"$SCRIPT_DIR/check-openclaw-conflicts.sh"
chk=$?
set -e
if [[ "$chk" -eq 10 ]]; then
  echo "[openclaw-oneclick] Install skipped (already installed)."
  exit 0
fi
if [[ "$chk" -ne 0 ]]; then
  exit "$chk"
fi

export SHARP_IGNORE_GLOBAL_LIBVIPS="${SHARP_IGNORE_GLOBAL_LIBVIPS:-1}"
export OPENCLAW_NO_PROMPT="${OPENCLAW_NO_PROMPT:-1}"

echo "[openclaw-oneclick] Downloading official install.sh ..."
curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash -s -- --no-prompt --no-onboard

echo "[openclaw-oneclick] Verifying CLI..."
command -v openclaw >/dev/null 2>&1 || {
  echo "openclaw not on PATH. Add npm global bin to PATH (see official troubleshooting)." >&2
  exit 1
}
openclaw --version || true
echo "[openclaw-oneclick] Done. Next: copy config/wizard.example.env to wizard.env and run run-onboard-from-env.sh"
