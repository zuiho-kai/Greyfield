# 灰风（GreyWind）— 个人 AI 助手系统规格书

> 本文档是给 Claude Code 的完整开发指令。
> 开发原则：Minimal Spine + Module 渐进演化。先让系统活起来，再逐步长出功能。

---

## 一、产品定义

一句话：**带人格外壳的个人 Agent OS。**

类比：群星里的灰风——本质是一群纳米机器人（蜂巢 Agent 池），对外暴露一个皮套人（Live2D 桌宠），后面有一个大脑（主控 Agent）调度一切。

```
对外暴露：
┌──────────────────────────────┐
│  皮套 Agent（Live2D 桌宠）    │  ← 你直接交互的对象
│  语音对话 · 屏幕感知 · 播报   │
└──────────────┬───────────────┘
               │
后台不可见：    │
┌──────────────▼───────────────┐
│  主控 Agent（Conductor）      │  ← 大脑，任务分解与调度
│  ┌────────────────────────┐  │
│  │  蜂巢（Specialist Pool）│  │  ← 专家 Agent 群
│  │  Operator · Researcher │  │
│  │  Planner · Reviewer    │  │
│  └────────────────────────┘  │
└──────────────────────────────┘

双前台：
  桌面端 = 即时交互 + 电脑代操作（感知与执行）
  网页端 = 任务管理 + 过程审计 + 配置中枢（编排与治理）

单后脑：
  两个前端连同一个后端事件总线和任务系统
  桌面端不持有业务逻辑
```

---

## 二、开发原则

来自实际踩坑经验，必须遵守：

### 1. Minimal Spine 原则

> 判断标准：不实现这个模块，系统还能运行吗？
> 能 → Module（后面加），不能 → Spine（现在做）。
> 目标不是一次性设计完整系统，而是让系统先活起来，然后逐渐演化。

### 2. Module 可插拔

- 每个 Module 独立可运行，不依赖其他 Module
- Module 顺序由使用感受决定，不预设
- 每个 Module 有明确的验收标准

### 3. Spine 接口稳定

- Spine 组件间的通信协议早期定好
- Module 加新字段，不改已有字段
- Spine 永远不用重构

### 4. Briefing 写目标不写文件

- 给 Agent 的指令描述目标和约束，不限定实现路径
- Agent 自己探索代码库，比你指定文件更好

### 5. Agent 共识需要人类验证

- 多 Agent 都同意不代表正确
- 关键决策必须人类拍板

### 6. 风险分级

- 即使目标是 L4 自主性（长时间自运行，只在关键节点打扰人类）
- 架构上仍必须有风险标注、执行前快照、执行后验证、审计日志
- 否则无法排错

---

## 三、技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| 后端框架 | Python + FastAPI | AI 生态最完整，async 原生 |
| 实时通信 | Socket.IO (python-socketio) | 双向，房间/频道原生支持 |
| LLM 网关 | LiteLLM | 一个接口兼容 Claude/GPT/Gemini |
| 桌面壳 | Electron | Live2D 需要 WebGL |
| Live2D | pixi-live2d-display | 成熟的 JS Live2D 渲染库 |
| STT | Whisper API（云）/ RealtimeSTT（本地） | 混合，按需切换 |
| TTS | GPT-SoVITS 或 CosyVoice（定制音色）+ Edge TTS（兜底） | 支持参考音频克隆 |
| 浏览器操控 | Playwright | Windows 生态最成熟 |
| 桌面操控 | pyautogui + pywinauto | 鼠标键盘 + Windows 窗口 |
| 屏幕理解 | mss 截图 + Vision API (Claude/GPT-4o) | 多模态模型直接理解 |
| 数据库 | SQLite（起步）| 本地零依赖，单用户够用 |
| 向量库 | ChromaDB（后期 Module）| 本地嵌入式，Python 原生 |
| 网页前端 | React + Vite + TailwindCSS + shadcn/ui | 本地开发快 |
| 部署环境 | Windows 本地，所有服务本机跑 | 网页端也是 localhost |

---

## 四、Spine 定义（第一个要做的东西）

### 目标

> 双击 start.bat，桌面出现 Live2D 角色，你说话它回话，嘴巴动。

### 数据流

```
你说话
  → 麦克风
  → STT（语音转文字）
  → WebSocket 发到后端
  → 后端组装 prompt（角色设定 + 记忆片段 + 对话历史 + 你这句话）
  → LLM API（通过 LiteLLM）
  → 返回文本
  → WebSocket 推到桌面端
  → TTS（文字转语音）
  → 扬声器播放 + Live2D 口型同步
```

