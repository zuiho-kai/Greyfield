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
  hasModelHitCapability,
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

test("只有定义了 hitArea 的模型才具备命中检测能力", () => {
  const modelWithHitArea = {
    hitTest: () => [],
    internalModel: {
      getHitAreaDefs: () => [{ name: "Body" }],
    },
  };
  const modelWithoutHitArea = {
    hitTest: () => [],
    getBounds: () => ({ x: 10, y: 20, width: 30, height: 40 }),
    internalModel: {
      getHitAreaDefs: () => [],
    },
  };

  assert.equal(hasModelHitCapability(modelWithHitArea), true);
  assert.equal(hasModelHitCapability(modelWithoutHitArea), false);
});

test("命中 hitArea 时判定为模型不透明区域", () => {
  const model = {
    hitTest: (x, y) => (x === 12 && y === 34 ? ["Body"] : []),
    internalModel: {
      getHitAreaDefs: () => [{ name: "Body" }],
    },
  };

  assert.equal(isPointOnModel(model, 12, 34), true);
});

test("没有 hitArea 命中时不退化成包围盒拦截", () => {
  const model = {
    hitTest: () => [],
    getBounds: () => ({ x: 10, y: 20, width: 30, height: 40 }),
    internalModel: {
      getHitAreaDefs: () => [{ name: "Body" }],
    },
  };

  assert.equal(isPointOnModel(model, 25, 30), false);
});

test("没有 hitArea 定义的模型不参与命中判定", () => {
  const model = {
    hitTest: () => ["Body"],
    getBounds: () => ({ x: 10, y: 20, width: 30, height: 40 }),
    internalModel: {
      getHitAreaDefs: () => [],
    },
  };

  assert.equal(isPointOnModel(model, 10, 10), false);
});
