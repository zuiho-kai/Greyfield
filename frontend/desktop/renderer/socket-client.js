/**
 * WebSocket 客户端 — 连接灰风后端
 */
const WS_URL = "ws://127.0.0.1:12393/ws";
let ws = null;
let reconnectTimer = null;
const listeners = {};

function wsOn(type, fn) {
  (listeners[type] = listeners[type] || []).push(fn);
}

function wsEmit(type, data) {
  (listeners[type] || []).forEach((fn) => fn(data));
}

function wsSend(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function wsConnect() {
  if (ws) ws.close();
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    document.getElementById("status-bar").textContent = "已连接";
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    // 检查引擎状态
    fetch("http://127.0.0.1:12393/health")
      .then((r) => r.json())
      .then((data) => {
        const e = data.engines || {};
        const missing = [];
        if (!e.vad) missing.push("VAD（语音检测）");
        if (!e.asr) missing.push("ASR（语音识别）");
        if (!e.tts) missing.push("TTS（语音合成）");
        if (missing.length > 0) {
          console.warn("引擎未加载:", missing.join(", "));
          document.getElementById("status-bar").textContent =
            "已连接 | 不可用: " + missing.join(", ");
        }
      })
      .catch(() => {});
  };

  ws.onclose = () => {
    document.getElementById("status-bar").textContent = "已断开 - 重连中...";
    reconnectTimer = setTimeout(wsConnect, 3000);
  };

  ws.onerror = () => ws.close();

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      wsEmit(msg.type, msg.payload);
    } catch (err) {
      console.error("消息解析失败", err);
    }
  };
}

wsConnect();