### 组件清单

```
ai-assistant/
├── backend/
│   ├── main.py              # FastAPI + Socket.IO 服务入口
│   ├── llm.py               # LiteLLM 封装
│   │                        #   chat(messages, model) → str
│   │                        #   支持 claude/gpt/gemini 切换
│   ├── memory.py            # Spine 阶段：JSON 文件读写
│   │                        #   load_memory() → dict
│   │                        #   save_memory(key, value)
│   │                        #   get_system_prompt() → str（角色设定 + 记忆注入）
│   ├── conversation.py      # 对话历史管理
│   │                        #   最近 N 轮对话保持在内存
│   │                        #   组装 messages 数组给 LLM
│   └── config.py            # 配置管理
│                            #   从 .env 读 API keys
│                            #   模型选择、TTS 引擎选择等
│
├── desktop/
│   ├── package.json          # Electron 依赖
│   ├── main.js               # Electron 主进程
│   │                         #   创建窗口（透明/置顶可选）
│   │                         #   系统托盘
│   │                         #   启动 Python 后端子进程
│   ├── preload.js            # Electron preload
│   ├── renderer/
│   │   ├── index.html        # 页面骨架
│   │   ├── app.js            # 主逻辑：连 WebSocket、管理状态
│   │   ├── live2d.js         # Live2D 加载 + 口型同步
│   │   │                     #   loadModel(modelPath)
│   │   │                     #   startLipSync(audioElement)
│   │   │                     #   stopLipSync()
│   │   ├── voice-input.js    # 麦克风采集 + 发送到后端做 STT
│   │   │                     #   或直接浏览器端 Web Speech API 做初版
│   │   ├── voice-output.js   # 接收后端 TTS 音频 + 播放
│   │   ├── chat-ui.js        # 文字输入框 + 对话气泡（可选显示/隐藏）
│   │   └── socket-client.js  # Socket.IO 客户端封装
│   └── styles/
│       └── main.css
│
├── models/                   # Live2D 模型文件（你已有的）
├── data/
│   └── memory.json           # Spine 阶段的记忆文件
├── .env                      # API keys（不进版本控制）
├── .env.example              # API keys 模板
├── requirements.txt          # Python 依赖
├── start.bat                 # Windows 一键启动
│                             #   1. 启动 Python 后端
│                             #   2. 启动 Electron 桌面端
└── README.md
```

### 核心消息协议

所有 WebSocket 通信基于这个格式，Module 只加字段不改字段：

```json
{
  "type": "user_text | assistant_text | assistant_audio | status | error",
  "payload": {
    "text": "...",
    "audio_base64": "...",
    "emotion": "neutral"
  },
  "timestamp": "2026-03-11T12:00:00Z",
  "metadata": {}
}
```

### memory.json 初始结构

```json
{
  "persona": {
    "name": "灰风",
    "personality": "简洁、高效、偶尔幽默",
    "speaking_style": "说话不废话，直接给结论"
  },
  "user_preferences": {},
  "user_facts": {},
  "current_context": ""
}
```

每次调 LLM 时，memory.py 把这个文件内容格式化后注入 system prompt。

### Spine 验收标准

- [ ] `start.bat` 一键启动后端 + 桌面端
- [ ] Electron 窗口显示 Live2D 模型，有待机动画（呼吸/眨眼）
- [ ] 点击麦克风按钮或按快捷键开始录音
- [ ] 说完话后，后端调 LLM 返回文本
- [ ] 文本经 TTS 转语音播放，Live2D 口型同步
- [ ] 支持文字输入框作为备选输入方式
- [ ] 对话有上下文（最近 10 轮保留在内存中）
- [ ] memory.json 中的角色设定生效（它知道自己叫灰风）
- [ ] 切换 LLM 模型只需改 .env

### 预估时间：3-5 天

---

## 五、Module 清单（Spine 之后按需做）

每个 Module 独立，不依赖其他 Module。顺序由使用感受决定。

---

### Module A：参考音频定制 TTS（2-3天）

**触发条件**：Edge TTS 的声音不是你想要的，想用自己的音色。

**做什么**：
- 集成 GPT-SoVITS 或 CosyVoice（本地推理）
- 提供一个脚本：输入参考音频（5-30秒）→ 生成音色配置文件
- backend 的 TTS 模块加一个引擎切换：edge_tts / custom_voice
- Live2D 口型同步不变（音频驱动，不关心音频来源）

