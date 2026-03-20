/**
 * 灰风 E2E 测试用 Mock 后端
 *
 * 实现最小化的 HTTP + WebSocket 服务器，模拟 Python 后端协议：
 * - GET /health → 返回 ok
 * - WebSocket /ws → 接收 text_input，返回 thinking/speaking/reply_text/idle
 *
 * 用法：node mock-server.js [port]
 */

const http = require("http");
const WebSocket = require("ws");

const PORT = parseInt(process.argv[2] || "12393", 10);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        character: "灰风",
        engines: { vad: false, asr: false, tts: false, screen_sense: false },
        screen: { capture_interval: 3.0, monitor: "active" },
      })
    );
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

const wss = new WebSocket.Server({ server, path: "/ws" });

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    const { type, payload = {} } = msg;

    if (type === "text_input") {
      const userText = payload.text || "";
      const reply = `你好，我是灰风。你说了：「${userText}」`;

      // 模拟 thinking → speaking → reply_text → idle 序列
      ws.send(JSON.stringify({ type: "status", payload: { state: "thinking" } }));
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "status", payload: { state: "speaking" } }));
        ws.send(
          JSON.stringify({
            type: "reply_text",
            payload: { text: reply, emotion: "neutral" },
          })
        );
        ws.send(JSON.stringify({ type: "status", payload: { state: "idle" } }));
      }, 80);
    } else if (type === "interrupt") {
      ws.send(JSON.stringify({ type: "status", payload: { state: "idle" } }));
    } else if (type === "clear_history") {
      ws.send(JSON.stringify({ type: "status", payload: { state: "idle" } }));
    }
    // 其他消息类型静默忽略
  });

  ws.on("error", () => {});
});

server.listen(PORT, "127.0.0.1", () => {
  // 向父进程报告就绪（供 playwright globalSetup 检测）
  process.stdout.write(`MOCK_SERVER_READY:${PORT}\n`);
});

process.on("SIGTERM", () => {
  server.close();
  process.exit(0);
});
