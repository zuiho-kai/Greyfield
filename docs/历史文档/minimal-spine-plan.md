# 个人 AI 助手 — Minimal Spine 路线

> 原则：让系统先活起来，然后逐渐演化。
> 判断标准：不实现这个模块，系统还能运行吗？能 → Module，不能 → Spine。

---

## Spine（最小不可替代核心）

```
你说话
  → 麦克风
  → STT（语音转文字）
  → FastAPI 后端（调 LLM API）
  → 返回文本
  → TTS（文字转语音）
  → 扬声器 + Live2D 口型同步
```

就这一个循环。4 个组件，1 条数据流。

### 组件清单

| # | 组件 | 技术 | 做什么 |
|---|------|------|--------|
| 1 | 后端 | Python + FastAPI + WebSocket | 接收文本，调 LLM，返回结果 |
| 2 | LLM | LiteLLM（统一封装 Claude/GPT/Gemini） | 一个函数调任何模型 |
| 3 | 桌面壳 | Electron | 装 Live2D + 语音 UI |
| 4 | Live2D | pixi-live2d-display | 加载你的模型，嘴巴跟着音频动 |
| 5 | STT | Whisper API（先用 API，够快） | 语音 → 文字 |
| 6 | TTS | Edge TTS（免费，质量够用） | 文字 → 语音 |
| 7 | 通信 | Socket.IO | 桌面端 ↔ 后端双向实时通信 |

### 目录结构（Spine 阶段）

```
ai-assistant/
├── backend/
│   ├── main.py              # FastAPI + Socket.IO 服务
│   ├── llm.py               # LiteLLM 封装，一个 chat() 函数
│   └── config.py            # API keys, 模型选择
│
├── desktop/
│   ├── package.json
│   ├── main.js              # Electron 主进程
│   ├── renderer/
│   │   ├── index.html        # 页面骨架
│   │   ├── live2d.js         # Live2D 加载 + 口型同步
│   │   └── socket-client.js  # 连后端
│   └── python/
│       ├── voice.py          # STT + TTS 管线
│       └── bridge.py         # Electron ↔ Python IPC
│
├── models/                   # 你的 Live2D 模型文件
├── .env                      # API keys
└── start.bat                 # 一键启动
```

### Spine 验收标准

- [ ] 双击 start.bat，桌面出现 Live2D 角色
- [ ] 你说一句话，角色用语音回复你，嘴巴在动
- [ ] 对话有上下文（最近 N 轮保留在内存中）
- [ ] 可以切换 LLM 模型（改 .env 即可）

**预估时间：3-5 天**（不是 1-2 周，因为不做任何 Module）

---

## Module 演化路径

Spine 跑通后，根据实际使用感受决定下一个 Module 是什么。
不预设顺序，但列出候选和各自的触发条件：

### Module A：文字输入（难度：低，1天）

**触发条件**：有时候不想说话，想打字。

- Electron 窗口底部加一个输入框
- 回车发送，走同一条后端管线
- Live2D 从"听"模式切换到"读"模式

### Module B：电脑操控 - 感知层（难度：中，2-3天）

**触发条件**：你想让它"看到"你屏幕上的东西。

- mss 截屏 → 发给 Vision API (Claude/GPT-4o)
- 返回屏幕内容的结构化描述
- 只看不动，先验证"它能理解屏幕"这件事

### Module C：电脑操控 - 动手层（难度：中，2-3天）

**触发条件**：Module B 验证通过，它确实能看懂屏幕。

- pyautogui：鼠标点击、键盘输入
- pywinauto：窗口操作（打开/切换/关闭程序）
- subprocess：执行命令行/脚本
- 安全确认弹窗（操作前问你一句"确定吗？"）

### Module D：网页端 - 最小版（难度：中，3-5天）

**触发条件**：你发现需要一个地方看历史记录 / 改配置。

