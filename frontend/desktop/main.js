const { app, BrowserWindow, screen, ipcMain, Tray, Menu, desktopCapturer } = require("electron");
const { spawn } = require("child_process");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { resolveProjectRoot, resolvePythonExecutable } = require("./runtime-paths");

// 打包后后端资源在 resources/backend/；开发时向上两级到项目根
const PROJECT_ROOT = resolveProjectRoot({
  isPackaged: app.isPackaged,
  resourcesPath: process.resourcesPath,
  appDir: __dirname,
});
let backendProcess = null;
let backendLogs = [];
const MAX_LOG_LINES = 200;
let tray = null;
let logWin = null;
let historyWin = null;
let settingsWin = null;
let isQuitting = false;
let chatHistory = [];
const MAX_HISTORY_ITEMS = 500;
const HISTORY_SAVE_DEBOUNCE_MS = 500;
let historyFilePath = null;
let historySaveTimer = null;
let cachedForegroundTitle = "";
let foregroundTitleTimer = null;

const LIVE2D_SAMPLE = {
  id: "hiyori",
  zipUrl: "https://storage.googleapis.com/nizima-apps/sample-models/hiyori.zip",
  modelFileHint: "Hiyori.model3.json",
  licenseUrl: "https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html",
  termsUrl: "https://www.live2d.com/eula/live2d-sample-data-terms_en.html",
};
const LIVE2D_ENV = {
  autoDownload: null,
  modelPath: process.env.GREYWIND_LIVE2D_MODEL || process.env.LIVE2D_MODEL_PATH || "",
  downloadTimeoutMs: process.env.LIVE2D_DOWNLOAD_TIMEOUT_MS,
};
let live2dEnsurePromise = null;

function parseBoolEnv(value, defaultValue) {
  if (value == null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function resolveAutoDownloadDefault() {
  return true;
}

function resolveAutoDownload() {
  if (LIVE2D_ENV.autoDownload !== null) return LIVE2D_ENV.autoDownload;
  LIVE2D_ENV.autoDownload = parseBoolEnv(
    process.env.LIVE2D_AUTO_DOWNLOAD,
    resolveAutoDownloadDefault()
  );
  return LIVE2D_ENV.autoDownload;
}

function resolveDownloadTimeoutMs() {
  const raw = LIVE2D_ENV.downloadTimeoutMs;
  if (!raw) return 60000;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60000;
}

function live2dCacheBase() {
  return app.isPackaged
    ? path.join(app.getPath("userData"), "live2d")
    : path.join(PROJECT_ROOT, "cache", "live2d");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(destPath));
    const file = fs.createWriteStream(destPath);
    const request = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(() => fs.unlinkSync(destPath));
        return resolve(downloadFile(res.headers.location, destPath));
      }
      if (res.statusCode !== 200) {
        file.close(() => fs.unlinkSync(destPath));
        return reject(new Error(`Download failed: ${res.statusCode}`));
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    });
    request.setTimeout(resolveDownloadTimeoutMs(), () => {
      request.destroy(new Error("Download timeout"));
    });
    request.on("error", (err) => {
      file.close(() => fs.unlinkSync(destPath));
      reject(err);
    });
  });
}

function psEscapePath(input) {
  return `'${String(input).replace(/'/g, "''")}'`;
}

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    ensureDir(destDir);
    const psArgs = [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Expand-Archive -LiteralPath ${psEscapePath(zipPath)} -DestinationPath ${psEscapePath(destDir)} -Force`,
    ];
    const proc = spawn("powershell.exe", psArgs, { windowsHide: true });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Expand-Archive failed with code ${code}`));
    });
  });
}

function findModelJson(rootDir) {
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith(".model3.json")) {
        return full;
      }
    }
  }
  return null;
}

