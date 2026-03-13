const { app, BrowserWindow, screen, ipcMain, Tray, Menu } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// 打包后后端资源在 resources/backend/；开发时向上两级到项目根
const PROJECT_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, "backend")
  : path.resolve(__dirname, "..", "..");
let backendProcess = null;
let backendLogs = [];
const MAX_LOG_LINES = 200;
let tray = null;
let logWin = null;
let historyWin = null;
let chatHistory = [];
const MAX_HISTORY_ITEMS = 500;
const HISTORY_SAVE_DEBOUNCE_MS = 500;
let historyFilePath = null;
let historySaveTimer = null;

function resolvePythonExecutable() {
  const isWin = process.platform === "win32";
  const venvDir = path.join(PROJECT_ROOT, ".venv");
  const candidates = [
    path.join(venvDir, isWin ? "Scripts\\python.exe" : "bin/python"),
    "python",
  ];
  for (const candidate of candidates) {
    if (candidate === "python") return candidate;
    if (fs.existsSync(candidate)) return candidate;
  }
  return "python";
}

function buildBackendEnv() {
  const env = { ...process.env };
  const srcPath = path.join(PROJECT_ROOT, "src");
  env.PYTHONPATH = env.PYTHONPATH
    ? `${srcPath}${path.delimiter}${env.PYTHONPATH}`
    : srcPath;
  return env;
}

function resolveHistoryFilePath() {
  const base = app.isPackaged ? app.getPath("userData") : PROJECT_ROOT;
  const dir = app.isPackaged
    ? path.join(base, "chat_history")
    : path.join(base, "cache", "chat_history");
  return path.join(dir, "history.json");
}

function ensureHistoryDir() {
  if (!historyFilePath) return;
  fs.mkdirSync(path.dirname(historyFilePath), { recursive: true });
}

function loadHistoryFromDisk() {
  if (!historyFilePath) return;
  try {
    if (!fs.existsSync(historyFilePath)) return;
    const raw = fs.readFileSync(historyFilePath, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      chatHistory = data.map(normalizeEntry).slice(-MAX_HISTORY_ITEMS);
    }
  } catch (err) {
    console.warn("Failed to load chat history:", err?.message || err);
  }
}

function saveHistoryToDisk() {
  if (!historyFilePath) return;
  try {
    ensureHistoryDir();
    fs.writeFileSync(historyFilePath, JSON.stringify(chatHistory, null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed to save chat history:", err?.message || err);
  }
}

function scheduleSaveHistory() {
  if (!historyFilePath) return;
  if (historySaveTimer) clearTimeout(historySaveTimer);
  historySaveTimer = setTimeout(() => {
    historySaveTimer = null;
    saveHistoryToDisk();
  }, HISTORY_SAVE_DEBOUNCE_MS);
}

function normalizeEntry(entry) {
  const role = entry?.role === "user" ? "user" : "assistant";
  const text = typeof entry?.text === "string" ? entry.text : String(entry?.text ?? "");
  const ts = Number.isFinite(entry?.ts) ? entry.ts : Date.now();
  return { role, text, ts };
}

function pushHistory(entry) {
  const normalized = normalizeEntry(entry);
  chatHistory.push(normalized);
  if (chatHistory.length > MAX_HISTORY_ITEMS) {
    chatHistory = chatHistory.slice(-MAX_HISTORY_ITEMS);
  }
  if (historyWin && !historyWin.isDestroyed()) {
    historyWin.webContents.send("chat-history:add", normalized);
  }
  scheduleSaveHistory();
}

function appendHistory(entry) {
  const normalized = normalizeEntry(entry);
  const last = chatHistory[chatHistory.length - 1];
  if (last && last.role === normalized.role) {
    last.text = last.text ? `${last.text}\n${normalized.text}` : normalized.text;
    last.ts = normalized.ts;
    if (historyWin && !historyWin.isDestroyed()) {
      historyWin.webContents.send("chat-history:append", normalized);
    }
    scheduleSaveHistory();
    return;
  }
  pushHistory(normalized);
}

function startBackend() {
  const pythonExe = resolvePythonExecutable();
  backendProcess = spawn(pythonExe, ["-m", "greywind.run"], {
    cwd: PROJECT_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: buildBackendEnv(),
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

function showHistoryWindow() {
  if (historyWin && !historyWin.isDestroyed()) {
    historyWin.focus();
    return;
  }
  historyWin = new BrowserWindow({
    width: 640,
    height: 480,
    title: "GreyWind - Chat History",
    webPreferences: {
      preload: path.join(__dirname, "preload-history.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  historyWin.loadFile(path.join(__dirname, "renderer", "history.html"));
  historyWin.webContents.on("did-finish-load", () => {
    historyWin.webContents.send("chat-history:init", chatHistory);
  });
  historyWin.on("closed", () => { historyWin = null; });
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
  ipcMain.on("chat-history:add", (_, entry) => {
    pushHistory(entry);
  });
  ipcMain.on("chat-history:append", (_, entry) => {
    appendHistory(entry);
  });

  // 系统托盘
  tray = new Tray(path.join(__dirname, "renderer", "icon.png").replace(/\\/g, "/"));
  tray.setToolTip("灰风 GreyWind");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "显示/隐藏", click: () => win.isVisible() ? win.hide() : win.show() },
    { label: "后端日志", click: () => showLogWindow() },
    { label: "Chat History", click: () => showHistoryWindow() },
    { label: "开发工具", click: () => win.webContents.openDevTools({ mode: "detach" }) },
    { type: "separator" },
    { label: "退出", click: () => app.quit() },
  ]));
  tray.on("click", () => win.isVisible() ? win.hide() : win.show());

  return win;
}

app.whenReady().then(() => {
  historyFilePath = resolveHistoryFilePath();
  loadHistoryFromDisk();
  startBackend();
  setTimeout(createWindow, 3000);
});

app.on("window-all-closed", (e) => {
  e?.preventDefault?.();
});

app.on("before-quit", () => {
  saveHistoryToDisk();
  stopBackend();
});
