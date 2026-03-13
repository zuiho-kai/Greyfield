/**
 * Live2D 渲染器 — 加载并显示 Live2D 模型
 * Spine 阶段：占位实现，后续接入 pixi-live2d-display
 */
const canvas = document.getElementById("live2d-canvas");
const placeholder = document.getElementById("placeholder");

// Spine 阶段暂用占位符，Live2D 模型接入后隐藏
// 需要：pixi.js + live2dcubismcore + pixi-live2d-display
// 以及 live2d-models/ 目录下的模型文件

let mouthOpen = false;

wsOn("reply_audio", () => {
  mouthOpen = true;
  placeholder.style.opacity = "0.6";
  placeholder.textContent = "灰风 (说话中)";
});

wsOn("status", (p) => {
  if (p.state === "idle") {
    mouthOpen = false;
    placeholder.style.opacity = "0.3";
    placeholder.textContent = "灰风";
  } else if (p.state === "thinking") {
    placeholder.textContent = "灰风 (思考中)";
    placeholder.style.opacity = "0.4";
  }
});

console.log("Live2D 渲染器已加载（占位模式）");
