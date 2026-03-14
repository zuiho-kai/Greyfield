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
const REALTIME_TYPES = new Set(["audio_chunk", "screen_capture"]);
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
        // 根据后端配置决定是否启动截屏
        if (e.screen_sense) {
          const interval = (data.screen && data.screen.capture_interval)
            ? data.screen.capture_interval * 1000
            : SCREEN_CAPTURE_INTERVAL_MS;
          const monitor = (data.screen && data.screen.monitor) || "active";
          startScreenCapture(interval, monitor);
        }
      })
      .catch(() => {
        // health 请求失败时用默认值启动截屏
        startScreenCapture(SCREEN_CAPTURE_INTERVAL_MS);
      });
  };

  ws.onclose = () => {
    pendingAudioMeta = null;
    stopScreenCapture();
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

/**
 * 屏幕截图定时器 — 每 N 秒截屏并通过 WebSocket 发给后端
 */
let screenCaptureTimer = null;
let screenCaptureEnabled = false;
let screenMonitorMode = "active";
const SCREEN_CAPTURE_INTERVAL_MS = 3000; // fallback default

function startScreenCapture(intervalMs, monitor) {
  if (screenCaptureTimer) return;
  const interval = intervalMs || SCREEN_CAPTURE_INTERVAL_MS;
  if (monitor) screenMonitorMode = monitor;
  screenCaptureEnabled = true;
  screenCaptureTimer = setInterval(async () => {
    if (!screenCaptureEnabled) return;
    if (!window.greywind?.captureScreen) return;
    try {
      const result = await window.greywind.captureScreen({ monitor: screenMonitorMode });
      if (result.ok) {
        // 多屏模式：逐个发送每块屏幕的截图，带 screen_index 区分
        const screens = result.all_screens || (result.image_base64 ? [result.image_base64] : []);
        for (let i = 0; i < screens.length; i++) {
          wsSend({
            type: "screen_capture",
            payload: {
              image_base64: screens[i],
              window_title: result.window_title || "",
              screen_index: i,
            },
          });
        }
      }
    } catch (err) {
      console.debug("截屏失败:", err);
    }
  }, interval);
}

function stopScreenCapture() {
  screenCaptureEnabled = false;
  if (screenCaptureTimer) {
    clearInterval(screenCaptureTimer);
    screenCaptureTimer = null;
  }
}

// 监听设置页面变更，即时响应 enabled 开关
if (window.greywind?.onScreenSettingsChanged) {
  window.greywind.onScreenSettingsChanged((data) => {
    if (data.enabled === false) {
      stopScreenCapture();
    } else if (data.enabled === true && !screenCaptureTimer) {
      // 重新从 health API 获取配置启动截屏
      fetch("http://127.0.0.1:12393/health")
        .then((r) => r.json())
        .then((h) => {
          const interval = (h.screen && h.screen.capture_interval)
            ? h.screen.capture_interval * 1000
            : SCREEN_CAPTURE_INTERVAL_MS;
          const monitor = (h.screen && h.screen.monitor) || "active";
          startScreenCapture(interval, monitor);
        })
        .catch(() => startScreenCapture(SCREEN_CAPTURE_INTERVAL_MS));
    }
    if (data.monitor) {
      screenMonitorMode = data.monitor;
    }
  });
}
