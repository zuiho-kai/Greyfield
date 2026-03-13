const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("historyAPI", {
  onInit: (cb) => ipcRenderer.on("chat-history:init", (_, data) => cb(data)),
  onAdd: (cb) => ipcRenderer.on("chat-history:add", (_, data) => cb(data)),
  onAppend: (cb) => ipcRenderer.on("chat-history:append", (_, data) => cb(data)),
});
