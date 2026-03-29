#!/usr/bin/env bash
# 启动龙虾前检测端口（默认 3003）
set -euo pipefail
PORT="${LOBSTER_PORT:-3003}"
port_busy() {
  if command -v nc >/dev/null 2>&1; then nc -z 127.0.0.1 "$PORT" 2>/dev/null && return 0; return 1; fi
  (echo >/dev/tcp/127.0.0.1/"$PORT") 2>/dev/null && return 0
  return 1
}
if port_busy; then
  if [[ "${OPENCLAW_ONECLICK_ALLOW_BUSY_LOBSTER:-0}" == "1" ]]; then
    echo "[openclaw-oneclick/check] WARN: port $PORT busy, ALLOW_BUSY_LOBSTER=1"
    exit 0
  fi
  echo "[openclaw-oneclick/check] ERROR: 端口 $PORT 已被占用（龙虾面板）。" >&2
  exit 30
fi
exit 0
