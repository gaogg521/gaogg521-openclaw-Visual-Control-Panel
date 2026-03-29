#!/usr/bin/env bash
# 等待网关端口，然后打开 OpenClaw Web + 龙虾 oneone-dashboard
set -euo pipefail
MAX_WAIT="${MAX_WAIT_SEC:-120}"
LOBSTER_PORT="${LOBSTER_PORT:-3003}"
CFG="${OPENCLAW_HOME:-$HOME/.openclaw}/openclaw.json"
PORT=18789
TOKEN=""
if [[ -f "$CFG" ]] && command -v python3 >/dev/null 2>&1; then
  PYOUT="$(python3 -c "
import json, sys
p = sys.argv[1]
try:
    with open(p, encoding='utf-8') as f:
        c = json.load(f)
    g = c.get('gateway') or {}
    port = int(g.get('port') or 18789)
    tok = (g.get('auth') or {}).get('token') or ''
    print(port)
    print(tok)
except Exception:
    print(18789)
    print('')
" "$CFG")"
  PORT="$(echo "$PYOUT" | sed -n '1p')"
  TOKEN="$(echo "$PYOUT" | sed -n '2p')"
fi

if [[ -n "$TOKEN" ]] && command -v python3 >/dev/null 2>&1; then
  QTOKEN="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$TOKEN")"
  URL="http://127.0.0.1:${PORT}/chat?token=${QTOKEN}"
else
  URL="http://127.0.0.1:${PORT}/chat"
fi
LOBSTER="http://127.0.0.1:${LOBSTER_PORT}/oneone-dashboard"

port_open() {
  if command -v nc >/dev/null 2>&1; then nc -z 127.0.0.1 "$PORT" 2>/dev/null; return $?; fi
  if bash -c "echo >/dev/tcp/127.0.0.1/$PORT" 2>/dev/null; then return 0; fi
  return 1
}

echo "[openclaw-oneclick] Waiting for :$PORT (max ${MAX_WAIT}s)..."
for ((i = 0; i < MAX_WAIT; i += 2)); do
  if port_open; then break; fi
  sleep 2
done
if ! port_open; then
  echo "[openclaw-oneclick] Port $PORT not reachable. Try: openclaw gateway status" >&2
  exit 1
fi

open_url() {
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then open "$1"
  else echo "Open manually: $1"
  fi
}

echo "[openclaw-oneclick] Opening $URL"
open_url "$URL"
sleep 1
echo "[openclaw-oneclick] Opening $LOBSTER"
open_url "$LOBSTER"
