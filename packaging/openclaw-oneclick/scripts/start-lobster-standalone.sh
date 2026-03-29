#!/usr/bin/env bash
# 启动龙虾 Next standalone（默认端口 3003）
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
"$DIR/check-lobster-port.sh" || exit $?

PANEL_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
STANDALONE_DIR="${LOBSTER_STANDALONE_DIR:-$PANEL_ROOT/.next/standalone}"
NODE_EXE="${LOBSTER_NODE_EXE:-node}"
PORT="${LOBSTER_PORT:-3003}"

if [[ ! -f "$STANDALONE_DIR/server.js" ]]; then
  echo "Missing $STANDALONE_DIR/server.js — run npm run build in panel root" >&2
  exit 1
fi

export PORT="$PORT"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export NODE_ENV=production
cd "$STANDALONE_DIR"
echo "[openclaw-oneclick] Starting lobster on :$PORT (cwd=$STANDALONE_DIR)"
nohup "$NODE_EXE" server.js >> "${TMPDIR:-/tmp}/lobster-standalone.log" 2>&1 &
echo $! > "${TMPDIR:-/tmp}/lobster-standalone.pid"
echo "[lobster] PID $(cat "${TMPDIR:-/tmp}/lobster-standalone.pid") log ${TMPDIR:-/tmp}/lobster-standalone.log"
