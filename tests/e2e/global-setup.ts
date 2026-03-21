/**
 * globalSetup — 在所有 Electron 测试前启动 mock 后端服务器
 *
 * 使用 stdio: 'ignore' + HTTP 健康检查轮询，彻底避免 pipe EPIPE 问题。
 * 之前的 pipe 方案：parent 关闭 stdout pipe 后，child 写日志触发 EPIPE →
 * uncaughtException 里再 console.error → 又 EPIPE → exit code 1。
 */
import { spawn, ChildProcess } from "child_process";
import * as http from "http";
import path from "path";

declare global {
  var __MOCK_SERVER__: ChildProcess | undefined;
}

function checkHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

export default async function globalSetup() {
  const serverPath = path.join(__dirname, "mock-server.js");
  const PORT = 12393;

  const proc = spawn(process.execPath, [serverPath, String(PORT)], {
    stdio: "ignore",   // 不建立 pipe，避免 EPIPE 导致 mock server 崩溃
    detached: true,    // 独立运行，不受 Playwright worker 进程影响
    windowsHide: true,
  });
  proc.unref(); // 不阻塞父进程退出

  globalThis.__MOCK_SERVER__ = proc;

  // 等待 /health 端点就绪（最多 10 秒，每 200ms 轮询一次）
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await checkHealth(PORT)) {
      console.log(`[Mock Server] ready on port ${PORT}`);
      return;
    }
    await new Promise((res) => setTimeout(res, 200));
  }

  throw new Error(`Mock server failed to start within 10s (port ${PORT})`);
}
