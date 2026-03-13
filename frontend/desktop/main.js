const { app, BrowserWindow, screen, ipcMain, Tray, Menu } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

// 项目根目录（frontend/desktop 的上两级）
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
let backendProcess = null;
let tray = null;

function startBackend() {
  backendProcess = spawn("uv", ["run", "python", "-m", "greywind.run"], {
    cwd: PROJECT_ROOT,
    stdio: "ignore",
    windowsHide: true,
  });
  backendProcess.on("error", (err) => {
    console.error("后端启动失败:", err.message);
  });
  backendProcess.on("exit", (code) => {
    console.log("后端退出:", code);
    backendProcess = null;
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

function createWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const winW = 400;
  const winH = 500;

  const win = new BrowserWindow({
    width: winW,
    height: winH,
    x: screenW - winW - 20,
    y: screenH - winH - 20,
    title: "灰风 GreyWind",
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  win.setIgnoreMouseEvents(false);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  if (process.argv.includes("--dev")) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  ipcMain.on("set-ignore-mouse", (_, ignore) => {
    win.setIgnoreMouseEvents(ignore, { forward: true });
  });

  // 系统托盘
  tray = new Tray(path.join(__dirname, "renderer", "icon.png").replace(/\\/g, "/"));
  tray.setToolTip("灰风 GreyWind");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "显示/隐藏", click: () => win.isVisible() ? win.hide() : win.show() },
    { label: "开发工具", click: () => win.webContents.openDevTools({ mode: "detach" }) },
    { type: "separator" },
    { label: "退出", click: () => app.quit() },
  ]));
  tray.on("click", () => win.isVisible() ? win.hide() : win.show());

  return win;
}

app.whenReady().then(() => {
  startBackend();
  // 等后端启动再打开窗口
  setTimeout(createWindow, 3000);
});

app.on("window-all-closed", (e) => {
  // 不退出，保持托盘
  e?.preventDefault?.();
});

app.on("before-quit", () => {
  stopBackend();
});
