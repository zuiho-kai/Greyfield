const { app, BrowserWindow, screen, ipcMain, Tray, Menu } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

// 打包后 exe 在 dist/win-unpacked/，项目根目录通过 exe 位置向上找
// 开发时 __dirname 是 frontend/desktop，向上两级
const PROJECT_ROOT = app.isPackaged
  ? path.resolve(path.dirname(app.getPath("exe")), "..", "..")
  : path.resolve(__dirname, "..", "..");
let backendProcess = null;
let backendLogs = [];
const MAX_LOG_LINES = 200;
let tray = null;
let logWin = null;

function startBackend() {
  backendProcess = spawn("uv", ["run", "python", "-m", "greywind.run"], {
    cwd: PROJECT_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    windowsHide: true,
  });

  const onData = (data) => {
    const lines = data.toString("utf-8").split("\n").filter(Boolean);
    backendLogs.push(...lines);
    if (backendLogs.length > MAX_LOG_LINES) {
      backendLogs = backendLogs.slice(-MAX_LOG_LINES);
    }
    // 实时推送到日志窗口
    if (logWin && !logWin.isDestroyed()) {
      logWin.webContents.send("backend-log", lines.join("\n"));
    }
  };

  backendProcess.stdout.on("data", onData);
  backendProcess.stderr.on("data", onData);

  backendProcess.on("error", (err) => {
    backendLogs.push("[ERROR] 后端启动失败: " + err.message);
  });
  backendProcess.on("exit", (code) => {
    backendLogs.push("[INFO] 后端退出: " + code);
    backendProcess = null;
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

function showLogWindow() {
  if (logWin && !logWin.isDestroyed()) {
    logWin.focus();
    return;
  }
  logWin = new BrowserWindow({
    width: 600,
    height: 400,
    title: "灰风 - 后端日志",
    webPreferences: {
      preload: path.join(__dirname, "preload-log.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  logWin.loadFile(path.join(__dirname, "renderer", "log.html"));
  logWin.webContents.on("did-finish-load", () => {
    logWin.webContents.send("backend-log", backendLogs.join("\n"));
  });
  logWin.on("closed", () => { logWin = null; });
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
    { label: "后端日志", click: () => showLogWindow() },
    { label: "开发工具", click: () => win.webContents.openDevTools({ mode: "detach" }) },
    { type: "separator" },
    { label: "退出", click: () => app.quit() },
  ]));
  tray.on("click", () => win.isVisible() ? win.hide() : win.show());

  return win;
}

app.whenReady().then(() => {
  startBackend();
  setTimeout(createWindow, 3000);
});

app.on("window-all-closed", (e) => {
  e?.preventDefault?.();
});

app.on("before-quit", () => {
  stopBackend();
});
