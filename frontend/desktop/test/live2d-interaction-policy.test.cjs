const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const policyPath = path.resolve(
  __dirname,
  "..",
  "renderer",
  "live2d-interaction-policy.js"
);
const {
  resolveIgnoreMouseRequest,
  shouldEnableFallbackDrag,
} = require(policyPath);

test("linux 平台始终拒绝开启鼠标穿透", () => {
  assert.equal(resolveIgnoreMouseRequest("linux", true), false);
  assert.equal(resolveIgnoreMouseRequest("linux", false), false);
});

test("支持的平台保留请求的鼠标穿透状态", () => {
  assert.equal(resolveIgnoreMouseRequest("win32", true), true);
  assert.equal(resolveIgnoreMouseRequest("darwin", false), false);
});

test("模型未就绪时启用拖拽回退", () => {
  assert.equal(
    shouldEnableFallbackDrag({ modelReady: false, hitTestAvailable: true }),
    true
  );
});

test("命中检测不可用时启用拖拽回退", () => {
  assert.equal(
    shouldEnableFallbackDrag({ modelReady: true, hitTestAvailable: false }),
    true
  );
});

test("模型已就绪且可命中时关闭拖拽回退", () => {
  assert.equal(
    shouldEnableFallbackDrag({ modelReady: true, hitTestAvailable: true }),
    false
  );
});
