const { app, BrowserWindow, screen, ipcMain, Tray, Menu } = require("electron");
const { spawn } = require("child_process");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { resolveProjectRoot, resolvePythonExecutable } = require("./runtime-paths");
const {
  resolveIgnoreMouseRequest,
  supportsMouseTransparency,
} = require("./renderer/live2d-interaction-policy.js");

// Win32 系统级拖拽（仅 Windows）
let nativeDrag = null;
if (process.platform === "win32") {
  try {
    const koffi = require("koffi");
    const user32 = koffi.load("user32.dll");
    const ReleaseCapture = user32.func("bool __stdcall ReleaseCapture()");
    const SendMessageW = user32.func("intptr_t __stdcall SendMessageW(intptr_t hwnd, uint32_t msg, intptr_t wParam, intptr_t lParam)");
    const PostMessageW = user32.func("bool __stdcall PostMessageW(intptr_t hwnd, uint32_t msg, intptr_t wParam, intptr_t lParam)");
    const GetKeyState = user32.func("int16_t __stdcall GetKeyState(int32_t nVirtKey)");
    const WM_NCLBUTTONDOWN = 0x00A1;
    const WM_SYSCOMMAND = 0x0112;
    const SC_MOVE = 0xF010;
    const HTCAPTION = 2;
    const VK_LBUTTON = 0x01;
    nativeDrag = (hwndBuffer) => {
      const hwnd = hwndBuffer.length >= 8
        ? Number(hwndBuffer.readBigInt64LE(0))
        : hwndBuffer.readInt32LE(0);
      const lbState = GetKeyState(VK_LBUTTON);
      console.log("[main] hwnd:", hwnd, "lButton state:", lbState);
      ReleaseCapture();
      // 用 WM_SYSCOMMAND SC_MOVE 作为备选
      SendMessageW(hwnd, WM_SYSCOMMAND, SC_MOVE + HTCAPTION, 0);
    };
  } catch (e) {
    console.warn("koffi 加载失败，回退到 JS 拖拽:", e.message);
  }
}

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

// ── 主进程截屏模块（DEV-86：重数据不经渲染进程；DEV-88：koffi 直调 Win32 API，不 spawn 进程）──
const WebSocket = require("ws");
let screenWs = null;
let screenCaptureTimer = null;
let screenCaptureEnabled = false;
const SCREEN_CAPTURE_INTERVAL_MS = 3000;

// Win32 截屏 API（纯内存，无子进程，无 DWM 刷新）
let win32Screen = null;
if (process.platform === "win32") {
  try {
    const koffi = require("koffi");
    const gdi32 = koffi.load("gdi32.dll");
    const user32 = koffi.load("user32.dll");

    const GetDC = user32.func("intptr_t __stdcall GetDC(intptr_t hWnd)");
    const ReleaseDC = user32.func("int32_t __stdcall ReleaseDC(intptr_t hWnd, intptr_t hDC)");
    const GetSystemMetrics = user32.func("int32_t __stdcall GetSystemMetrics(int32_t nIndex)");
    const CreateCompatibleDC = gdi32.func("intptr_t __stdcall CreateCompatibleDC(intptr_t hdc)");
    const CreateCompatibleBitmap = gdi32.func("intptr_t __stdcall CreateCompatibleBitmap(intptr_t hdc, int32_t cx, int32_t cy)");
    const SelectObject = gdi32.func("intptr_t __stdcall SelectObject(intptr_t hdc, intptr_t h)");
    const BitBlt = gdi32.func("bool __stdcall BitBlt(intptr_t hdc, int32_t x, int32_t y, int32_t cx, int32_t cy, intptr_t hdcSrc, int32_t x1, int32_t y1, uint32_t rop)");
    const DeleteDC = gdi32.func("bool __stdcall DeleteDC(intptr_t hdc)");
    const DeleteObject = gdi32.func("bool __stdcall DeleteObject(intptr_t ho)");
    const GetDIBits = gdi32.func("int32_t __stdcall GetDIBits(intptr_t hdc, intptr_t hbm, uint32_t start, uint32_t cLines, void* lpvBits, void* lpbmi, uint32_t usage)");

    const SM_CXSCREEN = 0;
    const SM_CYSCREEN = 1;
    const SRCCOPY = 0x00CC0020;
    const DIB_RGB_COLORS = 0;

    win32Screen = {
      capture() {
        const w = GetSystemMetrics(SM_CXSCREEN);
        const h = GetSystemMetrics(SM_CYSCREEN);
        const hdcScreen = GetDC(0);
        const hdcMem = CreateCompatibleDC(hdcScreen);
        const hBitmap = CreateCompatibleBitmap(hdcScreen, w, h);
        const hOld = SelectObject(hdcMem, hBitmap);

        BitBlt(hdcMem, 0, 0, w, h, hdcScreen, 0, 0, SRCCOPY);

        // BITMAPINFOHEADER (40 bytes) — 手动构造
        const bmiSize = 40;
        const bmi = Buffer.alloc(bmiSize + 12); // +12 for color masks just in case
        bmi.writeUInt32LE(bmiSize, 0);       // biSize
        bmi.writeInt32LE(w, 4);              // biWidth
        bmi.writeInt32LE(-h, 8);             // biHeight (负值 = top-down)
        bmi.writeUInt16LE(1, 12);            // biPlanes
        bmi.writeUInt16LE(24, 14);           // biBitCount (24-bit BGR)
        bmi.writeUInt32LE(0, 16);            // biCompression = BI_RGB

        // 每行 stride 对齐到 4 字节
        const stride = ((w * 3 + 3) & ~3);
        const pixelDataSize = stride * h;
        const pixelData = Buffer.alloc(pixelDataSize);

        GetDIBits(hdcMem, hBitmap, 0, h, pixelData, bmi, DIB_RGB_COLORS);

        // 清理 GDI 资源
        SelectObject(hdcMem, hOld);
        DeleteObject(hBitmap);
        DeleteDC(hdcMem);
        ReleaseDC(0, hdcScreen);

        // 构造 BMP 文件（file header 14 bytes + info header 40 bytes + pixel data）
        const fileHeaderSize = 14;
        const bmpSize = fileHeaderSize + bmiSize + pixelDataSize;
        const bmp = Buffer.alloc(bmpSize);

        // BMP file header
        bmp.write("BM", 0);                                    // signature
        bmp.writeUInt32LE(bmpSize, 2);                         // file size
        bmp.writeUInt32LE(0, 6);                               // reserved
        bmp.writeUInt32LE(fileHeaderSize + bmiSize, 10);       // pixel data offset

        // 写回正确的 biHeight（正值，BMP 文件格式需要 bottom-up）
        bmi.writeInt32LE(h, 8);
        bmi.copy(bmp, fileHeaderSize, 0, bmiSize);

        // 像素数据翻转（top-down → bottom-up for BMP）
        for (let y = 0; y < h; y++) {
          pixelData.copy(bmp, fileHeaderSize + bmiSize + (h - 1 - y) * stride, y * stride, y * stride + stride);
        }

        return bmp;
      },
    };
    console.log("[screen] Win32 koffi 截屏模块已加载");
  } catch (e) {
    console.warn("[screen] koffi 截屏加载失败:", e.message);
  }
}