**验收**：用你指定的参考音频，灰风说话听起来像那个声音。

---

### Module B：屏幕感知（2-3天）

**触发条件**：你想让灰风"看到"你在干什么。

**做什么**：
- mss 库截取当前屏幕 / 活跃窗口
- 截图发给 Vision API（Claude / GPT-4o）
- 返回结构化描述：什么应用、什么内容、用户在做什么
- 触发方式：
  - 手动：你说"看看我屏幕"
  - 定时：每 N 秒自动截图理解（可配置开关）
  - 事件：窗口切换时触发

**对 Spine 的改动**：
- 消息协议 metadata 加 `screen_context` 字段
- prompt 组装时把屏幕描述加入上下文

**验收**：你打开一个网页，问灰风"我在看什么"，它能准确描述页面内容。

---

### Module C：浏览器操控（3-5天）

**触发条件**：你想让灰风帮你在浏览器里执行操作。

**做什么**：
- Playwright 启动一个可控浏览器实例
- 工具函数：navigate(url)、click(selector)、type(selector, text)、screenshot()、extract_text()
- LLM 通过 function calling / tool use 调用这些工具
- 执行前弹确认（默认开启，可配置关闭）
- 执行后截图验证

**风险分级**：
```
R0 纯观察：打开网页、截图、读取文本 → 自动执行
R1 低风险：滚动、切换 tab、搜索 → 自动执行
R2 中风险：填表、点击按钮、下载 → 执行前显示操作预览
R3 高风险：提交数据、付款、发消息 → 必须人类确认
```

**验收**：你说"帮我打开 GitHub 搜索 Neuro 项目"，灰风打开浏览器完成操作。

---

### Module D：桌面操控（2-3天）

**触发条件**：浏览器之外，你还想让灰风操作其他桌面程序。

**做什么**：
- pyautogui：鼠标移动、点击、键盘输入
- pywinauto：窗口管理（打开/关闭/切换/最小化）
- subprocess / os.startfile：启动程序
- PowerShell：系统级操作

**安全机制**：同 Module C 的风险分级 + 执行前快照 + 审计日志。

**验收**：你说"帮我把桌面截图整理到一个文件夹"，灰风创建文件夹并移动文件。

---

### Module E：记忆升级 - SQLite（1-2天）

**触发条件**：memory.json 条目太多，塞不进 context window。

**做什么**：
- SQLite 替换 JSON 文件
- 表结构：
  ```sql
  memories(id, type, key, value, importance, created_at, last_accessed)
  -- type: persona / preference / fact / task / sop
  ```
- 每次调 LLM 时按 type + 时间 + importance 筛选 Top-K 条注入
- 提供 CRUD API（给后续网页端用）
- 自动提取：LLM 对话后让它判断"这轮对话有没有值得记住的"

**验收**：灰风记住你上周说过的偏好，重启后仍然记得。

---

### Module F：网页端最小版（3-5天）

**触发条件**：你需要一个地方看历史、改配置、管任务。

**做什么**：
- React + Vite + Tailwind + shadcn/ui
- 3 个页面：
  1. **Dashboard**：当前状态、最近对话、活跃任务
  2. **Settings**：API Key、模型选择、TTS 引擎、风险等级配置、记忆浏览/编辑
  3. **Conversations**：对话历史列表

**不做**：任务看板、任务频道（等 Module H）。

**验收**：打开 localhost:3000 能看到灰风的对话历史，能改 API Key。

---

### Module G：任务持久化 + 主控 Agent 分离（3-5天）

**触发条件**：你开始让灰风做需要时间的事（不是一问一答），需要"灰风大脑"从皮套中分离。

**做什么**：
- 任务模型：
  ```sql
  tasks(id, title, description, type, status, priority, 
        parent_task_id, created_at, updated_at)
  task_messages(id, task_id, role, type, content, timestamp)
  -- role: conductor / operator / researcher / user / system
  -- type: thought / tool_call / artifact / error / decision / review
  ```
- 任务状态机（起步只用6个，够用再加）：
  ```
  inbox → planned → running → completed
                  ↘ waiting_input    ↗
                  ↘ failed
  ```