async function ensureLive2DModel() {
  const autoDownload = resolveAutoDownload();
  if (LIVE2D_ENV.modelPath) {
    const candidate = LIVE2D_ENV.modelPath;
    if (fs.existsSync(candidate)) {
      const stats = fs.statSync(candidate);
      if (stats.isFile()) return candidate;
      if (stats.isDirectory()) {
        const found = findModelJson(candidate);
        if (found) return found;
      }
    }
    throw new Error("LIVE2D_MODEL_PATH is set but invalid.");
  }

  const modelDir = path.join(live2dCacheBase(), LIVE2D_SAMPLE.id);
  const hintedPath = path.join(modelDir, LIVE2D_SAMPLE.modelFileHint);
  if (fs.existsSync(hintedPath)) return hintedPath;
  if (fs.existsSync(modelDir)) {
    const found = findModelJson(modelDir);
    if (found) return found;
  }

  if (!autoDownload) {
    throw new Error("Live2D auto download disabled. Set LIVE2D_AUTO_DOWNLOAD=1 or provide LIVE2D_MODEL_PATH.");
  }

  if (fs.existsSync(modelDir)) {
    fs.rmSync(modelDir, { recursive: true, force: true });
  }
  ensureDir(modelDir);

  const zipPath = path.join(modelDir, "model.zip");
  console.log(`Downloading Live2D sample model from ${LIVE2D_SAMPLE.zipUrl}`);
  console.log(`License: ${LIVE2D_SAMPLE.licenseUrl}`);
  console.log(`Terms: ${LIVE2D_SAMPLE.termsUrl}`);
  await downloadFile(LIVE2D_SAMPLE.zipUrl, zipPath);
  await extractZip(zipPath, modelDir);
  fs.unlinkSync(zipPath);

  const found = findModelJson(modelDir);
  if (!found) {
    throw new Error("Live2D model JSON not found after extraction.");
  }
  return found;
}

function ensureLive2DModelOnce() {
  if (!live2dEnsurePromise) {
    live2dEnsurePromise = ensureLive2DModel()
      .finally(() => { live2dEnsurePromise = null; });
  }
  return live2dEnsurePromise;
}

