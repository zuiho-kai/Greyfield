/**
 * 启动后端进程（新窗口，不阻塞当前进程）
 * 启动前先清理占用 12393 端口的残留进程
 */
const { spawn, execSync } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..", "..", "..");
const PORT = 12393;

// 先杀占用端口的残留进程
try {
  const out = execSync(`netstat -ano | findstr :${PORT} | findstr LISTENING`, { encoding: "utf8" });
  const pids = new Set(
    out.trim().split("\n").map(line => line.trim().split(/\s+/).pop()).filter(Boolean)
  );
  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
      console.log(`已清理端口 ${PORT} 上的残留进程 PID ${pid}`);
    } catch {}
  }
} catch {
  // 没有占用，正常
}

// Windows 上用 detached + start 打开新窗口
const child = spawn("cmd", ["/c", "start", "\"灰风后端\"", "cmd", "/c", "uv run python -m greywind.run"], {
  cwd: projectRoot,
  detached: true,
  stdio: "ignore",
});
child.unref();
console.log("后端已在新窗口启动");
