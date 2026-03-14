const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("greywind", {
  platform: process.platform,
  setIgnoreMouse: (ignore) => ipcRenderer.send("set-ignore-mouse", ignore),
  addHistory: (entry) => ipcRenderer.send("chat-history:add", entry),
  appendHistory: (entry) => ipcRenderer.send("chat-history:append", entry),
  getLive2DModelUrl: () => ipcRenderer.invoke("live2d:get-model-url"),
  captureScreen: (opts) => ipcRenderer.invoke("screen:capture", opts),
});
