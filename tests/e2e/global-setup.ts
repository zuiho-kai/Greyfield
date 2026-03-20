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
    const proc = spawn("node", [serverPath, "12393"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let ready = false;

    proc.stdout.on("data", (data: Buffer) => {
      if (!ready && data.toString().includes("MOCK_SERVER_READY")) {
        ready = true;
        globalThis.__MOCK_SERVER__ = proc;
        resolve();
      }
    });

    proc.stderr.on("data", (data: Buffer) => {
      if (!ready) {
        // ws 模块缺失时在这里报错
        reject(new Error(`Mock server error: ${data.toString()}`));
      }
    });

    proc.on("exit", (code) => {
      if (!ready) {
        reject(new Error(`Mock server exited early with code ${code}`));
      }
    });

    // 超时保护
    setTimeout(() => {
      if (!ready) reject(new Error("Mock server startup timeout"));
    }, 5000);
  });
}
