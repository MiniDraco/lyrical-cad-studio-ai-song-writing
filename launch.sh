#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# LyricalCAD Studio — one-click launcher (Mac / Linux)
#
# Mirror of launch.bat. Make sure this file is executable:
#     chmod +x launch.sh
# Then double-click it (Mac: right-click → Open With → Terminal) or
# run from a shell:
#     ./launch.sh
# ─────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

cat <<'BANNER'

 ╭──────────────────────────────╮
 │   LyricalCAD Studio          │
 │   one-click launcher         │
 ╰──────────────────────────────╯

BANNER

# ─── 1. Node.js present? ────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  echo " [!] Node.js is not installed on this machine."
  echo
  echo "     LyricalCAD needs Node.js 18 or newer to run."
  echo "     Get the LTS installer here: https://nodejs.org/"
  echo
  echo "     After installing, run this launcher again."
  echo
  read -p "Press Enter to close..."
  exit 1
fi

# ─── 2. First-run dependency install ────────────────────────────────
if [ ! -d "node_modules" ]; then
  echo " [setup] First run detected — installing dependencies..."
  echo "         (this only happens once; future launches are fast)"
  echo
  npm install
  echo
fi

# ─── 3. Build if no production bundle yet ───────────────────────────
if [ ! -f ".next/BUILD_ID" ]; then
  echo " [build] Compiling production bundle..."
  npm run build
  echo
fi

# ─── 4. Open browser, then start server ─────────────────────────────
echo " [run] Starting LyricalCAD on http://localhost:3001"
echo "       (close this window to stop the server)"
echo

# Open default browser (best-effort across platforms).
URL="http://localhost:3001"
if command -v open >/dev/null 2>&1; then
  (sleep 1 && open "$URL") &
elif command -v xdg-open >/dev/null 2>&1; then
  (sleep 1 && xdg-open "$URL") &
fi

npm run start
