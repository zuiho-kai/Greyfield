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

// ── 拖拽 ──
// 默认不穿透，窗口始终接收鼠标。穿透由托盘菜单手动切换。
// 用 setShape 限制可点击区域为模型包围盒 + 输入区。
(async function setupDrag() {
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

  // ── setShape：限制可点击区域为模型包围盒 + 输入区 ──
  function updateClickShape() {
    if (!window.greywind?.setClickShape) return;
    const rects = [];
    // 模型包围盒
    if (live2dModel) {
      const mx = Math.round(live2dModel.x);
      const my = Math.round(live2dModel.y);
      const mw = Math.round(modelBaseWidth * live2dModel.scale.x);
      const mh = Math.round(modelBaseHeight * live2dModel.scale.y);
      rects.push({ x: mx, y: my, width: mw, height: mh });
    }
    // 输入区
    const inputArea = document.getElementById("input-area");
    if (inputArea) {
      const r = inputArea.getBoundingClientRect();
      rects.push({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) });
    }
    // 聊天气泡区
    const chatBox = document.getElementById("chat-box");
    if (chatBox && chatBox.children.length > 0) {
      const r = chatBox.getBoundingClientRect();
      rects.push({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) });
    }
    console.log("[shape] updateClickShape rects:", JSON.stringify(rects));
    window.greywind.setClickShape(rects);
  }

  // 模型加载后设置一次，之后不需要频繁更新
  // 用 MutationObserver 监听聊天气泡变化时更新
  const chatBox = document.getElementById("chat-box");
  if (chatBox) {
    new MutationObserver(() => updateClickShape()).observe(chatBox, { childList: true });
  }
  // 初始延迟设置（等模型加载完）
  const shapeInterval = setInterval(() => {
    if (live2dModel) {
      updateClickShape();
      clearInterval(shapeInterval);
    }
  }, 500);

  // 穿透模式关闭后，主进程通知 renderer 重新设置 shape
  window.greywind?.onRefreshClickShape?.(() => updateClickShape());
})();
