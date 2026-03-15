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
const interactionPolicy = window.GreywindLive2DInteractionPolicy;

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
    document.body.dataset.modelReady = "true";
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
    document.body.dataset.modelReady = "false";
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

// ── 鼠标穿透 + 拖拽 ──
// 穿透：setIgnoreMouseEvents(true, { forward: true }) + 几何命中检测
// 拖拽：命中模型时 mousedown → Win32 原生拖拽（或 JS fallback）
(async function setupClickThrough() {
  const interactionPolicy = window.GreywindLive2DInteractionPolicy;
  let modelReady = document.body.dataset.modelReady === "true";
  let ignoring = interactionPolicy.resolveIgnoreMouseRequest(
    window.greywind?.platform,
    true
  );

  // 拖拽状态
  let dragging = false;
  let dragStartScreenX = 0;
  let dragStartScreenY = 0;
  const useNativeDrag = await window.greywind?.hasNativeDrag?.() || false;
  console.log("[drag] useNativeDrag:", useNativeDrag);

  function syncFallbackDrag() {
    modelReady = document.body.dataset.modelReady === "true";
    const fallbackDrag = interactionPolicy.shouldEnableFallbackDrag({
      modelReady,
      interactionAvailable: interactionPolicy.hasModelHitCapability(live2dModel),
    });
    document.body.dataset.dragFallback = fallbackDrag ? "true" : "false";
    if (fallbackDrag) {
      setIgnore(false);
    }
    return fallbackDrag;
  }

  function setIgnore(shouldIgnore) {
    const nextIgnore = interactionPolicy.resolveIgnoreMouseRequest(
      window.greywind?.platform,
      shouldIgnore
    );
    if (nextIgnore === ignoring) return;
    ignoring = nextIgnore;
    window.greywind?.setIgnoreMouse?.(nextIgnore);
  }

  // 检测 (x, y) 是否命中模型。优先 hitArea，缺失时回退到包围盒。
  function isOpaqueAt(x, y) {
    return interactionPolicy.isPointOnModel(live2dModel, x, y);
  }

  // 检测是否在输入区域内
  function isInInputArea(target) {
    const inputArea = document.getElementById("input-area");
    return inputArea && inputArea.contains(target);
  }

  // 检测是否在聊天气泡上
  function isInChatMsg(target) {
    return target && target.closest && target.closest(".msg") !== null;
  }

  // 在模型不透明区域按下时开始拖拽
  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (syncFallbackDrag()) return;
    if (isInInputArea(e.target) || isInChatMsg(e.target)) return;
    if (!isOpaqueAt(e.clientX, e.clientY)) return;

    if (useNativeDrag) {
      // Win32 原生拖拽：WM_SYSCOMMAND SC_MOVE，零闪烁
      window.greywind.nativeDrag();
      return;
    }

    dragging = true;
    dragStartScreenX = e.screenX;
    dragStartScreenY = e.screenY;
    window.greywind?.startDrag?.();
  });

  document.addEventListener("mousemove", (e) => {
    // 拖拽中：移动窗口（JS fallback 路径）
    if (dragging) {
      const dx = e.screenX - dragStartScreenX;
      const dy = e.screenY - dragStartScreenY;
      window.greywind?.dragMove?.(dx, dy);
      return;
    }
    if (syncFallbackDrag()) return;
    // 输入区域和聊天气泡始终不穿透
    if (isInInputArea(e.target) || isInChatMsg(e.target)) {
      setIgnore(false);
      return;
    }
    // 模型区域：几何命中检测
    setIgnore(!isOpaqueAt(e.clientX, e.clientY));
  }, { passive: true });

  document.addEventListener("mouseup", (e) => {
    dragging = false;
    if (syncFallbackDrag()) return;
    // 松手后立即按当前位置重新判定穿透状态
    if (isInInputArea(e.target) || isInChatMsg(e.target)) {
      setIgnore(false);
    } else {
      setIgnore(!isOpaqueAt(e.clientX, e.clientY));
    }
  });

  // 鼠标离开窗口时恢复穿透并停止拖拽
  document.addEventListener("mouseleave", () => {
    dragging = false;
    if (!syncFallbackDrag()) {
      setIgnore(true);
    }
  }, { passive: true });

  syncFallbackDrag();
})();
