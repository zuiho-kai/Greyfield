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
// PIXI app 引用，供穿透检测读 GL context
let pixiApp = null;

// 用户自定义缩放/位置（相对于 fitModel 基准值的倍率和偏移）
let userTransform = { userScale: 1.0, userOffsetX: 0, userOffsetY: 0 };
// fitModel 计算出的基准值，用于 userTransform 的参照
let modelBaseScale = 1;
let modelFitX = 0;
let modelFitY = 0;

// 缩放范围常量
const SCALE_MIN = 0.3;
const SCALE_MAX = 3.0;
const SCALE_STEP = 0.1;

// 持久化防抖 timer（模块级，wheel 和 drag 共享同一 timer）
let saveTransformTimer = null;
function saveTransformDebounced() {
  if (saveTransformTimer) clearTimeout(saveTransformTimer);
  saveTransformTimer = setTimeout(() => {
    saveTransformTimer = null;
    window.greywind?.updateRenderSettings?.({
      userScale: userTransform.userScale,
      userOffsetX: userTransform.userOffsetX,
      userOffsetY: userTransform.userOffsetY,
    });
  }, 500);
}

function applyUserTransform(model) {
  if (!model) return;
  model.scale.set(modelBaseScale * userTransform.userScale);
  model.x = modelFitX + userTransform.userOffsetX;
  model.y = modelFitY + userTransform.userOffsetY;
}

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
  // 读取渲染设置（含 userTransform）
  const renderCfg = (await window.greywind?.getRenderSettings?.()) || {};
  applyRenderSettings(renderCfg);
  if (renderCfg.userScale != null) userTransform.userScale = renderCfg.userScale;
  if (renderCfg.userOffsetX != null) userTransform.userOffsetX = renderCfg.userOffsetX;
  if (renderCfg.userOffsetY != null) userTransform.userOffsetY = renderCfg.userOffsetY;

  // 监听设置变更（即时生效，含重置）
  window.greywind?.onRenderSettingsChanged?.((cfg) => {
    applyRenderSettings(cfg);
    // 处理来自设置页的重置操作
    if (cfg.userScale != null || cfg.userOffsetX != null || cfg.userOffsetY != null) {
      if (cfg.userScale != null) userTransform.userScale = cfg.userScale;
      if (cfg.userOffsetX != null) userTransform.userOffsetX = cfg.userOffsetX;
      if (cfg.userOffsetY != null) userTransform.userOffsetY = cfg.userOffsetY;
      applyUserTransform(live2dModel);
    }
  });

  const dpr = renderCfg.hiDpi ? (window.devicePixelRatio || 1) : 1;
  const app = new PIXI.Application({
    view: canvas,
    width: canvas.parentElement.clientWidth,
    height: canvas.parentElement.clientHeight,
    backgroundAlpha: 0,
    antialias: false,
    resolution: dpr,
    autoDensity: true,
    preserveDrawingBuffer: true,
  });
  pixiApp = app;

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

  // 监听模型切换事件
  let switchGeneration = 0;
  window.greywind?.onLive2DModelChanged?.(async (data) => {
    if (!data?.url || !app) return;
    const gen = ++switchGeneration;
    console.log("Live2D 模型切换:", data.url);
    try {
      if (placeholder) {
        placeholder.style.display = "block";
        placeholder.textContent = "模型切换中...";
      }
      // 销毁旧模型
      if (live2dModel) {
        app.stage.removeChild(live2dModel);
        live2dModel.destroy();
        live2dModel = null;
        document.body.dataset.modelReady = "false";
      }
      // 加载新模型
      const model = await Live2DModel.from(data.url);
      // 并发保护：加载完成后检查是否已过期
      if (gen !== switchGeneration) {
        model.destroy();
        return;
      }
      live2dModel = model;
      document.body.dataset.modelReady = "true";
      modelBaseWidth = model.internalModel.originalWidth;
      modelBaseHeight = model.internalModel.originalHeight;
      // 切换模型时重置用户偏移，避免旧模型的偏移量污染新模型，并立即写盘
      userTransform = { userScale: 1.0, userOffsetX: 0, userOffsetY: 0 };
      window.greywind?.updateRenderSettings?.({ userScale: 1.0, userOffsetX: 0, userOffsetY: 0 });
      fitModel(app, model);
      app.stage.addChild(model);
      if (placeholder) placeholder.style.display = "none";
      // 加载成功，通知主进程持久化
      if (data.modelId) {
        window.greywind?.confirmModelSwitch?.(data.modelId);
      }
      console.log("Live2D 模型切换成功");
    } catch (e) {
      if (gen !== switchGeneration) return;
      console.error("Live2D 模型切换失败:", e);
      if (placeholder) {
        placeholder.textContent = "模型切换失败: " + (e?.message || e);
      }
      document.body.dataset.modelReady = "false";
    }
  });
}

