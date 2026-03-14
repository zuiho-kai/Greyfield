const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const desktopDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(desktopDir, "package.json");
const runtimePathsPath = path.join(desktopDir, "runtime-paths.js");

test("desktop package bundles staged backend runtime instead of raw venv", () => {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const extraResources = pkg.build?.extraResources ?? [];
  const fromPaths = extraResources.map((entry) => entry.from);

  assert.ok(
    fromPaths.includes("build/backend-runtime"),
    "expected build.extraResources to include build/backend-runtime"
  );
  assert.equal(
    fromPaths.some((entry) => entry.includes(".venv")),
    false,
    "build.extraResources should not copy a raw .venv directory"
  );
});

test("packaged python executable resolves to embedded runtime", () => {
  const runtimePaths = require(runtimePathsPath);
  const packaged = runtimePaths.resolvePythonExecutable({
    isPackaged: true,
    projectRoot: "C:\\Greyfield\\resources\\backend",
    resourcesPath: "C:\\Greyfield\\resources",
    platform: "win32",
    existsSync: () => true,
  });

  assert.equal(
    packaged,
    "C:\\Greyfield\\resources\\backend\\python\\python.exe"
  );
});
