/**
 * Live2D 渲染器 — pixi-live2d-display 加载 Cubism4 模型
 * 提供全局 live2dModel 供 voice-ui.js 驱动口型
 */
const canvas = document.getElementById("live2d-canvas");
const placeholder = document.getElementById("placeholder");

// 全局引用，供口型同步和表情使用
let live2dModel = null;
// 模型原始尺寸，用于 resize 计算
let modelBaseWidth = 0;
let modelBaseHeight = 0;

const { Live2DModel } = PIXI.live2d;

// pixi-live2d-display 需要注册 Ticker 才能驱动模型更新
Live2DModel.registerTicker(PIXI.Ticker);

async function initLive2D() {
  const dpr = window.devicePixelRatio || 1;
  const app = new PIXI.Application({
    view: canvas,
    resizeTo: canvas.parentElement,
    backgroundAlpha: 0,
    antialias: true,
    resolution: dpr,
    autoDensity: true,
  });

  try {
    if (placeholder) {
      placeholder.textContent = "模型下载中...";
    }
    const result = await window.greywind?.getLive2DModelUrl?.();
    if (!result?.ok || !result?.url) {
      throw new Error(result?.error || "Live2D 模型不可用");
    }
    const model = await Live2DModel.from(result.url);
    live2dModel = model;
    modelBaseWidth = model.width;
    modelBaseHeight = model.height;

    fitModel(app, model);
    app.stage.addChild(model);
    placeholder.style.display = "none";

    window.addEventListener("resize", () => fitModel(app, model));

    console.log("Live2D 模型加载成功");
  } catch (e) {
    console.error("Live2D 模型加载失败:", e);
    placeholder.textContent = "灰风 (模型加载失败)";
  }
}

function fitModel(app, model) {
  const scale = Math.min(
    app.screen.width / modelBaseWidth,
    app.screen.height / modelBaseHeight
  ) * 0.8;
  model.scale.set(scale);
  model.x = (app.screen.width - modelBaseWidth * scale) / 2;
  model.y = (app.screen.height - modelBaseHeight * scale) / 2;
}

// 表情：根据状态调整参数
wsOn("status", (p) => {
  if (!live2dModel) return;
  const core = live2dModel.internalModel?.coreModel;
  if (!core) return;

  if (p.state === "thinking") {
    core.setParameterValueById("ParamEyeLOpen", 0.6);
    core.setParameterValueById("ParamEyeROpen", 0.6);
    core.setParameterValueById("ParamBrowLY", -0.3);
    core.setParameterValueById("ParamBrowRY", -0.3);
  } else if (p.state === "idle") {
    core.setParameterValueById("ParamEyeLOpen", 1);
    core.setParameterValueById("ParamEyeROpen", 1);
    core.setParameterValueById("ParamBrowLY", 0);
    core.setParameterValueById("ParamBrowRY", 0);
    core.setParameterValueById("ParamMouthOpenY", 0);
  }
});

initLive2D();