function fitModel(app, model) {
  if (!modelBaseWidth || !modelBaseHeight) return;
  // 全屏窗口：模型按原比例缩放，定位到屏幕右下角
  const targetH = app.screen.height * 0.85;
  const scale = targetH / modelBaseHeight;
  modelBaseScale = scale;
  modelFitX = app.screen.width - modelBaseWidth * scale - 20;
  modelFitY = app.screen.height - modelBaseHeight * scale - 20;
  // 叠加用户缩放和位置偏移
  applyUserTransform(model);
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

// ── 拖拽 + 区域穿透 ──
// 默认穿透 + forward：鼠标在模型/输入区/聊天气泡上时取消穿透，离开时恢复穿透
(function setupDragAndClickThrough() {
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let modelStartX = 0;
  let modelStartY = 0;

  const dragOverlay = document.getElementById("drag-overlay");

  // ── Ctrl+滚轮缩放 ──
  dragOverlay.addEventListener("wheel", (e) => {
    if (!e.ctrlKey || !live2dModel) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
    const newUserScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX,
      userTransform.userScale + delta));
    if (newUserScale === userTransform.userScale) return;
    const mx = e.clientX;
    const my = e.clientY;
    const oldScale = modelBaseScale * userTransform.userScale;
    const newScale = modelBaseScale * newUserScale;
    const ratio = newScale / oldScale;
    const newX = mx - (mx - live2dModel.x) * ratio;
    const newY = my - (my - live2dModel.y) * ratio;
    userTransform.userScale = newUserScale;
    userTransform.userOffsetX = newX - modelFitX;
    userTransform.userOffsetY = newY - modelFitY;
    applyUserTransform(live2dModel);  // 统一路径，不直接操作模型属性
    saveTransformDebounced();
  }, { passive: false });

  // 拖拽模型（不移动窗口）
  dragOverlay.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !live2dModel) return;
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    modelStartX = live2dModel.x;
    modelStartY = live2dModel.y;
    dragOverlay.style.cursor = "grabbing";
    dragOverlay.setPointerCapture(e.pointerId);
  });

  dragOverlay.addEventListener("pointermove", (e) => {
    if (!dragging || !live2dModel) return;
    const newX = modelStartX + (e.clientX - dragStartX);
    const newY = modelStartY + (e.clientY - dragStartY);
    userTransform.userOffsetX = newX - modelFitX;
    userTransform.userOffsetY = newY - modelFitY;
    applyUserTransform(live2dModel);
  });

  function onDragEnd() {
    if (dragging && live2dModel) {
      userTransform.userOffsetX = live2dModel.x - modelFitX;
      userTransform.userOffsetY = live2dModel.y - modelFitY;
      saveTransformDebounced();
    }
    dragging = false;
    dragOverlay.style.cursor = "grab";
  }
  dragOverlay.addEventListener("pointerup", onDragEnd);
  dragOverlay.addEventListener("pointercancel", onDragEnd);
  dragOverlay.addEventListener("lostpointercapture", onDragEnd);

  // ── 区域穿透：始终 forward，只在交互区域内临时取消穿透 ──
  // 思路：mousemove 持续检测位置，进入交互区时取消穿透，离开时恢复
  // 关键：取消穿透后鼠标仍在窗口上，所以 mousemove 能持续触发来检测离开
  let isIgnoring = true; // 初始状态与 main.js 一致：穿透 + forward

  function isPointInInteractiveArea(x, y) {
    // 输入区（优先检测，不需要像素判断）
    const inputArea = document.getElementById("input-area");
    if (inputArea) {
      const r = inputArea.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    }
    // 聊天气泡
    const chatBox = document.getElementById("chat-box");
    if (chatBox && chatBox.children.length > 0) {
      const r = chatBox.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    }
    // Live2D 模型：用 PIXI renderer 的 GL context 读像素 alpha
    const gl = pixiApp?.renderer?.gl;
    if (gl && canvas) {
      const rect = canvas.getBoundingClientRect();
      const dpr = pixiApp.renderer.resolution || 1;
      const cx = Math.round((x - rect.left) * dpr);
      const cy = Math.round((y - rect.top) * dpr);
      if (cx >= 0 && cy >= 0 && cx < gl.drawingBufferWidth && cy < gl.drawingBufferHeight) {
        const pixel = new Uint8Array(4);
        gl.readPixels(cx, gl.drawingBufferHeight - 1 - cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        if (pixel[3] > 10) return true;
      }
    }
    return false;
  }

  // mousemove 在两种状态下都能触发：
  // - 穿透+forward 时：Electron 转发事件到 renderer
  // - 不穿透时：正常 DOM 事件
  document.addEventListener("mousemove", (e) => {
    const onInteractive = isPointInInteractiveArea(e.clientX, e.clientY);
    if (onInteractive && isIgnoring) {
      isIgnoring = false;
      window.greywind?.setMouseIgnore?.(false);
    } else if (!onInteractive && !isIgnoring) {
      isIgnoring = true;
      window.greywind?.setMouseIgnore?.(true);
    }
  });

  // 鼠标离开窗口时恢复穿透
  document.addEventListener("mouseleave", () => {
    if (!isIgnoring) {
      isIgnoring = true;
      window.greywind?.setMouseIgnore?.(true);
    }
  });

  // 穿透模式关闭后，主进程通知 renderer 重置状态
  window.greywind?.onRefreshClickShape?.(() => {
    isIgnoring = true;
  });
})();

// 退出前 flush 防抖 timer，避免拖拽/缩放后立即关闭导致 transform 丢失
window.addEventListener("beforeunload", () => {
  if (saveTransformTimer) {
    clearTimeout(saveTransformTimer);
    saveTransformTimer = null;
    window.greywind?.updateRenderSettings?.({
      userScale: userTransform.userScale,
      userOffsetX: userTransform.userOffsetX,
      userOffsetY: userTransform.userOffsetY,
    });
  }
});
