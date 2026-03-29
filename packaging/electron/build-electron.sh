#!/usr/bin/env bash
# 在 macOS / Linux 上打包 Electron 桌面版（与 build-electron.js 一致）。
# 用法：./build-electron.sh
#       ./build-electron.sh -- --mac
#       ./build-electron.sh --skip-next-build
set -euo pipefail
cd "$(dirname "$0")"
exec node ./build-electron.js "$@"
