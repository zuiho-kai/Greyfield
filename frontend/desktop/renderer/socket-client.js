/**
 * WebSocket 客户端 — 连接灰风后端
 */
const WS_URL = "ws://localhost:12393/ws";
let ws = null;
let reconnectTimer = null;
let pendingAudioMeta = null;
const listeners = {};
const sendQueue = [];
// 实时流消息不缓冲，断线时直接丢弃
const REALTIME_TYPES = new Set(["audio_chunk"]);
const SEND_QUEUE_MAX = 50;

/** 查前端设置页的截屏 enabled 状态，查不到默认关闭 */
async function checkScreenEnabled() {
  try {
    const cfg = await window.greywind?.getScreenSettings?.();
    return cfg && cfg.enabled === true;
  } catch { return false; }
}

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
        // 根据后端配置决定是否启动截屏（需前端设置 enabled 才启动）
        if (e.screen_sense) {
          checkScreenEnabled().then(enabled => {
            if (!enabled) return;
            const interval = (data.screen && data.screen.capture_interval)
              ? data.screen.capture_interval * 1000
              : 3000;
            const monitor = (data.screen && data.screen.monitor) || "active";
            window.greywind?.startScreenCapture?.({ intervalMs: interval, monitor });
          });
        }
      })
      .catch(() => {
        // health 请求失败时也需检查设置
        checkScreenEnabled().then(enabled => {
          if (!enabled) return;
          window.greywind?.startScreenCapture?.({ intervalMs: 3000 });
        });
      });
  };

  ws.onclose = () => {
    pendingAudioMeta = null;
    window.greywind?.stopScreenCapture?.();
    document.getElementById("status-bar").textContent =
      "已断开 - 重连中...";
    reconnectTimer = setTimeout(wsConnect, 3000);
  };

  ws.onerror = () => ws.close();

  ws.onmessage = (e) => {
    if (typeof e.data !== "string") {
      console.log("[ws-debug] 收到二进制消息", e.data?.byteLength, "bytes");
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
      console.log("[ws-debug] 收到消息:", msg.type, JSON.stringify(msg.payload).slice(0, 100));
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

// 监听设置页面变更，通过 IPC 通知主进程开关截屏（DEV-86：重数据不经渲染进程）
if (window.greywind?.onScreenSettingsChanged) {
  window.greywind.onScreenSettingsChanged((data) => {
    if (data.enabled === false) {
      wsSend({ type: "screen_sense_toggle", payload: { enabled: false } });
      window.greywind?.stopScreenCapture?.();
    } else if (data.enabled === true) {
      wsSend({ type: "screen_sense_toggle", payload: { enabled: true } });
      fetch("http://127.0.0.1:12393/health")
        .then((r) => r.json())
        .then((h) => {
          const interval = (h.screen && h.screen.capture_interval)
            ? h.screen.capture_interval * 1000
            : 3000;
          const monitor = (h.screen && h.screen.monitor) || "active";
          window.greywind?.startScreenCapture?.({ intervalMs: interval, monitor });
        })
        .catch(() => window.greywind?.startScreenCapture?.({ intervalMs: 3000 }));
    }
  });
}

// 监听桌面操控设置变更
if (window.greywind?.onDesktopSettingsChanged) {
  window.greywind.onDesktopSettingsChanged((data) => {
    wsSend({ type: "desktop_toggle", payload: { enabled: !!data.enabled } });
  });
}

// 主进程截屏后通过 IPC 发来 base64，renderer 通过自己的 WS 转发给后端
// 这样只有一个 WS 连接，后端的 proactive_loop 音频回传正常
if (window.greywind?.onScreenFrame) {
  window.greywind.onScreenFrame((data) => {
    wsSend({
      type: "screen_capture",
      payload: data,
    });
  });
}
