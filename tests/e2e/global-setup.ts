/**
 * globalSetup — 在所有 Electron 测试前启动 mock 后端服务器
 */
import { spawn, ChildProcess } from "child_process";
import path from "path";

declare global {
  var __MOCK_SERVER__: ChildProcess | undefined;
}

export default async function globalSetup() {
  await new Promise<void>((resolve, reject) => {
    const serverPath = path.join(__dirname, "mock-server.js");
    const isWindows = process.platform === "win32";

    // 直接使用 node 启动，Windows 下不使用 shell 以避免进程层级问题
    const proc = spawn(process.execPath, [serverPath, "12393"], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
      windowsHide: true,
    });

    let ready = false;
    let stdoutBuffer = "";

    proc.stdout?.on("data", (data: Buffer) => {
      const str = data.toString();
      stdoutBuffer += str;
      console.log(`[Mock Server] ${str.trim()}`);

      if (!ready && str.includes("MOCK_SERVER_READY")) {
        ready = true;
        globalThis.__MOCK_SERVER__ = proc;
        resolve();
      }
    });

    proc.stderr?.on("data", (data: Buffer) => {
      const str = data.toString();
      console.error(`[Mock Server Error] ${str.trim()}`);

      if (!ready) {
        reject(new Error(`Mock server error: ${str}`));
      }
    });

    proc.on("exit", (code) => {
      console.log(`[Mock Server] Exited with code ${code}`);
      if (!ready) {
        reject(new Error(`Mock server exited early with code ${code}, stdout: ${stdoutBuffer}`));
      }
    });

    proc.on("error", (err) => {
      console.error(`[Mock Server] Failed to start: ${err.message}`);
      reject(new Error(`Mock server failed to start: ${err.message}`));
    });

    // 超时保护
    setTimeout(() => {
      if (!ready) {
        reject(new Error(`Mock server startup timeout, stdout: ${stdoutBuffer}`));
      }
    }, 10000);
  });
}
