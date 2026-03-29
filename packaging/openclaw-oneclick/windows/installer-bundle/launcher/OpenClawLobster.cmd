@echo off
REM 启动内置 standalone（若存在）并打开 http://127.0.0.1:3003/setup ；否则提示并仍尝试打开浏览器。
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0OpenClawLobster.ps1" %*
exit /b %ERRORLEVEL%
