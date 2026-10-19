import { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, shell } from "electron";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";
import { resolveDistFile } from "./paths.mjs";
import { createSteamClient, resolveAppId } from "./steam.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "..", "dist");
const MAX_SAVE_BYTES = 8 * 1024 * 1024;

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

app.setName("Camelot");

let mainWindow = null;
let steam = null;

function savesDir() {
  const dir = path.join(app.getPath("userData"), "saves");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function saveFile() {
  return path.join(savesDir(), "slot.json");
}

function readPackageVersion() {
  try {
    const raw = readFileSync(path.join(__dirname, "..", "package.json"), "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed.version === "string" ? parsed.version : "1.0.0";
  } catch {
    return "1.0.0";
  }
}

function readBakedAppId() {
  try {
    const raw = readFileSync(path.join(__dirname, "steam-app-id.json"), "utf8");
    const parsed = JSON.parse(raw);
    const id = Number(parsed.appId);
    return Number.isInteger(id) && id > 0 ? id : 0;
  } catch {
    return 0;
  }
}

function handleAppProtocol(request) {
  let pathname = "/";
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const filePath = resolveDistFile(DIST_DIR, pathname);
  if (!filePath) return new Response("Forbidden", { status: 403 });
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return new Response("Not found", { status: 404 });
  }
  return net.fetch(pathToFileURL(filePath).toString());
}

function registerIpc() {
  ipcMain.handle("save:read", () => {
    const file = saveFile();
    if (!existsSync(file)) return null;
    return readFileSync(file, "utf8");
  });

  ipcMain.handle("save:write", (_event, json) => {
    if (typeof json !== "string" || json.length === 0 || json.length > MAX_SAVE_BYTES) {
      throw new Error("Invalid save payload");
    }
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("Invalid save JSON");
    }
    if (!parsed || typeof parsed !== "object" || typeof parsed.version !== "number") {
      throw new Error("Invalid save structure");
    }
    const file = saveFile();
    const temporary = `${file}.tmp`;
    writeFileSync(temporary, json);
    renameSync(temporary, file);
  });

  ipcMain.handle("save:delete", () => {
    const file = saveFile();
    if (existsSync(file)) unlinkSync(file);
  });

  ipcMain.on("app:quit", () => {
    app.quit();
  });

  ipcMain.handle("window:toggle-fullscreen", () => {
    if (!mainWindow) return false;
    const next = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(next);
    return next;
  });

  ipcMain.handle("window:set-fullscreen", (_event, fullscreen) => {
    if (!mainWindow) return false;
    const next = fullscreen === true;
    mainWindow.setFullScreen(next);
    return next;
  });

  ipcMain.handle("window:is-fullscreen", () => mainWindow?.isFullScreen() ?? false);

  ipcMain.handle("steam:unlock", (_event, id) => steam?.unlock(id) ?? false);
  ipcMain.handle("steam:sync", (_event, ids) => steam?.sync(ids) ?? []);
  ipcMain.handle("steam:status", () => steam?.status() ?? {
    mode: "offline",
    appId: "0",
    persona: null,
    cloud: false,
  });
}

function buildMenu() {
  const version = readPackageVersion();
  const template = [
    {
      label: "File",
      submenu: [{ role: "quit" }],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Fullscreen",
          accelerator: "Alt+Enter",
          click: () => {
            if (!mainWindow) return;
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          },
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About Camelot",
          click: () => {
            dialog.showMessageBox({
              type: "info",
              title: "About Camelot",
              message: "Camelot",
              detail: `Version ${version}\n\nCredits and third-party notices are in the pause menu.`,
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const onDeck = process.env.SteamDeck === "1";
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: "#0c0a07",
    title: "Camelot",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    fullscreen: onDeck,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "Enter" && input.alt && !input.repeat) {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  const devServer = process.env.CAMELOT_DEV_SERVER;
  if (devServer) {
    mainWindow.loadURL(devServer);
  } else {
    mainWindow.loadURL("app://camelot/index.html");
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    protocol.handle("app", handleAppProtocol);
    const execDir = path.dirname(process.execPath);
    steam = createSteamClient({
      appId: resolveAppId({
        execDir,
        baked: readBakedAppId(),
      }),
      userData: app.getPath("userData"),
    });
    registerIpc();
    buildMenu();
    createWindow();
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}
