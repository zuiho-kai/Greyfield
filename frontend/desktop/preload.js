const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("greywind", {
  platform: process.platform,
  setClickShape: (rects) => ipcRenderer.send("set-click-shape", rects),
  setMouseIgnore: (ignore) => ipcRenderer.send("set-mouse-ignore", ignore),
  addHistory: (entry) => ipcRenderer.send("chat-history:add", entry),
  appendHistory: (entry) => ipcRenderer.send("chat-history:append", entry),
  getLive2DModelUrl: () => ipcRenderer.invoke("live2d:get-model-url"),
  onLive2DModelChanged: (fn) => ipcRenderer.on("live2d:model-changed", (_, data) => fn(data)),
  confirmModelSwitch: (modelId) => ipcRenderer.invoke("live2d:confirm-switch", modelId),
  captureScreen: null, // 已废弃，截屏在主进程完成（DEV-86）
  startScreenCapture: (opts) => ipcRenderer.invoke("screen:start", opts),
  stopScreenCapture: () => ipcRenderer.invoke("screen:stop"),
  getScreenSettings: () => ipcRenderer.invoke("settings:get-screen"),
  onScreenSettingsChanged: (fn) => ipcRenderer.on("screen-settings-changed", (_, data) => fn(data)),
  onDesktopSettingsChanged: (fn) => ipcRenderer.on("desktop-settings-changed", (_, data) => fn(data)),
  onScreenFrame: (fn) => ipcRenderer.on("screen:frame", (_, data) => fn(data)),
  onRefreshClickShape: (fn) => ipcRenderer.on("refresh-click-shape", () => fn()),
  getRenderSettings: () => ipcRenderer.invoke("render-settings:get"),
  updateRenderSettings: (data) => ipcRenderer.invoke("render-settings:update", data),
  resetModelTransform: () => ipcRenderer.invoke("render-settings:reset-model-transform"),
  onRenderSettingsChanged: (fn) => ipcRenderer.on("render-settings-changed", (_, data) => fn(data)),
  onClearHistory: (fn) => ipcRenderer.on("chat-history:clear", () => fn()),
});