function buildBackendEnv() {
  const env = { ...process.env };
  const srcPath = path.join(PROJECT_ROOT, "src");
  env.PYTHONPATH = env.PYTHONPATH
    ? `${srcPath}${path.delimiter}${env.PYTHONPATH}`
    : srcPath;
  env.PYTHONIOENCODING = "utf-8";
  env.PYTHONUTF8 = "1";
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

function refreshForegroundTitle() {
  try {
    const { execSync } = require("child_process");
    cachedForegroundTitle = execSync(
      'powershell.exe -NoProfile -NonInteractive -Command "(Get-Process | Where-Object {$_.MainWindowHandle -eq (Add-Type -MemberDefinition \'[DllImport(\\\"user32.dll\\\")] public static extern IntPtr GetForegroundWindow();\' -Name W -Namespace U -PassThru)::GetForegroundWindow()}).MainWindowTitle"',
      { timeout: 1000, windowsHide: true, encoding: "utf-8" }
    ).trim();
  } catch (_) {
    // 失败时保留上次值
  }
}

function startForegroundTitlePolling() {
  if (foregroundTitleTimer) return;
  refreshForegroundTitle();
  foregroundTitleTimer = setInterval(refreshForegroundTitle, 2000);
}

function stopForegroundTitlePolling() {
  if (foregroundTitleTimer) {
    clearInterval(foregroundTitleTimer);
    foregroundTitleTimer = null;
  }
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
  const pythonExe = resolvePythonExecutable({
    isPackaged: app.isPackaged,
    projectRoot: PROJECT_ROOT,
    resourcesPath: process.resourcesPath,
    platform: process.platform,
    existsSync: fs.existsSync,
  });
  if (!pythonExe) {
    backendLogs.push("[ERROR] Missing bundled python runtime.");
    return;
  }
  backendProcess = spawn(pythonExe, ["-m", "greywind.run"], {
    cwd: PROJECT_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: buildBackendEnv(),
    windowsHide: true,
    detached: true,
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
    const pid = backendProcess.pid;
    if (pid) {
      killProcessTree(pid);
    } else {
      backendProcess.kill();
    }
    backendProcess = null;
  }
}

function killProcessTree(pid) {
  if (process.platform === "win32") {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch (err) {
    try {
      process.kill(pid, "SIGTERM");
    } catch (_) {
      // Ignore if already exited.
    }
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

function showSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 480,
    height: 520,
    title: "灰风 - 屏幕感知设置",
    webPreferences: {
      preload: path.join(__dirname, "preload-settings.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWin.loadFile(path.join(__dirname, "renderer", "settings.html"));
  settingsWin.on("closed", () => { settingsWin = null; });
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
  ipcMain.handle("screen:capture", async (_, opts) => {
    try {
      const monitorMode = (opts && opts.monitor) || "active";

      // 隐藏灰风窗口避免截到自己
      const wasVisible = win.isVisible();
      if (wasVisible) win.setOpacity(0);
      // 等一帧让窗口透明生效
      await new Promise((r) => setTimeout(r, 50));

      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 1280, height: 720 },
      });
      if (wasVisible) win.setOpacity(1);
      if (!sources.length) return { ok: false, error: "无法获取屏幕源" };

      let selectedSources;
      if (monitorMode === "all") {
        selectedSources = sources;
      } else if (monitorMode === "primary") {
        const primaryDisplay = screen.getPrimaryDisplay();
        const found = sources.find((s) => s.display_id === String(primaryDisplay.id));
        selectedSources = [found || sources[0]];
      } else {
        // active: 鼠标所在屏幕
        const cursorPoint = screen.getCursorScreenPoint();
        const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
        const found = sources.find((s) => s.display_id === String(activeDisplay.id));
        selectedSources = [found || sources[0]];
      }

      const b64 = selectedSources[0].thumbnail.toJPEG(60).toString("base64");
      return { ok: true, image_base64: b64, window_title: cachedForegroundTitle };
    } catch (err) {
      win.setOpacity(1);
      return { ok: false, error: err?.message || String(err) };
    }
  });
  ipcMain.handle("live2d:get-model-url", async () => {
    try {
      const modelPath = await ensureLive2DModelOnce();
      return { ok: true, url: pathToFileURL(modelPath).href };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("settings:get-screen", async () => {
    try {
      const res = await fetch("http://127.0.0.1:12393/api/screen-settings");
      return await res.json();
    } catch (err) {
      return { error: err?.message || String(err) };
    }
  });

  ipcMain.handle("settings:update-screen", async (_, data) => {
    try {
      const res = await fetch("http://127.0.0.1:12393/api/screen-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err) {
      return { error: err?.message || String(err) };
    }
  });

  // 系统托盘
  tray = new Tray(path.join(__dirname, "renderer", "icon.png").replace(/\\/g, "/"));
  tray.setToolTip("灰风 GreyWind");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "显示/隐藏", click: () => win.isVisible() ? win.hide() : win.show() },
    { label: "屏幕感知设置", click: () => showSettingsWindow() },
    { label: "后端日志", click: () => showLogWindow() },
    { label: "Chat History", click: () => showHistoryWindow() },
    { label: "开发工具", click: () => win.webContents.openDevTools({ mode: "detach" }) },
    { type: "separator" },
    { label: "退出", click: () => app.quit() },
  ]));
  tray.on("click", () => win.isVisible() ? win.hide() : win.show());

  return win;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // 第二个实例启动时，聚焦已有窗口
    const allWindows = BrowserWindow.getAllWindows();
    const mainWin = allWindows.find((w) => !w.isDestroyed());
    if (mainWin) {
      if (!mainWin.isVisible()) mainWin.show();
      mainWin.focus();
    }
  });

  app.whenReady().then(() => {
    historyFilePath = resolveHistoryFilePath();
    loadHistoryFromDisk();
    startBackend();
    startForegroundTitlePolling();
    createWindow();
  });
}

app.on("window-all-closed", (e) => {
  if (!isQuitting) {
    e?.preventDefault?.();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  saveHistoryToDisk();
  stopForegroundTitlePolling();
  stopBackend();
});
