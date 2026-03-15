const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settingsAPI", {
  getScreenSettings: () => ipcRenderer.invoke("settings:get-screen"),
  updateScreenSettings: (data) => ipcRenderer.invoke("settings:update-screen", data),
  getRenderSettings: () => ipcRenderer.invoke("render-settings:get"),
  updateRenderSettings: (data) => ipcRenderer.invoke("render-settings:update", data),
});
