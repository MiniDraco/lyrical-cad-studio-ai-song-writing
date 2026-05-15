@echo off
REM --------------------------------------------------------------------
REM  LyricalCAD Studio - one-click launcher (Windows)
REM
REM  What this does, in order:
REM    1. Installs Node.js LTS automatically if missing (via winget),
REM       optionally to a custom drive if C:\ is full.
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
  echo  IMPORTANT: leave "Tools for Native Modules" UNCHECKED.
  echo.
  pause
  exit /b 1
)

where winget >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [!] winget is not available on this Windows version
  echo      (requires Windows 10 1709+ or Windows 11).
  echo      Install Node.js LTS manually from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

REM --- 1a. Pick install drive / location ------------------------------
echo.
echo  Where should Node.js be installed?
echo.
echo    [1] Default  ^(C:\Program Files\nodejs^)        - recommended
echo    [2] Custom drive/folder                       - use if C:\ is full
echo.
echo  Tip: Node.js + npm cache is ~300 MB. If C:\ is tight,
echo       pick option 2 and point to D:\, E:\, etc.
echo.
set "_loc_choice="
set /p "_loc_choice=  Choose [1 or 2, default 1]: "

set "_install_args="
set "_install_path="

if "!_loc_choice!"=="2" (
  echo.
  echo  Enter the full install path. Examples:
  echo      D:\nodejs
  echo      E:\Tools\nodejs
  echo      D:\Apps\Node
  echo.
  set /p "_install_path=  Path: "

  REM Strip surrounding quotes if the user typed them
  if defined _install_path set "_install_path=!_install_path:"=!"

  if "!_install_path!"=="" (
    echo  [!] No path entered. Falling back to default location.
  ) else (
    set "_install_args=--location "!_install_path!""
  )
)

echo.
echo  [setup] Installing Node.js LTS via winget...
if defined _install_path echo          Target: !_install_path!
echo          ^(Windows may show a UAC prompt - click "Yes"^)
echo.
winget install --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements !_install_args!
if errorlevel 1 (
  echo.
  echo  [!] winget install failed. Install Node.js manually from:
  echo      https://nodejs.org/
  echo.
  pause
  exit /b 1
)

REM --- 1b. Refresh PATH so THIS shell sees the new node.exe ----------
REM First, prepend Node's default install dirs (covers option 1 and
REM per-user installs winget sometimes does).
set "PATH=%PATH%;%ProgramFiles%\nodejs;%LOCALAPPDATA%\Programs\nodejs"

REM If the user picked a custom location, add it to this shell AND
REM persist it to the user's PATH so future shells find node too.
if defined _install_path (
  set "PATH=!PATH!;!_install_path!"
  echo  [setup] Adding !_install_path! to your user PATH...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=[Environment]::GetEnvironmentVariable('Path','User'); if ($p -split ';' -notcontains '!_install_path!') { [Environment]::SetEnvironmentVariable('Path', $p + ';!_install_path!', 'User') }"
)

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [!] Node.js was installed, but isn't visible in this
  echo      shell yet. Close this window and double-click
  echo      launch.bat again - PATH will refresh and we'll continue.
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
