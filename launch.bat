@echo off
REM ─────────────────────────────────────────────────────────────────────
REM  LyricalCAD Studio — one-click launcher (Windows)
REM
REM  What this does, in order:
REM    1. Checks for Node.js (required to run the app).
REM    2. Installs npm dependencies on first run.
REM    3. Builds the production bundle if it isn't already built.
REM    4. Starts the local server on http://localhost:3001
REM    5. Opens the user's default browser to the app.
REM
REM  Re-run any time. After the first build the launcher skips straight
REM  to step 4 — startup is a couple seconds.
REM ─────────────────────────────────────────────────────────────────────

setlocal
title LyricalCAD Studio
cd /d "%~dp0"

echo.
echo  ╭──────────────────────────────╮
echo  │   LyricalCAD Studio          │
echo  │   one-click launcher         │
echo  ╰──────────────────────────────╯
echo.

REM ─── 1. Node.js present? ────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
  echo  [!] Node.js is not installed on this machine.
  echo.
  echo      LyricalCAD needs Node.js 18 or newer to run.
  echo      Get the LTS installer here:
  echo.
  echo          https://nodejs.org/
  echo.
  echo      After installing, double-click this launcher again.
  echo.
  pause
  exit /b 1
)

REM ─── 2. First-run dependency install ────────────────────────────────
if not exist "node_modules" (
  echo  [setup] First run detected — installing dependencies...
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

REM ─── 3. Build if no production bundle yet ───────────────────────────
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

REM ─── 4. Open browser, then start server ─────────────────────────────
echo  [run] Starting LyricalCAD on http://localhost:3001
echo        ^(close this window to stop the server^)
echo.
start "" "http://localhost:3001"
call npm run start

endlocal
