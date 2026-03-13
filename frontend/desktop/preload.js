const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("greywind", {
  platform: process.platform,
});
