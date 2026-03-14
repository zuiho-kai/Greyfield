/**
 * WebSocket 客户端 — 连接灰风后端
 */
const WS_URL = "ws://127.0.0.1:12393/ws";
let ws = null;
let reconnectTimer = null;
let pendingAudioMeta = null;
const listeners = {};
const sendQueue = [];
// 实时流消息不缓冲，断线时直接丢弃
const REALTIME_TYPES = new Set(["audio_chunk"]);
const SEND_QUEUE_MAX = 50;

function wsOn(type, fn) {
  (listeners[type] = listeners[type] || []).push(fn);
}

function wsEmit(type, data) {
  (listeners[type] || []).forEach((fn) => fn(data));
}

function wsSend(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    // 实时流消息断线时丢弃，避免重连后重放过期数据
    if (REALTIME_TYPES.has(msg.type)) return;
    if (sendQueue.length < SEND_QUEUE_MAX) {
      sendQueue.push(msg);
    }
  }
}

function flushSendQueue() {
  while (sendQueue.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(sendQueue.shift()));
  }
}

function wsConnect() {
  if (ws) ws.close();
  ws = new WebSocket(WS_URL);
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    document.getElementById("status-bar").textContent = "已连接";
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    flushSendQueue();
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
    pendingAudioMeta = null;
    document.getElementById("status-bar").textContent =
      "已断开 - 重连中...";
    reconnectTimer = setTimeout(wsConnect, 3000);
  };

  ws.onerror = () => ws.close();

  ws.onmessage = (e) => {
    if (typeof e.data !== "string") {
      if (!(e.data instanceof ArrayBuffer) || !pendingAudioMeta) {
        console.warn("Unexpected binary WS message", e.data);
        pendingAudioMeta = null;
        return;
      }
      const payload = { ...pendingAudioMeta, audio_buffer: e.data };
      pendingAudioMeta = null;
      wsEmit("reply_audio", payload);
      return;
    }

    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "reply_audio_meta") {
        pendingAudioMeta = msg.payload;
        return;
      }
      wsEmit(msg.type, msg.payload);
    } catch (err) {
      console.error("消息解析失败", err);
    }
  };
}

wsConnect();
