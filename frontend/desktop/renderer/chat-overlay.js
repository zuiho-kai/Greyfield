/**
 * 聊天覆盖层 — 显示对话消息
 */
const chatBox = document.getElementById("chat-box");
const textInput = document.getElementById("text-input");
const sendBtn = document.getElementById("send-btn");

function addMessage(role, text) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text;
  chatBox.appendChild(el);
  chatBox.scrollTop = chatBox.scrollHeight;
}

sendBtn.addEventListener("click", () => {
  const text = textInput.value.trim();
  if (!text) return;
  addMessage("user", text);
  wsSend({ type: "text_input", payload: { text } });
  textInput.value = "";
});

textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

// 监听后端消息
wsOn("transcript", (p) => addMessage("user", p.text));
wsOn("reply_text", (p) => addMessage("assistant", p.text));
wsOn("status", (p) => {
  const map = { idle: "空闲", thinking: "思考中...", speaking: "说话中...", listening: "聆听中..." };
  document.getElementById("status-bar").textContent = map[p.state] || p.state;
});
wsOn("error", (p) => addMessage("assistant", "[错误] " + p.message));
