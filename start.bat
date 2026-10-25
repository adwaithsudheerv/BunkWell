@echo off
title Bunkwell Launcher
echo ==============================================
echo       Starting Bunkwell Application
echo ==============================================
echo.

start "Bunkwell Backend (Port 5000)" cmd /k "cd /d %~dp0backend && npm run dev"
ping -n 3 127.0.0.1 >nul
start "Bunkwell Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo [OK] Backend starting at http://localhost:5000
echo [OK] Frontend starting at http://localhost:5173
echo.
ping -n 3 127.0.0.1 >nul
start http://localhost:5173
echo.
