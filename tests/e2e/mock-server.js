/**
 * 灰风 E2E 测试用 Mock 后端
 */

console.log("[Mock Server] Script starting...");

try {
  const http = require("http");
  console.log("[Mock Server] http module loaded");

  const WebSocket = require("ws");
  console.log("[Mock Server] ws module loaded, version:", WebSocket.VERSION);

  const PORT = parseInt(process.argv[2] || "12393", 10);
  console.log("[Mock Server] Using port:", PORT);

  // 全局错误处理
  process.on("uncaughtException", (err) => {
    console.error("[Mock Server] Uncaught exception:", err.message, err.stack);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[Mock Server] Unhandled rejection:", reason);
  });

  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${PORT}`);

      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    } catch (err) {
      console.error("[Mock Server] HTTP error:", err.message);
      res.writeHead(500);
      res.end("Error");
    }
  });

  server.on("error", (err) => {
    console.error("[Mock Server] Server error:", err.message);
  });

  console.log("[Mock Server] Creating WebSocket server...");

  const wss = new WebSocket.Server({ server, path: "/ws" });

  wss.on("error", (err) => {
    console.error("[Mock Server] WSS error:", err.message);
  });

  wss.on("connection", (ws, req) => {
    console.log("[Mock Server] Client connected from:", req.socket?.remoteAddress);

    ws.on("error", (err) => {
      console.error("[Mock Server] WS error:", err.message);
    });

    ws.on("close", () => {
      console.log("[Mock Server] Client disconnected");
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log("[Mock Server] Received:", msg.type);

        if (msg.type === "text_input") {
          const reply = `你好，我是灰风。你说了：「${msg.payload?.text || ""}」`;

          ws.send(JSON.stringify({ type: "status", payload: { state: "thinking" } }));

          setTimeout(() => {
            try {
              ws.send(JSON.stringify({ type: "status", payload: { state: "speaking" } }));
              ws.send(JSON.stringify({
                type: "reply_text",
                payload: { text: reply, emotion: "neutral" },
              }));
              ws.send(JSON.stringify({ type: "status", payload: { state: "idle" } }));
            } catch (e) {
              console.error("[Mock Server] Send error:", e.message);
            }
          }, 80);
        }
      } catch (err) {
        console.error("[Mock Server] Message error:", err.message);
      }
    });
  });

  console.log("[Mock Server] Starting HTTP server...");

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`MOCK_SERVER_READY:${PORT}`);
  });

  // 防止进程退出
  process.on("SIGTERM", () => {
    console.log("[Mock Server] SIGTERM received");
    server.close();
    process.exit(0);
  });

  // 保持运行
  setInterval(() => {}, 60000);

  console.log("[Mock Server] Setup complete, waiting for connections...");

} catch (err) {
  console.error("[Mock Server] Fatal error:", err.message, err.stack);
  process.exit(1);
}
