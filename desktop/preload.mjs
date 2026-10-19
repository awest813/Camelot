import { contextBridge, ipcRenderer } from "electron";

/**
 * The only Node surface the renderer gets. The page talks to Camelot through
 * window.camelotDesktop; it never sees fs, ipcRenderer, or Steamworks.
 */
contextBridge.exposeInMainWorld("camelotDesktop", {
  readSave: () => ipcRenderer.invoke("save:read"),
  writeSave: (json) => ipcRenderer.invoke("save:write", json),
  deleteSave: () => ipcRenderer.invoke("save:delete"),
  quit: () => ipcRenderer.send("app:quit"),
  toggleFullscreen: () => ipcRenderer.invoke("window:toggle-fullscreen"),
  setFullscreen: (fullscreen) => ipcRenderer.invoke("window:set-fullscreen", fullscreen),
  isFullscreen: () => ipcRenderer.invoke("window:is-fullscreen"),
  unlockAchievement: (id) => ipcRenderer.invoke("steam:unlock", id),
  syncAchievements: (ids) => ipcRenderer.invoke("steam:sync", ids),
  getSteamStatus: () => ipcRenderer.invoke("steam:status"),
});
