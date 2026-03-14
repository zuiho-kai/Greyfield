const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("greywind", {
  platform: process.platform,
  setIgnoreMouse: (ignore) => ipcRenderer.send("set-ignore-mouse", ignore),
  startDrag: () => ipcRenderer.send("window-drag-start"),
  dragMove: (dx, dy) => ipcRenderer.send("window-drag-move", dx, dy),
  addHistory: (entry) => ipcRenderer.send("chat-history:add", entry),
  appendHistory: (entry) => ipcRenderer.send("chat-history:append", entry),
  getLive2DModelUrl: () => ipcRenderer.invoke("live2d:get-model-url"),
});
