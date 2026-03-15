const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("greywind", {
  platform: process.platform,
  setIgnoreMouse: (ignore) => ipcRenderer.send("set-ignore-mouse", ignore),
  addHistory: (entry) => ipcRenderer.send("chat-history:add", entry),
  appendHistory: (entry) => ipcRenderer.send("chat-history:append", entry),
  getLive2DModelUrl: () => ipcRenderer.invoke("live2d:get-model-url"),
  captureScreen: (opts) => ipcRenderer.invoke("screen:capture", opts),
  onScreenSettingsChanged: (fn) => ipcRenderer.on("screen-settings-changed", (_, data) => fn(data)),
  getRenderSettings: () => ipcRenderer.invoke("render-settings:get"),
  onRenderSettingsChanged: (fn) => ipcRenderer.on("render-settings-changed", (_, data) => fn(data)),
});
