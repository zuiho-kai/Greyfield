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

// ── 拖拽 + 区域穿透 ──
// 默认穿透 + forward：鼠标在模型/输入区/聊天气泡上时取消穿透，离开时恢复穿透
(async function setupDragAndClickThrough() {
  let dragging = false;
  let dragStartScreenX = 0;
  let dragStartScreenY = 0;
  let dragRafPending = false;
  let dragLatestDx = 0;
  let dragLatestDy = 0;
  const useNativeDrag = await window.greywind?.hasNativeDrag?.() || false;
  console.log("[drag] useNativeDrag:", useNativeDrag);

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    window.greywind?.endDrag?.();
  }

  const dragOverlay = document.getElementById("drag-overlay");

  // 在 overlay 上监听拖拽（完全绕过 PIXI 事件系统）
  dragOverlay.addEventListener("pointerdown", (e) => {
    console.log("[drag] pointerdown on overlay, button:", e.button, "native:", useNativeDrag);
    if (e.button !== 0) return;

    if (useNativeDrag) {
      // Win32 原生拖拽：SendMessage WM_NCLBUTTONDOWN，零闪烁
      window.greywind.nativeDrag();
      return;
    }


    dragging = true;
    dragStartScreenX = e.screenX;
    dragStartScreenY = e.screenY;
    dragOverlay.style.cursor = "grabbing";
    window.greywind?.startDrag?.();
    console.log("[drag] startDrag sent, screen:", e.screenX, e.screenY);
  });

  dragOverlay.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dragLatestDx = e.screenX - dragStartScreenX;
    dragLatestDy = e.screenY - dragStartScreenY;
    console.log("[drag] pointermove dx:", dragLatestDx, "dy:", dragLatestDy);
    if (!dragRafPending) {
      dragRafPending = true;
      requestAnimationFrame(() => {
        dragRafPending = false;
        window.greywind?.dragMove?.(dragLatestDx, dragLatestDy);
      });
    }
  });

  function onDragEnd() {
    endDrag();
    dragOverlay.style.cursor = "grab";
  }
  dragOverlay.addEventListener("pointerup", onDragEnd);
  dragOverlay.addEventListener("pointercancel", onDragEnd);
  dragOverlay.addEventListener("lostpointercapture", onDragEnd);
  window.addEventListener("blur", () => endDrag());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) endDrag();
  });

  // ── 区域穿透：始终 forward，只在交互区域内临时取消穿透 ──
  // 思路：mousemove 持续检测位置，进入交互区时取消穿透，离开时恢复
  // 关键：取消穿透后鼠标仍在窗口上，所以 mousemove 能持续触发来检测离开
  let isIgnoring = true; // 初始状态与 main.js 一致：穿透 + forward

  let pixelDebugCounter = 0;
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
