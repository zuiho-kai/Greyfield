/**
 * WebSocket client for the local GreyWind backend.
 */
const WS_URL = "ws://127.0.0.1:12393/ws";
let ws = null;
let reconnectTimer = null;
let pendingAudioMeta = null;
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
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    document.getElementById("status-bar").textContent = "\u5df2\u8fde\u63a5";
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    fetch("http://127.0.0.1:12393/health")
      .then((r) => r.json())
      .then((data) => {
        const e = data.engines || {};
        const missing = [];
        if (!e.vad) missing.push("VAD\uff08\u8bed\u97f3\u68c0\u6d4b\uff09");
        if (!e.asr) missing.push("ASR\uff08\u8bed\u97f3\u8bc6\u522b\uff09");
        if (!e.tts) missing.push("TTS\uff08\u8bed\u97f3\u5408\u6210\uff09");
        if (missing.length > 0) {
          console.warn("\u5f15\u64ce\u672a\u52a0\u8f7d", missing.join(", "));
          document.getElementById("status-bar").textContent =
            "\u5df2\u8fde\u63a5 | \u4e0d\u53ef\u7528: " + missing.join(", ");
        }
      })
      .catch(() => {});
  };

  ws.onclose = () => {
    pendingAudioMeta = null;
    document.getElementById("status-bar").textContent =
      "\u5df2\u65ad\u5f00 - \u91cd\u8fde\u4e2d...";
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
      console.error("\u6d88\u606f\u89e3\u6790\u5931\u8d25", err);
    }
  };
}

wsConnect();