- 主控 Agent（Conductor）从皮套 Agent 分离：
  - 皮套 Agent：接收你的输入，理解意图，转交给主控
  - 主控 Agent：分析任务，决定自己做还是派给专家
  - Spine 阶段两者合一；本 Module 把它们拆开

**验收**：你说"帮我调研 X 技术的现状"，灰风创建一个任务，你能在后台看到任务状态。

---

### Module H：任务频道 — cat-cafe 风格（5-7天）

**触发条件**：Module G 跑通，你需要可视化地跟踪每个任务的过程。

**做什么**：
- 每个任务 = 一个频道（像工作群）
- 频道内 3 条并行信息流：
  1. **决策流**：为什么这样拆、为什么这样做
  2. **执行流**：调用了什么工具、操作了什么
  3. **产物流**：生成了什么文件、代码、报告
- 频道内分 Tab：Timeline / Artifacts / Subtasks / Memory
- 人类可以在频道中插话干预
- 决策审批点（Agent 暂停等你拍板）
- 参考 cat-cafe-tutorials 的分层沉淀：decisions / lessons / research

**网页端新增页面**：
- **Board**（看板）：Inbox / Planned / Running / Waiting / Done / Failed
- **Channel**（频道详情）：上述 3 流 + Tabs

**验收**：同时有 2 个任务在跑，每个任务有独立频道，你能在网页上实时看到进度。

---

### Module I：蜂巢 — 多 Agent 协作（1-2周）

**触发条件**：单 Agent（主控自己干）能力到瓶颈。

**做什么**：
- Agent 基类定义：
  ```python
  class Agent:
      id: str
      name: str
      role: str           # conductor / operator / researcher / planner / reviewer
      capabilities: list
      system_prompt: str
      preferred_model: str
      tools: list
  ```
- 4 类专家 Agent：
  - **Operator**：浏览器/桌面/终端操作者
  - **Researcher**：检索、摘要、对比、抽取
  - **Planner**：拆解步骤、生成 SOP、维护依赖
  - **Reviewer**：验收、挑错、判断是否需要重跑
- 协作模式：
  - **单 Agent 直接执行**（简单任务）
  - **Cross-Debate**：同一任务给多个 Agent 独立出方案，主控汇总
  - **Cross-Review**：一个 Agent 执行，另一个审查
- 主控 Agent 决定用哪种模式
- Guardian 逻辑（不单独做 Agent，融入主控）：风险标注 + 执行前快照 + 执行后验证

**验收**：你下一个复杂任务，主控自动拆成子任务，分给不同 Agent，频道里能看到协作过程。

---

### Module J：记忆升级 - 向量检索（2-3天）

**触发条件**：记忆条目太多（几百条），关键词匹配不够用。

**做什么**：
- ChromaDB 本地向量库
- 记忆写入时同时存 SQLite（结构化）+ ChromaDB（向量化）
- 检索策略：当前对话语义 → 向量相似度 Top-K → 注入 prompt
- 记忆分层：
  ```
  ephemeral  — 当前对话/屏幕上下文（内存，分钟级）
  session    — 本次工作会话（内存/临时文件，小时级）
  task       — 任务级记忆（SQLite/ChromaDB，任务生命周期）
  persona    — 个人偏好/事实（SQLite/ChromaDB，永久）
  procedural — 可执行 SOP / 固定流程（文件/SQLite，永久）
  ```

**验收**：灰风能从几百条记忆中找到和当前任务最相关的几条，而不是全量塞进去。

---

### Module K：Live2D 表情与状态联动（1-2天）

**触发条件**：灰风表情太木。

**做什么**：
- LLM 回复时带 emotion 字段（prompt 里加）
- 映射表：
  ```
  neutral  → 默认表情
  thinking → 思考（看向上方/闭眼）
  happy    → 开心（眉毛上扬/微笑）
  confused → 困惑（歪头）
  focused  → 专注（严肃表情）
  error    → 遇到问题（皱眉）
  ```
- 任务状态联动：running → focused, waiting_input → confused, completed → happy
- 消息协议 emotion 字段生效

**验收**：灰风在思考时表情变化，任务完成时开心。

---

### Module L：悬浮球模式（1-2天）

**触发条件**：不想全屏 Live2D，想缩在角落。

**做什么**：
- Electron 窗口模式切换：全窗口 ↔ 小悬浮球（桌面角落）
- 悬浮球：Live2D 头部 + 当前状态色环（绿=空闲，蓝=工作中，黄=等你，红=出错）
- 点击悬浮球展开全窗口
- 系统托盘图标 + 右键菜单