function screenWsConnect() {
  if (screenWs && screenWs.readyState === WebSocket.OPEN) return;
  try {
    screenWs = new WebSocket("ws://127.0.0.1:12393/ws");
    screenWs.on("open", () => console.log("[screen] WebSocket 已连接"));
    screenWs.on("error", (err) => console.debug("[screen] WebSocket 错误:", err.message));
    screenWs.on("close", () => { screenWs = null; });
  } catch (e) {
    console.debug("[screen] WebSocket 连接失败:", e.message);
    screenWs = null;
  }
}

function screenWsSend(msg) {
  if (screenWs && screenWs.readyState === WebSocket.OPEN) {
    screenWs.send(JSON.stringify(msg));
  }
}

function startScreenCapture(intervalMs) {
  if (screenCaptureTimer) return;
  if (!win32Screen) {
    console.warn("[screen] 截屏模块未加载，跳过");
    return;
  }
  screenCaptureEnabled = true;
  const interval = intervalMs || SCREEN_CAPTURE_INTERVAL_MS;
  screenWsConnect();
  screenCaptureTimer = setInterval(() => {
    if (!screenCaptureEnabled) return;
    try {
      refreshForegroundTitle();
      const bmpBuffer = win32Screen.capture();
      // BMP → JPEG 压缩（BMP 6MB → JPEG ~200KB），减少 WebSocket 传输量
      const { nativeImage } = require("electron");
      const img = nativeImage.createFromBuffer(bmpBuffer);
      const jpegBuffer = img.toJPEG(70);
      const b64 = jpegBuffer.toString("base64");
      screenWsConnect();
      screenWsSend({
        type: "screen_capture",
        payload: {
          image_base64: b64,
          window_title: cachedForegroundTitle,
          screen_index: 0,
        },
      });
    } catch (err) {
      console.debug("[screen] 截屏失败:", err.message);
    }
  }, interval);
  console.log(`[screen] 截屏已启动，间隔 ${interval}ms`);
}

function stopScreenCapture() {
  screenCaptureEnabled = false;
  if (screenCaptureTimer) {
    clearInterval(screenCaptureTimer);
    screenCaptureTimer = null;
  }
  if (screenWs) {
    screenWsSend({ type: "screen_sense_toggle", payload: { enabled: false } });
  }
  console.log("[screen] 截屏已停止");
}

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

function resolveRenderSettingsPath() {
  const base = app.isPackaged ? app.getPath("userData") : PROJECT_ROOT;
  return path.join(base, "cache", "render-settings.json");
}

const DEFAULT_RENDER_SETTINGS = { hiDpi: false, bubbleBlur: true };

