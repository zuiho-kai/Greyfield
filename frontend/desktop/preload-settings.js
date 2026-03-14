const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settingsAPI", {
  getScreenSettings: () => ipcRenderer.invoke("settings:get-screen"),
  updateScreenSettings: (data) => ipcRenderer.invoke("settings:update-screen", data),
});
