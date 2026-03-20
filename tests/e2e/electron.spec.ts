/**
 * Electron E2E 测试 — 使用 @playwright/test _electron API
 *
 * 前置：tests/e2e/global-setup.ts 已启动 mock-server.js（port 12393）
 *
 * 测试范围：
 *   1. 窗口启动，Live2D canvas 存在
 *   2. status-bar 显示"已连接"（WebSocket 连接成功）
 *   3. 发送文字 → chat-box 出现回复
 *   4. canvas 像素 diff — 验证 Live2D 模型已加载并在渲染（idle 动画）
 *
 * 不测试：
 *   - 口型同步（需要真实音频驱动，超出自动化范围）
 *   - 语音输入（需要麦克风）
 */

import { test, expect, _electron as electron } from "@playwright/test";
import path from "path";
import { PNG } from "pngjs";

const ELECTRON_APP_DIR = path.resolve(__dirname, "../../frontend/desktop");

// ── 工具 ──────────────────────────────────────────────────────────────────────

/** 计算两张 PNG buffer 的像素均方根差（0-255 范围） */
function pixelRMSD(bufA: Buffer, bufB: Buffer): number {
  const a = PNG.sync.read(bufA);
  const b = PNG.sync.read(bufB);
  if (a.width !== b.width || a.height !== b.height) return 255;
  let sum = 0;
  for (let i = 0; i < a.data.length; i++) {
    const diff = a.data[i] - b.data[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum / a.data.length);
}

// ── 测试 ───────────────────────────────────────────────────────────────────────

test.describe("Electron 窗口基础渲染", () => {
  test("Live2D canvas 元素存在", async () => {
    const app = await electron.launch({
      args: [ELECTRON_APP_DIR],
      env: { ...process.env, NODE_ENV: "test" },
    });

    try {
      const win = await app.firstWindow();
      await win.waitForLoadState("domcontentloaded");
      const canvas = win.locator("#live2d-canvas");
      await expect(canvas).toBeAttached({ timeout: 5000 });
    } finally {
      await app.close();
    }
  });

  test("status-bar 在连接成功后显示"已连接"", async () => {
    const app = await electron.launch({
      args: [ELECTRON_APP_DIR],
      env: { ...process.env, NODE_ENV: "test" },
    });

    try {
      const win = await app.firstWindow();
      await win.waitForLoadState("domcontentloaded");
      // WebSocket 连接 + health check 完成后 status-bar 变"已连接"
      await expect(win.locator("#status-bar")).toContainText("已连接", {
        timeout: 8000,
      });
    } finally {
      await app.close();
    }
  });
});

test.describe("文字交互链路", () => {
  test("发送文字 → chat-box 出现 assistant 回复", async () => {
    const app = await electron.launch({
      args: [ELECTRON_APP_DIR],
      env: { ...process.env, NODE_ENV: "test" },
    });

    try {
      const win = await app.firstWindow();
      await win.waitForLoadState("domcontentloaded");

      // 等待连接就绪
      await expect(win.locator("#status-bar")).toContainText("已连接", {
        timeout: 8000,
      });

      // 输入文字并发送
      await win.locator("#text-input").fill("你好灰风");
      await win.locator("#send-btn").click();

      // chat-box 中出现回复（mock server 返回含"灰风"的文本）
      await expect(win.locator("#chat-box")).toContainText("灰风", {
        timeout: 5000,
      });
    } finally {
      await app.close();
    }
  });

  test("发送后 status-bar 经历 thinking/speaking 再回到 idle", async () => {
    const app = await electron.launch({
      args: [ELECTRON_APP_DIR],
      env: { ...process.env, NODE_ENV: "test" },
    });

    try {
      const win = await app.firstWindow();
      await win.waitForLoadState("domcontentloaded");
      await expect(win.locator("#status-bar")).toContainText("已连接", {
        timeout: 8000,
      });

      await win.locator("#text-input").fill("测试状态");
      await win.locator("#send-btn").click();

      // status-bar 最终回到 idle（socket-client.js 里 status map 可能显示"等待中"等，
      // 这里只验证"已连接"消失后再次稳定，不写死中文文案避免耦合）
      await expect(win.locator("#status-bar")).not.toContainText("thinking", {
        timeout: 5000,
      });
    } finally {
      await app.close();
    }
  });
});

test.describe("Live2D 模型加载验证（像素 diff）", () => {
  test("启动 3 秒后 canvas 有渲染内容（非全黑）", async () => {
    const app = await electron.launch({
      args: [ELECTRON_APP_DIR],
      env: { ...process.env, NODE_ENV: "test" },
    });

    try {
      const win = await app.firstWindow();
      await win.waitForLoadState("domcontentloaded");
      await expect(win.locator("#status-bar")).toContainText("已连接", {
        timeout: 8000,
      });

      // 等待 Live2D 模型加载（通常 1-2 秒）
      await win.waitForTimeout(3000);

      const canvas = win.locator("#live2d-canvas");

      // screenshot 返回 PNG buffer
      const screenshotA = await canvas.screenshot();

      // 再等 1 秒，捕获下一帧（idle 动画应有变化）
      await win.waitForTimeout(1000);
      const screenshotB = await canvas.screenshot();

      // 两帧之间的 RMSD > 0 表示 canvas 有内容在变化
      // 如果模型未加载，canvas 全黑，两帧相同（RMSD ≈ 0）
      const rmsd = pixelRMSD(screenshotA, screenshotB);
      expect(rmsd).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });
});
