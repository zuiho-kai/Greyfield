/**
 * 清理占用指定端口的进程（Windows）
 * 用法: node scripts/kill-port.js 12393
 */
const { execSync } = require("child_process");
const port = process.argv[2];
if (!port) process.exit(0);

try {
  const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: "utf8" });
  const pids = new Set(
    out.trim().split("\n").map(line => line.trim().split(/\s+/).pop()).filter(Boolean)
  );
  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
      console.log(`已清理端口 ${port} 上的进程 PID ${pid}`);
    } catch {}
  }
} catch {
  // 没有占用，正常
}
