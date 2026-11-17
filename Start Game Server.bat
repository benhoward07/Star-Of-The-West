@echo off
title Star of the West - Game Server
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not on the PATH.
  echo Install it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing the game's packages. This only happens the first time...
  call npm install
)

echo.
echo Starting the game server. A QR code for your phone will appear below.
echo Keep this window open while you play. Press Ctrl+C to stop.
echo.
call npm run dev
pause
