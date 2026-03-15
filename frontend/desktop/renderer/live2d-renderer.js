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

// 应用渲染设置
function applyRenderSettings(cfg) {
  // 气泡毛玻璃
  document.documentElement.style.setProperty(
    "--msg-blur",
    cfg.bubbleBlur !== false ? "blur(8px)" : "none"
  );
}

async function initLive2D() {
  // 读取渲染设置
  const renderCfg = (await window.greywind?.getRenderSettings?.()) || {};
  applyRenderSettings(renderCfg);

  // 监听设置变更（即时生效）
  window.greywind?.onRenderSettingsChanged?.((cfg) => applyRenderSettings(cfg));

  const dpr = renderCfg.hiDpi ? (window.devicePixelRatio || 1) : 1;
  const app = new PIXI.Application({
    view: canvas,
    width: canvas.parentElement.clientWidth,
    height: canvas.parentElement.clientHeight,
    backgroundAlpha: 0,
    antialias: false,
    resolution: dpr,
    autoDensity: true,
  });

  try {
    if (placeholder) {
      placeholder.textContent = "模型加载中...";
    }
    const result = await window.greywind?.getLive2DModelUrl?.();
    if (!result?.ok || !result?.url) {
      throw new Error(result?.error || "Live2D 模型不可用");
    }
    const model = await Live2DModel.from(result.url);
    live2dModel = model;
    modelBaseWidth = model.internalModel.originalWidth;
    modelBaseHeight = model.internalModel.originalHeight;

    fitModel(app, model);
    app.stage.addChild(model);
    placeholder.style.display = "none";

    console.log("Live2D 模型加载成功");
  } catch (e) {
    console.error("Live2D 模型加载失败:", e);
    const msg = e?.message ? `Live2D: ${e.message}` : "Live2D 模型加载失败";
    placeholder.textContent = msg;
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

// ── 鼠标穿透：透明区域穿透，模型/输入区不穿透 ──
// 拖拽由 CSS -webkit-app-region: drag 处理，无需 JS IPC
(function setupClickThrough() {
  let ignoring = true; // 与主进程默认状态一致
  let rafPending = false;

  function setIgnore(shouldIgnore) {
    if (shouldIgnore === ignoring) return;
    ignoring = shouldIgnore;
    window.greywind?.setIgnoreMouse?.(shouldIgnore);
  }

  // 检测 (x, y) 是否命中模型包围盒
  function isOpaqueAt(x, y) {
    if (!live2dModel) return true;
    const mx = live2dModel.x;
    const my = live2dModel.y;
    const mw = modelBaseWidth * live2dModel.scale.x;
    const mh = modelBaseHeight * live2dModel.scale.y;
    return x >= mx && x <= mx + mw && y >= my && y <= my + mh;
  }

  function isInInputArea(target) {
    const inputArea = document.getElementById("input-area");
    return inputArea && inputArea.contains(target);
  }

  function isInChatMsg(target) {
    return target && target.closest && target.closest(".msg") !== null;
  }

  document.addEventListener("mousemove", (e) => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      // 输入区域和聊天气泡始终不穿透
      if (isInInputArea(e.target) || isInChatMsg(e.target)) {
        setIgnore(false);
        return;
      }
      setIgnore(!isOpaqueAt(e.clientX, e.clientY));
    });
  }, { passive: true });

  // 鼠标离开窗口时恢复穿透
  document.addEventListener("mouseleave", () => {
    setIgnore(true);
  }, { passive: true });
})();