- React 单页应用
- 页面 1：设置页（API Key、模型选择、TTS音色）
- 页面 2：对话历史列表
- 不做看板，不做频道，就这两页

### Module E：任务持久化（难度：低，1-2天）

**触发条件**：你开始让它做需要时间的事（不是一问一答）。

- SQLite 存任务：标题、描述、状态、创建时间
- 后端加 /tasks CRUD API
- 网页端加一个简单的任务列表（不是看板）

### Module F：记忆 - 最小版（难度：中，2-3天）

**触发条件**：你发现它总是忘记你之前说过的偏好。

- 一个 memories.json 文件（或 SQLite 表）
- 手动/自动把重要信息存进去
- 每次调 LLM 时把相关记忆注入 system prompt
- 不做向量检索，先用关键词匹配/全量注入（条目少的时候够用）

### Module G：多 Agent（难度：高，1-2周）

**触发条件**：单 Agent 能力到瓶颈了，你实际需要多角度方案。

- Agent 基类 + 2-3 个具体 Agent
- Orchestrator 判断什么时候用多 Agent
- Cross-Debate：同一任务扔给多个 Agent，对比结果
- Cross-Review：一个 Agent 做完，另一个审查
- 这时候才需要任务频道（记录多 Agent 的交互过程）

### Module H：任务看板 + 频道（难度：中高，1周）

**触发条件**：Module G 上线后，多 Agent 同时跑多个任务，需要可视化管理。

- 网页端看板（Kanban 拖拽）
- 每个任务一个频道（消息流展示思考过程、工具调用、产出物）
- 人类在频道中插话干预
- 决策审批点（Agent 暂停等你拍板）

### Module I：悬浮球模式（难度：低，1-2天）

**触发条件**：你不想全屏看 Live2D，想让它缩在角落。

- Electron 窗口切换：全窗口 ↔ 小窗口（桌面角落）
- 系统托盘图标
- 小窗口只显示 Live2D 头部 + 简短状态文字

### Module J：表情系统（难度：低，1-2天）

**触发条件**：你觉得它表情太木了。

- LLM 回复时判断情绪（在 prompt 里加一个 emotion 字段）
- 映射到 Live2D 表情参数
- 开心/思考/困惑/专注 几个基础表情

---

## 关键原则

### 1. 每个 Module 独立可运行

加入任何一个 Module，不需要先做别的 Module。
例如：你可以在没有网页端的情况下加电脑操控。
可以在没有多 Agent 的情况下加记忆。

### 2. Module 顺序由使用感受决定

不要提前排好 A→B→C→D 的顺序。
Spine 跑起来之后，**用几天**，看看最痛的点是什么，那个就是下一个 Module。

### 3. 每个 Module 有明确的"做完了"标准

不是"差不多能用"，而是一个具体的验收条件。
例如 Module B："截一张屏，它能告诉你屏幕上有什么窗口打开着"。

### 4. Spine 的接口要稳定

Spine 的四个组件之间的通信协议（WebSocket 消息格式）要早期定好。
Module 都是在这个协议上扩展，不改 Spine。

```
// 核心消息格式（所有通信基于这个）
{
  "type": "user_input" | "assistant_reply" | "status" | "error",
  "payload": {
    "text": "...",
    "audio_url": "...",    // 可选
    "emotion": "...",      // 可选，Module J 加入后才有
    "task_id": "...",      // 可选，Module E 加入后才有
    "artifacts": [...]     // 可选，Module G 加入后才有
  },
  "timestamp": "..."
}
```

Module 加新字段，但不改已有字段。这样 Spine 永远不用重构。

---

## 和原架构文档的关系

原来那份大文档不扔掉。它是一张"远方的地图"——你知道最终可能长成那个样子。
但开发路径不按那个来。按这个 Spine + Module 的路径来。

当某个 Module 要做的时候，回去翻原文档里对应的详细设计，那时候它就有用了。
