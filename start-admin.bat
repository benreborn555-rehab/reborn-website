@echo off
title Reborn - Start Admin Server
cd /d "%~dp0"

echo ============================================
echo    Reborn - Starting Local Admin Server
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 goto NoNode

echo Opening Admin Panel in your browser...
start "" "http://localhost:3000/admin"
node server.js
goto End

:NoNode
echo [!] ERROR: Node.js is not installed on this computer!
echo     Please install it for free from: https://nodejs.org
echo     Then run this file again.
echo.
pause
exit /b 1

:End
pause
