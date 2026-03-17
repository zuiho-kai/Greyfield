const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settingsAPI", {
  getScreenSettings: () => ipcRenderer.invoke("settings:get-screen"),
  updateScreenSettings: (data) => ipcRenderer.invoke("settings:update-screen", data),
  getRenderSettings: () => ipcRenderer.invoke("render-settings:get"),
  updateRenderSettings: (data) => ipcRenderer.invoke("render-settings:update", data),
  // 音色管理
  listVoices: () => ipcRenderer.invoke("voice:list"),
  uploadVoice: (data) => ipcRenderer.invoke("voice:upload", data),
  deleteVoice: (uri) => ipcRenderer.invoke("voice:delete", uri),
  switchVoice: (voice) => ipcRenderer.invoke("voice:switch", voice),
  pickAudioFile: () => ipcRenderer.invoke("voice:pick-file"),
});