**验收**：缩成悬浮球后仍能看到灰风状态，点击恢复全窗口。

---

### Module M：定时任务与后台通知（2-3天）

**触发条件**：你想让灰风主动汇报后台任务进度。

**做什么**：
- 定时触发器：cron 表达式 或 interval
- 任务完成/失败/需要确认时，皮套 Agent 主动语音播报
- 桌面通知（Windows toast notification）
- 可配置"免打扰"时段

**验收**：后台任务完成后，灰风主动语音告诉你"XX任务搞定了"。

---

## 六、记忆演化路径（单独说清楚）

皮套 Agent 在**任何阶段**都有记忆，只是实现在演化：

| 阶段 | 灰风的感受 | 实际实现 | 改动范围 |
|------|-----------|---------|---------|
| Spine | 记得这次聊了什么 | LLM context window（最近10轮） | 无，自带 |
| Spine | 知道自己叫灰风 | memory.json → system prompt | memory.py |
| Module E | 记得上周的偏好 | SQLite 表 + 按需查询注入 | memory.py 重写 |
| Module J | 从几百条记忆中找最相关的 | ChromaDB 向量检索 | memory.py 加检索层 |

**关键**：皮套的对话代码不用改。它永远是"把记忆塞进 prompt 调 LLM"。变的只是 memory.py 里"记忆从哪来、怎么选"。

---

## 七、桌面端架构原则

桌面端只做**感知与执行**，不持有业务逻辑。

```
桌面端的职责（只做这些）：
├── 接指令（语音/文字 → 发给后端）
├── 发上下文（截屏/窗口信息 → 发给后端）
├── 执行动作（后端说点哪里 → pyautogui 去点）
├── 回传结果（操作后截图 → 发给后端验证）
└── 展示反馈（Live2D 表情 + 语音播报 + 状态指示）

桌面端不做的事：
├── 不自己决定"要不要执行"（后端决定）
├── 不自己管理任务状态（后端管）
├── 不自己做记忆检索（后端做）
└── 不自己调 LLM（后端调）
```

---

## 八、网页端页面规划

随 Module 渐进出现，不一次做完：

| Module | 新增页面 |
|--------|---------|
| F | Dashboard, Settings, Conversations |
| H | Board（看板）, Channel（任务频道） |
| J | Knowledge（记忆浏览/管理） |

最终 5 页：Dashboard / Board / Channels / Settings / Knowledge

---

## 九、MVP 验收标准

你的原话：**"能听我说话、看当前屏幕、帮我操作浏览器完成固定流程"**

这对应 Spine + Module B + Module C。

**MVP = Spine + Module B + Module C**

验收场景：
1. 双击 start.bat 启动
2. 桌面出现灰风 Live2D 角色
3. 你说"帮我打开 Chrome，搜索 XXX，打开第一个结果"
4. 灰风截屏理解当前桌面状态
5. 灰风打开浏览器执行操作
6. 操作过程中有语音播报进度
7. 完成后灰风说"搞定了"并截图展示结果
8. 全程对话有上下文，灰风知道自己叫灰风

**预估时间：Spine 3-5天 + Module B 2-3天 + Module C 3-5天 = 总计 8-13天**

---

## 十、给 Claude Code 的执行指令

### 第一步：搭 Spine

```
请按照本文档第四节"Spine 定义"，创建项目骨架并实现最小闭环：
1. 创建目录结构
2. 实现 backend（FastAPI + Socket.IO + LiteLLM + memory.json）
3. 实现 desktop（Electron + Live2D 加载 + 语音输入输出 + Socket.IO 客户端）
4. 实现 start.bat 一键启动
5. 验收：说话 → 回话 → 嘴巴动
```

### 第二步：加 Module B（屏幕感知）

```
Spine 验收通过后，按照 Module B 描述，加入屏幕截图 + Vision API 理解能力。
不改 Spine 现有代码的接口，只在 metadata 中加 screen_context 字段。
验收：问灰风"我在看什么"，它能描述当前屏幕内容。
```

### 第三步：加 Module C（浏览器操控）

```
Module B 验收通过后，按照 Module C 描述，集成 Playwright 浏览器操控。
通过 LLM function calling 让灰风调用浏览器工具。
实现风险分级和确认机制。
验收：让灰风帮你在浏览器中完成一个完整的搜索流程。
```

### 之后

回到本文档第五节，根据实际使用感受选下一个 Module。
