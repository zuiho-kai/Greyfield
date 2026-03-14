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
  isPointOnModel,
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
    shouldEnableFallbackDrag({ modelReady: false, interactionAvailable: true }),
    true
  );
});

test("交互探测不可用时启用拖拽回退", () => {
  assert.equal(
    shouldEnableFallbackDrag({ modelReady: true, interactionAvailable: false }),
    true
  );
});

test("模型已就绪且可命中时关闭拖拽回退", () => {
  assert.equal(
    shouldEnableFallbackDrag({ modelReady: true, interactionAvailable: true }),
    false
  );
});

test("命中 hitArea 时判定为模型不透明区域", () => {
  const model = {
    hitTest: (x, y) => (x === 12 && y === 34 ? ["Body"] : []),
    getBounds: () => ({ x: 100, y: 100, width: 10, height: 10 }),
  };

  assert.equal(isPointOnModel(model, 12, 34), true);
});

test("没有 hitArea 命中时回退到包围盒判定", () => {
  const model = {
    hitTest: () => [],
    getBounds: () => ({ x: 10, y: 20, width: 30, height: 40 }),
  };

  assert.equal(isPointOnModel(model, 25, 30), true);
  assert.equal(isPointOnModel(model, 5, 30), false);
});

test("模型对象缺失时不命中模型", () => {
  assert.equal(isPointOnModel(null, 10, 10), false);
});
