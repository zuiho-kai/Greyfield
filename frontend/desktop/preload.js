const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("greywind", {
  platform: process.platform,
  setClickShape: (rects) => ipcRenderer.send("set-click-shape", rects),
  nativeDrag: () => ipcRenderer.send("window-drag-native"),
  hasNativeDrag: () => ipcRenderer.invoke("drag:has-native"),
  startDrag: () => ipcRenderer.send("window-drag-start"),
  dragMove: (dx, dy) => ipcRenderer.send("window-drag-move", dx, dy),
  endDrag: () => ipcRenderer.send("window-drag-end"),
  addHistory: (entry) => ipcRenderer.send("chat-history:add", entry),
  appendHistory: (entry) => ipcRenderer.send("chat-history:append", entry),
  getLive2DModelUrl: () => ipcRenderer.invoke("live2d:get-model-url"),
  captureScreen: null, // 已废弃，截屏在主进程完成（DEV-86）
  startScreenCapture: (opts) => ipcRenderer.invoke("screen:start", opts),
  stopScreenCapture: () => ipcRenderer.invoke("screen:stop"),
  getScreenSettings: () => ipcRenderer.invoke("settings:get-screen"),
  onScreenSettingsChanged: (fn) => ipcRenderer.on("screen-settings-changed", (_, data) => fn(data)),
  onScreenFrame: (fn) => ipcRenderer.on("screen:frame", (_, data) => fn(data)),
  onRefreshClickShape: (fn) => ipcRenderer.on("refresh-click-shape", () => fn()),
  getRenderSettings: () => ipcRenderer.invoke("render-settings:get"),
  onRenderSettingsChanged: (fn) => ipcRenderer.on("render-settings-changed", (_, data) => fn(data)),
});
