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
      placeholder.textContent = "模型加载中...";
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
// ── 手动拖拽：在模型不透明区域按住拖动移动窗口 ──
(function setupClickThrough() {
  const ALPHA_THRESHOLD = 10;
  let ignoring = true; // 与主进程默认状态一致

  // 拖拽状态
  let dragging = false;
  let dragStartScreenX = 0;
  let dragStartScreenY = 0;

  function setIgnore(shouldIgnore) {
    if (shouldIgnore === ignoring) return;
    ignoring = shouldIgnore;
    window.greywind?.setIgnoreMouse?.(shouldIgnore);
  }

  // 检测 canvas 上 (x, y) 处像素是否不透明
  function isOpaqueAt(x, y) {
    if (!canvas) return false;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cx = Math.round((x - rect.left) * dpr);
    const cy = Math.round((y - rect.top) * dpr);
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return false;
    const pixel = new Uint8Array(4);
    gl.readPixels(cx, gl.drawingBufferHeight - cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return pixel[3] > ALPHA_THRESHOLD;
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
    if (e.button !== 0) return; // 只响应左键
    if (isInInputArea(e.target) || isInChatMsg(e.target)) return;
    if (!isOpaqueAt(e.clientX, e.clientY)) return;
    dragging = true;
    dragStartScreenX = e.screenX;
    dragStartScreenY = e.screenY;
    window.greywind?.startDrag?.();
  });

  document.addEventListener("mousemove", (e) => {
    // 拖拽中：移动窗口
    if (dragging) {
      const dx = e.screenX - dragStartScreenX;
      const dy = e.screenY - dragStartScreenY;
      window.greywind?.dragMove?.(dx, dy);
      return;
    }
    // 输入区域和聊天气泡始终不穿透
    if (isInInputArea(e.target) || isInChatMsg(e.target)) {
      setIgnore(false);
      return;
    }
    // canvas 区域：检测像素
    setIgnore(!isOpaqueAt(e.clientX, e.clientY));
  }, { passive: true });

  document.addEventListener("mouseup", (e) => {
    dragging = false;
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
    setIgnore(true);
  }, { passive: true });
})();
