#!/usr/bin/env bash
# 安装前检测：已有 openclaw CLI 则跳过官方安装；网关端口被占用且无 CLI 则报错。
# 参考同类桌面封装思路: https://github.com/oneclaw/oneclaw （安装冲突检测）
#
# 退出码: 0=可继续安装  10=应跳过安装(已安装)  20=端口冲突需用户处理
set -euo pipefail

FORCE="${OPENCLAW_ONECLICK_FORCE_REINSTALL:-0}"
HOME_OC="${OPENCLAW_HOME:-$HOME/.openclaw}"
CFG="$HOME_OC/openclaw.json"

if [[ "$FORCE" == "1" || "$FORCE" == "true" ]]; then
  echo "[openclaw-oneclick/check] OPENCLAW_ONECLICK_FORCE_REINSTALL=1 — 将执行官方安装脚本（可能升级/覆盖）。"
  exit 0
fi

if command -v openclaw >/dev/null 2>&1 && openclaw --version >/dev/null 2>&1; then
  ver="$(openclaw --version 2>/dev/null | head -n1 || true)"
  echo "[openclaw-oneclick/check] 已检测到 OpenClaw CLI: $ver"
  echo "[openclaw-oneclick/check] 跳过官方 install.sh，避免重复安装与文件覆盖。若需重装请设置 OPENCLAW_ONECLICK_FORCE_REINSTALL=1"
  exit 10
fi

port_busy() {
  local p=$1
  if command -v nc >/dev/null 2>&1; then nc -z 127.0.0.1 "$p" 2>/dev/null && return 0; return 1; fi
  if (echo >/dev/tcp/127.0.0.1/"$p") 2>/dev/null; then return 0; fi
  return 1
}

GW_PORT=18789
if [[ -f "$CFG" ]] && command -v python3 >/dev/null 2>&1; then
  GW_PORT="$(python3 -c "import json,sys; p=sys.argv[1];
try:
  print(int(json.load(open(p,encoding='utf-8')).get('gateway',{}).get('port') or 18789))
except Exception:
  print(18789)
" "$CFG" 2>/dev/null || echo 18789)"
fi

if port_busy "$GW_PORT"; then
  if [[ "${OPENCLAW_ONECLICK_ALLOW_BUSY_GATEWAY:-0}" == "1" || "${OPENCLAW_ONECLICK_ALLOW_BUSY_GATEWAY:-0}" == "true" ]]; then
    echo "[openclaw-oneclick/check] 警告: 本机端口 ${GW_PORT} 已被占用，ALLOW_BUSY_GATEWAY=1 — 仍继续安装。"
    exit 0
  fi
  echo "[openclaw-oneclick/check] 错误: 端口 ${GW_PORT} 已被占用，且未检测到 openclaw CLI。" >&2
  echo "[openclaw-oneclick/check] 可能是其他程序占用默认网关端口，或残留进程。解决后再安装，或设置 OPENCLAW_ONECLICK_ALLOW_BUSY_GATEWAY=1 强行继续。" >&2
  exit 20
fi

echo "[openclaw-oneclick/check] 未检测到已安装的 openclaw 命令，且网关端口 ${GW_PORT} 空闲 — 将执行官方安装。"
exit 0
