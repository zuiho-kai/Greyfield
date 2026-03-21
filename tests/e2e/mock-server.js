/**
 * 灰风 E2E 测试用 Mock 后端
 *
 * 实现最小化的 HTTP + WebSocket 服务器，模拟 Python 后端协议：
 * - GET /health → 返回 ok
 * - WebSocket /ws → 接收 text_input，返回 thinking/speaking/reply_text/idle
 *
 * 用法：node mock-server.js [port]
 */

// 立即设置全局错误处理
try {
  const http = require("http");
  const WebSocket = require("ws");

  const PORT = parseInt(process.argv[2] || "12393", 10);

  // 全局错误处理，防止进程退出
  process.on("uncaughtException", (err) => {
    console.error("[Mock Server] Uncaught exception:", err.message, err.stack);
    // 不退出进程
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("[Mock Server] Unhandled rejection:", reason);
    // 不退出进程
  });

  // 防止进程自然退出
  process.on("beforeExit", (code) => {
    console.log("[Mock Server] beforeExit with code:", code);
  });

  process.on("exit", (code) => {
    console.log("[Mock Server] exit with code:", code);
  });

  const server = http.createServer((req, res) => {
    try {
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
    } catch (err) {
      console.error("[Mock Server] HTTP request error:", err.message);
      res.writeHead(500);
      res.end("Internal error");
    }
  });

  // HTTP 服务器错误处理
  server.on("error", (err) => {
    console.error("[Mock Server] HTTP server error:", err.message);
  });

  const wss = new WebSocket.Server({ server, path: "/ws" });

  // WebSocket 服务器错误处理
  wss.on("error", (err) => {
    console.error("[Mock Server] WebSocket server error:", err.message);
  });

  wss.on("connection", (ws, req) => {
    console.log("[Mock Server] WebSocket connection from:", req.socket.remoteAddress);

    // 设置 WebSocket 错误处理
    ws.on("error", (err) => {
      console.error("[Mock Server] WebSocket error:", err.message);
    });

    ws.on("close", (code, reason) => {
      console.log("[Mock Server] WebSocket closed:", code, reason?.toString());
    });

    ws.on("message", (data) => {
      try {
        let msg;
        try {
          msg = JSON.parse(data.toString());
        } catch {
          console.log("[Mock Server] Invalid JSON received");
          return;
        }

        const { type, payload = {} } = msg;
        console.log("[Mock Server] Received message:", type);

        if (type === "text_input") {
          const userText = payload.text || "";
          const reply = `你好，我是灰风。你说了：「${userText}」`;

          // 模拟 thinking → speaking → reply_text → idle 序列
          if (ws.readyState === ws.OPEN) {
            try {
              ws.send(JSON.stringify({ type: "status", payload: { state: "thinking" } }));
            } catch (e) {
              console.error("[Mock Server] Failed to send thinking:", e.message);
            }
          }

          setTimeout(() => {
            if (ws.readyState === ws.OPEN) {
              try {
                ws.send(JSON.stringify({ type: "status", payload: { state: "speaking" } }));
                ws.send(
                  JSON.stringify({
                    type: "reply_text",
                    payload: { text: reply, emotion: "neutral" },
                  })
                );
                ws.send(JSON.stringify({ type: "status", payload: { state: "idle" } }));
              } catch (e) {
                console.error("[Mock Server] Failed to send reply:", e.message);
              }
            }
          }, 80);
        } else if (type === "interrupt") {
          if (ws.readyState === ws.OPEN) {
            try {
              ws.send(JSON.stringify({ type: "status", payload: { state: "idle" } }));
            } catch (e) {
              console.error("[Mock Server] Failed to send idle:", e.message);
            }
          }
        } else if (type === "clear_history") {
          if (ws.readyState === ws.OPEN) {
            try {
              ws.send(JSON.stringify({ type: "status", payload: { state: "idle" } }));
            } catch (e) {
              console.error("[Mock Server] Failed to send idle:", e.message);
            }
          }
        }
        // 其他消息类型静默忽略
      } catch (err) {
        console.error("[Mock Server] Message handling error:", err.message);
      }
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    // 向父进程报告就绪（供 playwright globalSetup 检测）
    process.stdout.write(`MOCK_SERVER_READY:${PORT}\n`);
  });

  // 正确处理 SIGTERM
  process.on("SIGTERM", () => {
    console.log("[Mock Server] Received SIGTERM, shutting down...");
    try {
      server.close();
    } catch (e) {
      console.error("[Mock Server] Error closing server:", e.message);
    }
    process.exit(0);
  });

  // 正确处理 SIGINT
  process.on("SIGINT", () => {
    console.log("[Mock Server] Received SIGINT, shutting down...");
    try {
      server.close();
    } catch (e) {
      console.error("[Mock Server] Error closing server:", e.message);
    }
    process.exit(0);
  });

  // 保持进程运行 - 使用更可靠的方式
  const keepAlive = setInterval(() => {
    console.log("[Mock Server] Keepalive ping");
  }, 30000);

  // 确保定时器不会阻止进程退出（当需要时）
  keepAlive.unref?.() || clearInterval(keepAlive);

  // 重新设置一个不会阻止退出的定时器
  setInterval(() => {
    // 心跳，防止进程自然退出
  }, 60000);

  console.log("[Mock Server] Starting up...");

} catch (err) {
  console.error("[Mock Server] Fatal error during startup:", err.message, err.stack);
  process.exit(1);
}
