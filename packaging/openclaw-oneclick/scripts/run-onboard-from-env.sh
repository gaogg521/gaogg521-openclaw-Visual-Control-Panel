#!/usr/bin/env bash
# 读取 ../config/wizard.env 并执行 openclaw onboard --non-interactive
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/config/wizard.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy wizard.example.env to wizard.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${AUTH_CHOICE:?Set AUTH_CHOICE in wizard.env}"
GATEWAY_PORT="${GATEWAY_PORT:-18789}"
GATEWAY_BIND="${GATEWAY_BIND:-loopback}"
DAEMON_RUNTIME="${DAEMON_RUNTIME:-node}"

ARGS=(
  onboard --non-interactive
  --mode local
  --auth-choice "$AUTH_CHOICE"
  --secret-input-mode plaintext
  --gateway-port "$GATEWAY_PORT"
  --gateway-bind "$GATEWAY_BIND"
)

if [[ "${INSTALL_DAEMON:-1}" == "1" || "${INSTALL_DAEMON:-}" == "true" ]]; then
  ARGS+=(--install-daemon --daemon-runtime "$DAEMON_RUNTIME")
fi
if [[ "${SKIP_SKILLS:-1}" != "0" && "${SKIP_SKILLS:-}" != "false" ]]; then
  ARGS+=(--skip-skills)
fi

case "$AUTH_CHOICE" in
  openai-api-key)
    [[ -n "${OPENAI_API_KEY:-}" ]] || { echo "OPENAI_API_KEY required" >&2; exit 1; }
    ARGS+=(--openai-api-key "$OPENAI_API_KEY")
    ;;
  anthropic-api-key)
    [[ -n "${ANTHROPIC_API_KEY:-}" ]] || { echo "ANTHROPIC_API_KEY required" >&2; exit 1; }
    ARGS+=(--anthropic-api-key "$ANTHROPIC_API_KEY")
    ;;
  moonshot-api-key)
    [[ -n "${MOONSHOT_API_KEY:-}" ]] || { echo "MOONSHOT_API_KEY required" >&2; exit 1; }
    ARGS+=(--moonshot-api-key "$MOONSHOT_API_KEY")
    ;;
  gemini-api-key)
    [[ -n "${GEMINI_API_KEY:-}" ]] || { echo "GEMINI_API_KEY required" >&2; exit 1; }
    ARGS+=(--gemini-api-key "$GEMINI_API_KEY")
    ;;
  ollama)
    [[ -n "${CUSTOM_MODEL_ID:-}" ]] || { echo "CUSTOM_MODEL_ID required for ollama" >&2; exit 1; }
    ARGS+=(--custom-model-id "$CUSTOM_MODEL_ID")
    if [[ "${ACCEPT_RISK:-0}" == "1" || "${ACCEPT_RISK:-}" == "true" ]]; then
      ARGS+=(--accept-risk)
    fi
    ;;
  custom-api-key)
    ARGS+=(--custom-base-url "${CUSTOM_BASE_URL:?}" --custom-provider-id "${CUSTOM_PROVIDER_ID:-my-custom}" \
      --custom-compatibility "${CUSTOM_COMPATIBILITY:-openai}")
    [[ -n "${CUSTOM_API_KEY:-}" ]] && ARGS+=(--custom-api-key "$CUSTOM_API_KEY")
    ;;
  *)
    echo "Unsupported AUTH_CHOICE=$AUTH_CHOICE — extend run-onboard-from-env.sh" >&2
    exit 1
    ;;
esac

echo "[openclaw-oneclick] openclaw ${ARGS[*]}"
openclaw "${ARGS[@]}"
echo "[openclaw-oneclick] onboard done. Start lobster + run wait-gateway-open-dashboards.sh"
