const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settingsAPI", {
  getScreenSettings: () => ipcRenderer.invoke("settings:get-screen"),
  updateScreenSettings: (data) => ipcRenderer.invoke("settings:update-screen", data),
  getDesktopSettings: () => ipcRenderer.invoke("settings:get-desktop"),
  updateDesktopSettings: (data) => ipcRenderer.invoke("settings:update-desktop", data),
  getRenderSettings: () => ipcRenderer.invoke("render-settings:get"),
  updateRenderSettings: (data) => ipcRenderer.invoke("render-settings:update", data),
  resetModelTransform: () => ipcRenderer.invoke("render-settings:reset-model-transform"),
  // 音色管理
  listVoices: () => ipcRenderer.invoke("voice:list"),
  uploadVoice: (data) => ipcRenderer.invoke("voice:upload", data),
  deleteVoice: (uri) => ipcRenderer.invoke("voice:delete", uri),
  switchVoice: (voice) => ipcRenderer.invoke("voice:switch", voice),
  previewVoice: (voice) => ipcRenderer.invoke("voice:preview", voice),
  pickAudioFile: () => ipcRenderer.invoke("voice:pick-file"),
  // Live2D 模型管理
  listModels: () => ipcRenderer.invoke("live2d:list-models"),
  switchModel: (modelId) => ipcRenderer.invoke("live2d:switch-model", modelId),
  importModel: () => ipcRenderer.invoke("live2d:import-model"),
  deleteModel: (modelId) => ipcRenderer.invoke("live2d:delete-model", modelId),
  // 通用操作（原托盘菜单项）
  getClickThrough: () => ipcRenderer.invoke("app:get-click-through"),
  setClickThrough: (val) => ipcRenderer.invoke("app:set-click-through", val),
  showLog: () => ipcRenderer.send("app:show-log"),
  showHistory: () => ipcRenderer.send("app:show-history"),
  openDevtools: () => ipcRenderer.send("app:open-devtools"),
  clearHistory: () => ipcRenderer.invoke("app:clear-history"),
});
