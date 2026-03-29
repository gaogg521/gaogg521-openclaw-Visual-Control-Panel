ONE CLAW / 控制台 — 演示安装包说明
================================

本 Setup.exe 会安装：
  - launcher\OpenClawLobster.cmd + OpenClawLobster.ps1
    · 若本机 3003 已有控制台：直接打开 http://127.0.0.1:3003/setup
    · 若安装目录下存在 standalone\server.js：用本机 node 后台启动后再打开上述地址
    · 若无 standalone：弹窗说明，并仍尝试打开浏览器（需您自行 npm run dev）
  - scripts\check-lobster-port.ps1（启动前检测端口占用）
  - docs\ 用户动线与 Inno 文案（Markdown）

将完整控制台打进安装包：
  1) 在「龙虾可视化控制面板」根目录执行： npm run packaging:prepare-standalone
  2) 在本目录执行： .\prepare-bundled-standalone.ps1
  3) 再编译 OpenClawOneClick.iss（脚本用 ISPP：仅当存在 standalone\server.js 时才打入该目录，避免无文件时编译失败）

完整产品还可按需加入：Node 便携版、install-openclaw-windows.ps1 等。
详见上级 README.md 与 WINDOWS_USER_JOURNEY.zh-CN.md。
