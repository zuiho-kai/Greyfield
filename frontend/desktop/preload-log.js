const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("logAPI", {
  onLog: (cb) => ipcRenderer.on("backend-log", (_, data) => cb(data)),
});
