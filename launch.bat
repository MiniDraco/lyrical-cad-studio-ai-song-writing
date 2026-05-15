@echo off
REM --------------------------------------------------------------------
REM  LyricalCAD Studio - one-click launcher (Windows)
REM
REM  What this does, in order:
REM    1. Installs Node.js LTS automatically if missing (via winget).
REM    2. Installs npm dependencies on first run.
REM    3. Builds the production bundle if it isn't already built.
REM    4. Opens the user's default browser to the app.
REM    5. Starts the local server on http://localhost:3001
REM
REM  Re-run any time. After the first build, startup is a few seconds.
REM --------------------------------------------------------------------

setlocal EnableDelayedExpansion
title LyricalCAD Studio
cd /d "%~dp0"

echo.
echo  +------------------------------+
echo  ^|   LyricalCAD Studio          ^|
echo  ^|   one-click launcher         ^|
echo  +------------------------------+
echo.

REM --- 1. Node.js: detect, and auto-install if missing ----------------
where node >nul 2>&1
if not errorlevel 1 goto :have_node

echo  [setup] Node.js is not installed on this machine.
echo          LyricalCAD can install it automatically using the
echo          built-in Windows Package Manager (winget). This grabs
echo          ONLY the official Node.js LTS - no extra C++ build
echo          tools, no Visual Studio, no Chocolatey.
echo.
set "_yn="
set /p "_yn=  Install Node.js LTS now? [Y/N] "
if /i not "!_yn!"=="Y" (
  echo.
  echo  Skipping auto-install. Get Node.js LTS manually here:
  echo      https://nodejs.org/
  echo.
  echo  IMPORTANT: in the installer, leave the
  echo      "Tools for Native Modules"
  echo  checkbox UNCHECKED. This project doesn't need it, and
  echo  ticking it will download 6+ GB of Visual Studio Build
  echo  Tools you'll never use.
  echo.
  pause
  exit /b 1
)

where winget >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [!] winget is not available on this Windows version
  echo      (requires Windows 10 1709+ or Windows 11).
  echo.
  echo      Install Node.js LTS manually from:
  echo          https://nodejs.org/
  echo      Leave "Tools for Native Modules" UNCHECKED.
  echo.
  pause
  exit /b 1
)

echo.
echo  [setup] Installing Node.js LTS via winget...
echo          (Windows may show a UAC prompt - click "Yes")
echo.
winget install --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
if errorlevel 1 (
  echo.
  echo  [!] winget install failed. Install Node.js manually from:
  echo      https://nodejs.org/
  echo.
  pause
  exit /b 1
)

REM Refresh PATH so THIS shell sees the new node.exe.
REM (Newly-installed binaries don't show up in an already-open cmd
REM until PATH is re-read. Easiest fix: prepend Node's default
REM install dirs ourselves.)
set "PATH=%PATH%;%ProgramFiles%\nodejs;%LOCALAPPDATA%\Programs\nodejs"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [!] Node.js was installed, but isn't visible in this
  echo      shell yet. Close this window and double-click
  echo      launch.bat again - it'll pick up Node and continue.
  echo.
  pause
  exit /b 1
)

echo.
echo  [setup] Node.js installed successfully.
for /f "tokens=*" %%v in ('node -v') do echo          Version: %%v
echo.

:have_node

REM --- 2. First-run dependency install --------------------------------
if not exist "node_modules" (
  echo  [setup] First run detected - installing dependencies...
  echo          ^(this only happens once; future launches are fast^)
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  [!] npm install failed. Check the messages above and try again.
    pause
    exit /b 1
  )
  echo.
)

REM --- 3. Build if no production bundle yet ---------------------------
if not exist ".next\BUILD_ID" (
  echo  [build] Compiling production bundle...
  call npm run build
  if errorlevel 1 (
    echo.
    echo  [!] Build failed. Check the messages above and try again.
    pause
    exit /b 1
  )
  echo.
)

REM --- 4. Open browser, then start server -----------------------------
echo  [run] Starting LyricalCAD on http://localhost:3001
echo        ^(close this window to stop the server^)
echo.
start "" "http://localhost:3001"
call npm run start

endlocal
