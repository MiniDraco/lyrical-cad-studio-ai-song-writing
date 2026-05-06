# LyricalCAD Studio — Quickstart

A first look at LyricalCAD. Thanks for testing!

## Run it (Windows)

1. **Install Node.js** if you don't have it: <https://nodejs.org/> (pick the LTS download).
2. **Double-click `launch.bat`** in this folder.
3. The first run installs dependencies and builds the app — takes a minute.
   Future launches start in a couple seconds.
4. Your browser opens to <http://localhost:3001> with the app running.
5. **To stop**, close the launcher window.

## Run it (Mac / Linux)

1. Install Node.js: <https://nodejs.org/> (LTS).
2. Open a terminal in this folder and run:

       ./launch.sh

   Or in Finder: right-click `launch.sh` → Open With → Terminal.
3. The browser opens to <http://localhost:3001> on its own.

If `launch.sh` won't run, mark it executable first:

    chmod +x launch.sh

## What works offline

Almost everything — your lyric pads, tags, branches, pocket items, settings,
and quests all live in your browser's local storage. The only feature that
needs internet is the **IntelliSense word lookups** (Datamuse API) and the
**Word Probes** highlights, which fetch topic vocabulary on the fly.

## First-time tour

Once the app loads:

- Top bar: dock toggle, Style Pad toggle, Ghost Mode, 👜 Pocket, ❓ Help, ⚙ Settings, syllable legend, line/syllable/char counts.
- Left dock: Fusion Slot (drop pills to combine) + Tag Tray (six built-in
  categories + Branches + any custom categories you add).
- Bottom-left footer: 🎯 Quest, 🌐 Creativity, 🎲 Random.
- Click ❓ in the top bar (or hit `Ctrl+?`) for the full keyboard / gesture cheatsheet.

## Resetting

If anything gets weird, open ⚙ **Settings → ⚠ Master Reset** at the top of
the modal. Wipes everything to defaults (with a double-confirm).

## Reporting issues

Note what you were doing right before, then drop a message with:

- What you clicked / typed
- What you expected
- What happened
- Browser + OS

A screenshot helps a lot. Thanks!
