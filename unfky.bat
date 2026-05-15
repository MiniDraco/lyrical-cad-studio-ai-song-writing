@echo off
setlocal EnableDelayedExpansion
title LyricalCAD - repair script

echo.
echo ============================================================
echo   LyricalCAD Studio - Repair / cleanup
echo ============================================================
echo.
echo This script:
echo   1. Removes Visual Studio 2026 Build Tools and the failed
echo      vctools workload that Chocolatey just tried to install.
echo      LyricalCAD does NOT need them - they're 6+ GB of C++
echo      compilers for native node modules this project has zero
echo      of. Removing frees disk space and ends the install loop.
echo   2. Makes sure Node.js LTS is available (the only thing
echo      this project actually needs).
echo.
echo WARNING: only run this if you installed VS 2026 specifically
echo while trying to set up LyricalCAD. If you use Visual Studio
echo 2026 for OTHER projects, close this window now (X in the
echo corner). This will not touch VS 2022 or earlier.
echo.
pause

REM ---- require admin (choco uninstall needs it) ---------------
net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Run this as Administrator.
    echo         Right-click unfky.bat  -^>  Run as administrator
    echo.
    pause
    exit /b 1
)

REM ---- 1. uninstall the failed vctools workload ---------------
echo.
echo ------------------------------------------------------------
echo [1/4] Cancelling the failed vctools workload install...
echo ------------------------------------------------------------
where choco >nul 2>&1
if errorlevel 1 (
    echo [skip] Chocolatey is not on PATH, nothing to uninstall.
    goto :node_step
)

choco uninstall visualstudio2026-workload-vctools -y --skip-autouninstaller
if errorlevel 1 (
    echo [info] Chocolatey says it isn't installed - good, the
    echo        original install failed before completion.
)

REM ---- 2. uninstall VS 2026 Build Tools shell -----------------
echo.
echo ------------------------------------------------------------
echo [2/4] Removing visualstudio2026buildtools...
echo ------------------------------------------------------------
choco uninstall visualstudio2026buildtools -y
if errorlevel 1 (
    echo [warn] Could not uninstall via Chocolatey. Fall back to
    echo        the Visual Studio Installer manually:
    echo            Start  -^>  "Visual Studio Installer"
    echo            -^>  More  -^>  Uninstall
)

REM ---- 3. remove the VS installer itself ----------------------
echo.
echo ------------------------------------------------------------
echo [3/4] Removing the Visual Studio Installer launcher...
echo ------------------------------------------------------------
choco uninstall visualstudio-installer -y
REM Not critical if this stays; it's small.

REM ---- 4. make sure Node.js LTS is installed ------------------
:node_step
echo.
echo ------------------------------------------------------------
echo [4/4] Checking Node.js...
echo ------------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
    echo [warn] Node.js is not installed.
    where winget >nul 2>&1
    if not errorlevel 1 (
        echo        Installing Node.js LTS via winget...
        winget install --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
    ) else (
        where choco >nul 2>&1
        if not errorlevel 1 (
            echo        Installing Node.js LTS via Chocolatey...
            choco install nodejs-lts -y
        ) else (
            echo        Download the LTS installer from:
            echo            https://nodejs.org/
        )
    )
) else (
    for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
    for /f "tokens=*" %%v in ('npm -v') do set NPM_VER=%%v
    echo Node !NODE_VER!  /  npm !NPM_VER!  -- looks good.
)

echo.
echo ============================================================
echo   Done.
echo.
echo   Next step:  double-click  launch.bat  to run LyricalCAD.
echo.
echo   Disk space note: VS 2026 Build Tools were ~6 GB. If the
echo   uninstaller says "already removed" but C:\ is still full,
echo   open Settings -^> Apps and look for "Visual Studio Build
echo   Tools 2026" and uninstall it from there too. Then empty
echo   C:\ProgramData\chocolatey\lib\visualstudio2026* manually.
echo ============================================================
echo.
pause
endlocal
