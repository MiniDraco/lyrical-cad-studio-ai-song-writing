@echo off
setlocal EnableDelayedExpansion
title LyricalCAD Studio - LAN dev
cd /d "%~dp0"

echo.
echo ============================================================
echo   Lyrical CAD Studio - LAN dev launcher
echo ============================================================
echo.

REM --- 1. Node.js: detect, and auto-install if missing ----------------
where node >nul 2>&1
if not errorlevel 1 goto :have_node

echo [setup] Node.js is not installed on this machine.
echo         LyricalCAD can install it automatically using the
echo         built-in Windows Package Manager (winget). This grabs
echo         ONLY the official Node.js LTS - no extra C++ build
echo         tools, no Visual Studio, no Chocolatey.
echo.
set "_yn="
set /p "_yn= Install Node.js LTS now? [Y/N] "
if /i not "!_yn!"=="Y" (
    echo.
    echo Skipping auto-install. Get Node.js LTS manually here:
    echo     https://nodejs.org/
    echo.
    echo IMPORTANT: leave "Tools for Native Modules" UNCHECKED
    echo in the installer - this project doesn't need it.
    echo.
    pause
    exit /b 1
)

where winget >nul 2>&1
if errorlevel 1 (
    echo.
    echo [!] winget is not available on this Windows version
    echo     (requires Windows 10 1709+ or Windows 11).
    echo     Install Node.js LTS manually from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM --- 1a. Pick install drive / location ------------------------------
echo.
echo Where should Node.js be installed?
echo.
echo   [1] Default  (C:\Program Files\nodejs)        - recommended
echo   [2] Custom drive/folder                       - use if C:\ is full
echo.
echo Tip: Node.js + npm cache is ~300 MB. If C:\ is tight,
echo      pick option 2 and point to D:\, E:\, etc.
echo.
set "_loc_choice="
set /p "_loc_choice= Choose [1 or 2, default 1]: "

set "_install_args="
set "_install_path="

if "!_loc_choice!"=="2" (
    echo.
    echo Enter the full install path. Examples:
    echo     D:\nodejs
    echo     E:\Tools\nodejs
    echo     D:\Apps\Node
    echo.
    set /p "_install_path= Path: "

    REM Strip surrounding quotes if the user typed them
    if defined _install_path set "_install_path=!_install_path:"=!"

    if "!_install_path!"=="" (
        echo [!] No path entered. Falling back to default location.
    ) else (
        set "_install_args=--location "!_install_path!""
    )
)

echo.
echo [setup] Installing Node.js LTS via winget...
if defined _install_path echo         Target: !_install_path!
echo         (Windows may show a UAC prompt - click "Yes")
echo.
winget install --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements !_install_args!
if errorlevel 1 (
    echo.
    echo [!] winget install failed. Install Node.js manually from:
    echo     https://nodejs.org/
    pause
    exit /b 1
)

REM Refresh PATH so this shell sees the new node.exe
set "PATH=%PATH%;%ProgramFiles%\nodejs;%LOCALAPPDATA%\Programs\nodejs"
if defined _install_path (
    set "PATH=!PATH!;!_install_path!"
    echo [setup] Adding !_install_path! to your user PATH...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=[Environment]::GetEnvironmentVariable('Path','User'); if ($p -split ';' -notcontains '!_install_path!') { [Environment]::SetEnvironmentVariable('Path', $p + ';!_install_path!', 'User') }"
)

where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo [!] Node.js was installed, but isn't visible in this
    echo     shell yet. Close this window and re-run start.bat.
    echo.
    pause
    exit /b 1
)

echo.
echo [setup] Node.js installed successfully.
echo.

:have_node

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found on PATH. Reinstall Node.js so npm is included.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
for /f "tokens=*" %%v in ('npm -v') do set NPM_VER=%%v
echo Node !NODE_VER!  /  npm !NPM_VER!
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
