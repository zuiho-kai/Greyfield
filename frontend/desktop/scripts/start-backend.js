/**
 * 启动后端进程（新窗口，不阻塞当前进程）
 */
const { spawn } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..", "..", "..");

// Windows 上用 detached + start 打开新窗口
const child = spawn("cmd", ["/c", "start", "灰风后端", "cmd", "/c", "uv run python -m greywind.run"], {
  cwd: projectRoot,
  detached: true,
  stdio: "ignore",
});
child.unref();
console.log("后端已在新窗口启动");
