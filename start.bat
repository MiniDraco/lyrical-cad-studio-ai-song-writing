@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   Lyrical CAD Studio - LAN dev launcher
echo ============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not on PATH.
    echo         Install it from https://nodejs.org/ ^(LTS^) and re-run this script.
    echo.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found on PATH. Reinstall Node.js so npm is included.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
for /f "tokens=*" %%v in ('npm -v') do set NPM_VER=%%v
echo Node %NODE_VER%  /  npm %NPM_VER%
echo.

if not exist "node_modules\.package-lock.json" (
    echo [setup] node_modules missing - running "npm install" ^(first run takes a few minutes^)...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed. Read the messages above.
        pause
        exit /b 1
    )
) else (
    echo [setup] node_modules present - skipping install.
)

echo.
echo If a Windows Firewall prompt pops up, click "Allow access"
echo ^(make sure "Private networks" is checked^).
echo.
echo Starting dev server - the LAN URL for your phone will be
echo printed below once the server is Ready.
echo.

call node scripts\launch.js

endlocal
