@echo off
title MultiMind - Install
echo.
echo   ========================================
echo          MultiMind - Installation
echo   ========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [!] Node.js not found.
    echo   Download from https://nodejs.org and install.
    echo.
    pause
    exit /b 1
)

echo   [OK] Node.js found
node --version
echo.

echo   [*] Installing Electron...
call npm install
echo.

echo   The app will offer Quick setup for its local model.
echo   Ollama is optional and can be installed from the app.

echo.
echo   ========================================
echo   Done! Now run start.vbs without a terminal window
echo   Projects will be saved to: %USERPROFILE%\MultiMindProject
echo   ========================================
echo.
pause
