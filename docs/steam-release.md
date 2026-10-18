# Camelot on Steam

Version 1.0.0 ships a desktop shell so a Steam depot can launch the game
without a browser. The browser build still works; `window.camelotDesktop` is
what turns on disk saves, Steam achievements, fullscreen, and Quit to Desktop.

## Build a depot

```bash
npm install
npm install --prefix desktop
npm run desktop:pack
```

The shell's Electron dependency lives in `desktop/` so it does not leak
Electron's DOM types into the game typecheck.

`desktop:pack` typechecks, builds `dist/`, and writes a Linux folder to
`release/linux-unpacked/`. That folder is the depot content. On Windows or
macOS, pack with:

```bash
npx electron-builder --config desktop/electron-builder.json --win dir
npx electron-builder --config desktop/electron-builder.json --mac dir
```

Run it once before uploading:

```bash
./release/linux-unpacked/camelot
```

Play far enough to save, quit from the pause menu (the process must exit),
and relaunch. The save should still be there.

`npm run desktop` launches the shell against `dist/` (run `npm run build`
first). `npm run desktop:dev` points the shell at the Vite server on port
8088.

## What the shell guarantees

- Offline. Remote Babylon.js props load only when `VITE_ENABLE_REMOTE_PROPS=true`.
  The production env file does not set that flag. Terrain, characters, and
  filler props are local.
- Saves live in the OS user-data directory, product name `Camelot`:
  - Windows: `%APPDATA%\Camelot\saves\slot.json`
  - Linux: `~/.config/Camelot/saves/slot.json`
  - macOS: `~/Library/Application Support/Camelot/saves/slot.json`
  Steam Auto-Cloud should watch `saves/slot.json` under those roots
  (`WinAppDataRoaming`, `LinuxXdgConfigHome`, `MacAppSupport`).
- Quit to Desktop ends the process. Alt+Enter, the View menu, and Settings →
  Toggle Fullscreen switch display mode. Steam Deck (`SteamDeck=1`) starts
  fullscreen. A gamepad already drives movement and actions.
- One instance. A second launch focuses the existing window.
- The page cannot see Node. The preload script exposes `camelotDesktop` only,
  with `contextIsolation` on and `nodeIntegration` off.

## Achievements

The launch set is `steam/achievements.json` (API name, display name,
description, optional `hidden`). Enter the same rows in the Steamworks
achievement editor before the build goes live.

Unlocks are always written to `userData/achievements.json`. They are also
sent to Steam when both of these are true:

1. `steamworks.js` is installed (`npm install steamworks.js`) and present
   when you pack. It is optional; without it the shell stays in offline mode.
2. An app id is configured, in this order:
   - `STEAM_APP_ID` in the environment
   - `steam_appid.txt` beside the executable (development only — do not ship
     this file in the depot)
   - `appId` in `desktop/steam-app-id.json`

`appId` defaults to `0`, which means "do not call Steamworks". Set it to the
real app id and rebuild before you upload. Do not commit `480` (Spacewar).

## Store page

Still done in Steamworks, not in this repo:

- Capsules, screenshots, and a short description
- Library icon (use `desktop/icon.png`, 1024×1024)
- Content survey and the third-party notices in `THIRD-PARTY-NOTICES.md`
- Depots for the platforms you pack, pointed at the unpacked folder
- Launch option: the Camelot executable, no extra arguments

## Playtest before release

From the pause menu: Save, Load, Credits, Settings (including fullscreen on
the desktop build), and Quit to Desktop. Confirm a kill, a quest completion,
a level-up, a spell, a death, a companion, and mounting a horse each produce
a single achievement toast and a matching id in `achievements.json`.
