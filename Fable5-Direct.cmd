@echo off
setlocal
cd /d "%~dp0"
pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Fable5-Direct.ps1" %*
