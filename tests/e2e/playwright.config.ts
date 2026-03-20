import { defineConfig } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    // Electron 测试不需要 baseURL
  },
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
});