function loadRenderSettings() {
  try {
    const p = resolveRenderSettingsPath();
    if (fs.existsSync(p)) return { ...DEFAULT_RENDER_SETTINGS, ...JSON.parse(fs.readFileSync(p, "utf8")) };
  } catch (_) {}
  return { ...DEFAULT_RENDER_SETTINGS };
}

function saveRenderSettings(data) {
  try {
    const p = resolveRenderSettingsPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
  } catch (_) {}
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
    const { execFile } = require("child_process");
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command",
       "(Get-Process | Where-Object {$_.MainWindowHandle -eq (Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();' -Name W -Namespace U -PassThru)::GetForegroundWindow()}).MainWindowTitle"],
      { timeout: 2000, windowsHide: true },
      (err, stdout) => {
        if (!err && stdout) cachedForegroundTitle = stdout.toString().trim();
      }
    );
  } catch (_) {
    // 失败时保留上次值
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
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  // 默认不穿透，窗口正常接收所有鼠标事件
  // 用 setShape 限制可点击区域（模型包围盒 + 输入区），区域外自动穿透
  win.setIgnoreMouseEvents(false);
  let clickThrough = false;

  ipcMain.on("set-click-shape", (_, rects) => {
    if (clickThrough) return;
    // 暂时禁用 setShape，先验证拖拽
    console.log("[shape] setShape skipped (debug), rects:", rects.length);
  });


  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  if (process.argv.includes("--dev")) {
    win.webContents.openDevTools({ mode: "detach" });
  }


  // 窗口拖拽：JS setPosition 方案（始终注册作为回退）
  let dragStartPos = null;
  ipcMain.on("window-drag-start", () => {
    dragStartPos = win.getPosition();
  });
  ipcMain.on("window-drag-move", (_, dx, dy) => {
    if (!dragStartPos) return;
    win.setPosition(dragStartPos[0] + Math.round(dx), dragStartPos[1] + Math.round(dy));
  });
  ipcMain.on("window-drag-end", () => {
    dragStartPos = null;
  });

  // Win32 原生拖拽（零闪烁，无假 resize）
  if (nativeDrag) {
    ipcMain.on("window-drag-native", () => {
      console.log("[main] nativeDrag called");
      nativeDrag(win.getNativeWindowHandle());
      console.log("[main] nativeDrag returned");
    });
  }

  // 告诉 renderer 是否支持原生拖拽
  ipcMain.handle("drag:has-native", () => !!nativeDrag);

  ipcMain.on("chat-history:add", (_, entry) => {
    pushHistory(entry);
  });
  ipcMain.on("chat-history:append", (_, entry) => {
    appendHistory(entry);
  });
  ipcMain.handle("screen:start", async (_, opts) => {
    const interval = (opts && opts.intervalMs) || SCREEN_CAPTURE_INTERVAL_MS;
    startScreenCapture(interval);
    return { ok: true };
  });
  ipcMain.handle("screen:stop", async () => {
    stopScreenCapture();
    return { ok: true };
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
      const result = await res.json();
      // 通知主窗口 renderer 即时响应设置变更（尤其是 enabled 开关）
      if (win && !win.isDestroyed()) {
        win.webContents.send("screen-settings-changed", data);
      }
      return result;
    } catch (err) {
      return { error: err?.message || String(err) };
    }
  });

  ipcMain.handle("render-settings:get", () => loadRenderSettings());
  ipcMain.handle("render-settings:update", (_, data) => {
    const merged = { ...loadRenderSettings(), ...data };
    saveRenderSettings(merged);
    if (win && !win.isDestroyed()) {
      win.webContents.send("render-settings-changed", merged);
    }
    return merged;
  });

  // 系统托盘
  tray = new Tray(path.join(__dirname, "renderer", "icon.png").replace(/\\/g, "/"));
  tray.setToolTip("灰风 GreyWind");

  function rebuildTrayMenu() {
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "显示/隐藏", click: () => win.isVisible() ? win.hide() : win.show() },
      { label: clickThrough ? "关闭鼠标穿透" : "开启鼠标穿透", click: () => {
        clickThrough = !clickThrough;
        if (clickThrough) {
          // 穿透模式：整窗穿透，清空 shape
          win.setShape([]);
          win.setIgnoreMouseEvents(true);
        } else {
          // 恢复交互：取消穿透，通知 renderer 重新设置 shape
          win.setIgnoreMouseEvents(false);
          win.webContents.send("refresh-click-shape");
        }
        rebuildTrayMenu();
      }},
      { label: "屏幕感知设置", click: () => showSettingsWindow() },
      { label: "后端日志", click: () => showLogWindow() },
      { label: "Chat History", click: () => showHistoryWindow() },
      { label: "开发工具", click: () => win.webContents.openDevTools({ mode: "detach" }) },
      { type: "separator" },
      { label: "退出", click: () => app.quit() },
    ]));
  }
  rebuildTrayMenu();
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
  stopBackend();
});
