const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rendererPath = path.resolve(
  __dirname,
  "..",
  "renderer",
  "live2d-renderer.js"
);

test("live2d 渲染器不再依赖 readPixels 命中检测", () => {
  const source = fs.readFileSync(rendererPath, "utf-8");

  assert.equal(
    source.includes("readPixels("),
    false,
    "renderer should not sample the default framebuffer via readPixels"
  );
});
