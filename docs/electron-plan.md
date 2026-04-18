# Camelot Desktop Editor — Electron Packaging Plan

This document describes the plan for wrapping the Camelot Standalone Editor in
an Electron shell to produce a native desktop application for Windows, macOS,
and Linux.

---

## Goals

1. **Native file-system access** — Open / Save / Export work with real OS file
   dialogs and write directly to disk (no browser download hacks).
2. **Offline-first** — The editor works without a network connection.  All
   assets, tools, and the Babylon.js runtime are bundled locally.
3. **Single distributable** — One installer per platform (`.exe` / `.dmg` /
   `.AppImage`) that non-technical content creators can double-click.
4. **Shared codebase** — The Electron app reuses 100 % of the existing
   `src/ui/standalone-editor-shell.ts` and all creator system code.  No
   fork, no copy.

---

## Architecture Overview

```
packages/
  editor-electron/          ← NEW Electron wrapper package
    package.json            ← electron, electron-builder deps
    electron-main.ts        ← Main process (BrowserWindow, IPC, menus)
    preload.ts              ← Context-bridge for file-system APIs
    tsconfig.json
  editor-renderer/          ← (optional) thin re-export of the Vite app
    vite.config.ts          ← tweaked for Electron renderer
```

### Main Process (`electron-main.ts`)

- Create a frameless `BrowserWindow` (or native title bar, TBD) loading
  the Vite dev-server URL in development or the built `dist/index.html` in
  production.
- Register IPC handlers for file-system operations:
  - `editor:open-project` → `dialog.showOpenDialog` + `fs.readFile`
  - `editor:save-project` → `dialog.showSaveDialog` + `fs.writeFile`
  - `editor:export-bundle` → `dialog.showSaveDialog` + `fs.writeFile`
  - `editor:read-recent` → read from app user-data JSON file
  - `editor:write-recent` → write to app user-data JSON file
- Expose a native application menu (File → New / Open / Save / Export / Quit;
  Edit → Undo / Redo; Help → About).
- Forward menu accelerators to the renderer via IPC so the shell callbacks
  fire identically to the browser version.

### Preload Script (`preload.ts`)

- Use `contextBridge.exposeInMainWorld` to expose a `camelotEditor` API on
  `window`:
  ```ts
  interface CamelotEditorBridge {
    openProject(): Promise<{ name: string; data: string; filePath: string } | null>;
    saveProject(filePath: string, data: string): Promise<boolean>;
    exportBundle(data: string, defaultName: string): Promise<boolean>;
    getRecentProjects(): Promise<RecentProjectEntry[]>;
    addRecentProject(entry: RecentProjectInput): Promise<void>;
    removeRecentProject(id: string): Promise<void>;
    onMenuAction(callback: (action: string) => void): void;
    getPlatform(): string;
  }
  ```
- The renderer detects `window.camelotEditor` at startup and swaps the
  browser-only `localStorage` persistence for the native bridge.

### Renderer Integration

- `StandaloneEditorShell` callbacks (`onNew`, `onOpen`, `onSave`, `onExport`)
  already exist and are wired to the title bar buttons.  In the Electron build
  these callbacks will call through the `camelotEditor` bridge instead of
  triggering browser downloads.
- `RecentProjectsSystem` already persists to `localStorage`.  In Electron
  it will optionally delegate to the native bridge so projects are stored in
  the OS user-data directory and survive cache clears.

---

## Monorepo Structure

The project will adopt a lightweight monorepo using the existing
`pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
```

| Package | Description |
|---------|-------------|
| `packages/editor-electron` | Electron main + preload + builder config |
| Root (`/`) | Existing Vite web app (game + editor renderer) |

The Electron package will depend on the root package's build output
(`dist/`) as its renderer source.

---

## Build & Distribution

| Tool | Purpose |
|------|---------|
| `electron` | Runtime shell |
| `electron-builder` | Packaging & auto-update (`.exe`, `.dmg`, `.AppImage`) |
| `vite` (existing) | Bundle the renderer (TypeScript + Babylon.js) |

### Build Pipeline

1. `npm run build` — Vite builds the web app into `dist/`.
2. `cd packages/editor-electron && npm run build` — `tsc` compiles the main
   and preload scripts.
3. `npm run package` — `electron-builder` packages everything into a
   platform-specific installer.

### CI

A new GitHub Actions workflow (`electron-build.yml`) will:
- Build the Vite renderer.
- Build the Electron main/preload.
- Package for all three platforms using `electron-builder`.
- Upload installers as release artifacts.

---

## Implementation Phases

### Phase 1 — Scaffold & Hello World
- [ ] Create `packages/editor-electron/` with `package.json`, `tsconfig.json`.
- [ ] Add `electron` and `electron-builder` dev dependencies.
- [ ] Write minimal `electron-main.ts` that loads `dist/index.html`.
- [ ] Write minimal `preload.ts` with an empty bridge.
- [ ] Verify the existing editor shell opens in the Electron window.

### Phase 2 — Native File Dialogs
- [ ] Implement `editor:open-project` IPC handler with `dialog.showOpenDialog`.
- [ ] Implement `editor:save-project` IPC handler with `dialog.showSaveDialog`.
- [ ] Implement `editor:export-bundle` IPC handler.
- [ ] Wire `StandaloneEditorShell` callbacks to the bridge when available.
- [ ] Add integration test: open → edit → save → reopen round-trip.

### Phase 3 — Native Recent Projects
- [ ] Store recent projects in the OS user-data directory (JSON file).
- [ ] Wire `RecentProjectsSystem` to use the bridge for persistence.
- [ ] Show recent projects on the welcome dashboard with full file paths.
- [ ] Double-clicking a recent project opens it directly.

### Phase 4 — Native Menus & Accelerators
- [ ] Build a native application menu (File, Edit, Help).
- [ ] Forward menu accelerators (`Ctrl+N`, `Ctrl+O`, `Ctrl+S`, `Ctrl+Shift+E`)
  to the renderer via IPC.
- [ ] Add an About dialog showing version, credits, and license.

### Phase 5 — Packaging & Distribution
- [ ] Configure `electron-builder` for Windows (NSIS), macOS (DMG), Linux (AppImage).
- [ ] Add app icons for all platforms.
- [ ] Add a GitHub Actions workflow for automated builds.
- [ ] Test installers on each platform.

### Phase 6 — Auto-Update (Optional)
- [ ] Integrate `electron-updater` for GitHub Releases-based auto-update.
- [ ] Add update-available notification in the editor status bar.

---

## Security Considerations

- `nodeIntegration: false` and `contextIsolation: true` in the
  `BrowserWindow` web preferences — all Node.js access goes through the
  preload bridge.
- The renderer never touches `fs`, `child_process`, or any Node API directly.
- IPC handlers validate all arguments before performing file-system operations.
- No remote content is loaded — the renderer is always the local Vite build.

---

## Compatibility Notes

- The browser version of the editor continues to work exactly as it does
  today.  The Electron wrapper is purely additive.
- Feature detection (`typeof window.camelotEditor !== "undefined"`) gates
  all native behaviour, so the same renderer code runs in both environments.
- Minimum Electron version: 28+ (for ESM support in the main process).
