const historyEl = document.getElementById("history");

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function renderItem(entry) {
  const item = document.createElement("div");
  item.className = "item";
  item.dataset.role = entry.role || "assistant";

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${formatTime(entry.ts)} • ${entry.role || "assistant"}`;

  const text = document.createElement("div");
  text.className = `text role-${entry.role || "assistant"}`;
  text.textContent = entry.text || "";

  item.appendChild(meta);
  item.appendChild(text);
  return item;
}

function scrollToBottom() {
  historyEl.scrollTop = historyEl.scrollHeight;
}

function appendTextToLast(text) {
  const last = historyEl.lastElementChild;
  if (!last) return false;
  const textEl = last.querySelector(".text");
  if (!textEl) return false;
  const prefix = textEl.textContent ? "\n" : "";
  textEl.textContent = textEl.textContent + prefix + text;
  return true;
}

window.historyAPI?.onInit((items) => {
  historyEl.innerHTML = "";
  (items || []).forEach((entry) => historyEl.appendChild(renderItem(entry)));
  scrollToBottom();
});

window.historyAPI?.onAdd((entry) => {
  historyEl.appendChild(renderItem(entry));
  scrollToBottom();
});

window.historyAPI?.onAppend((entry) => {
  if (!appendTextToLast(entry.text || "")) {
    historyEl.appendChild(renderItem(entry));
  } else if (entry?.ts) {
    const last = historyEl.lastElementChild;
    const meta = last?.querySelector(".meta");
    if (meta) {
      const role = last.dataset.role || entry.role || "assistant";
      meta.textContent = `${formatTime(entry.ts)} • ${role}`;
    }
  }
  scrollToBottom();
});
