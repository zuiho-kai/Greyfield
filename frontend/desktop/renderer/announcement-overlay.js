/**
 * 公告栏 overlay — 接收后端 announcement 消息，屏幕顶部展示后自动淡出
 */
(function () {
  const el = document.createElement("div");
  el.id = "announcement-overlay";
  Object.assign(el.style, {
    position: "fixed",
    top: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "35",
    background: "rgba(20, 20, 30, 0.85)",
    color: "#e8e8f0",
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    maxWidth: "360px",
    textAlign: "center",
    pointerEvents: "none",
    opacity: "0",
    transition: "opacity 0.3s ease",
    boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
  });

  let hideTimer = null;

  function show(text, durationMs) {
    const wasVisible = hideTimer !== null;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    el.textContent = text;
    if (!wasVisible) {
      // 从隐藏状态淡入，避免直接替换可见内容时的闪烁
      requestAnimationFrame(() => { el.style.opacity = "1"; });
    }
    hideTimer = setTimeout(() => {
      el.style.opacity = "0";
      hideTimer = null;
    }, durationMs);
  }

  // 脚本在 body 末尾执行时 DOM 已就绪，与其他 overlay JS 保持一致，直接挂载
  document.body.appendChild(el);

  wsOn("announcement", (payload) => {
    const text = payload?.text || "";
    if (!text) return;
    const duration = payload?.duration_ms ?? 5000;
    show(text, duration);
  });
})();
