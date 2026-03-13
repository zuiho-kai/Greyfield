/**
 * 聊天覆盖层 — 显示对话消息
 */
const chatBox = document.getElementById("chat-box");
const textInput = document.getElementById("text-input");
const sendBtn = document.getElementById("send-btn");

const MAX_MESSAGES = 3;
const MESSAGE_TTL_MS = 9000;
const FADE_OUT_MS = 300;
const MERGE_WINDOW_MS = 1500;

let lastMessageEl = null;
let lastMessageRole = null;
let lastMessageAt = 0;
let scrollPending = false;

function scheduleScrollToBottom() {
  if (scrollPending) return;
  scrollPending = true;
  requestAnimationFrame(() => {
    scrollPending = false;
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

function scheduleAutoRemove(el) {
  if (el._fadeTimer) clearTimeout(el._fadeTimer);
  if (el._removeTimer) clearTimeout(el._removeTimer);
  el._fadeTimer = setTimeout(() => {
    if (!el.isConnected) return;
    el.classList.add("fade-out");
    el._removeTimer = setTimeout(() => {
      if (el.isConnected) el.remove();
    }, FADE_OUT_MS);
  }, MESSAGE_TTL_MS);
}

function appendMessageText(el, text) {
  const prefix = el.textContent ? "\n" : "";
  el.textContent = el.textContent + prefix + text;
}

function addMessage(role, text) {
  const now = Date.now();
  const canMerge =
    role === "assistant" &&
    lastMessageRole === "assistant" &&
    lastMessageEl &&
    lastMessageEl.isConnected &&
    now - lastMessageAt <= MERGE_WINDOW_MS;

  if (canMerge) {
    appendMessageText(lastMessageEl, text);
    lastMessageAt = now;
    scheduleAutoRemove(lastMessageEl);
    scheduleScrollToBottom();
    window.greywind?.appendHistory?.({ role, text, ts: now });
    return;
  }

  const el = document.createElement("div");
  el.className = `msg ${role} entering`;
  el.dataset.role = role;
  el.textContent = text;
  chatBox.appendChild(el);

  requestAnimationFrame(() => {
    if (el.isConnected) el.classList.remove("entering");
  });

  while (chatBox.children.length > MAX_MESSAGES) {
    const first = chatBox.firstElementChild;
    if (first) first.remove();
  }

  scheduleAutoRemove(el);

  lastMessageEl = el;
  lastMessageRole = role;
  lastMessageAt = now;
  scheduleScrollToBottom();
  window.greywind?.addHistory?.({ role, text, ts: now });
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
