# 个人 AI 助手系统 — 架构设计文档

## 1. 系统全景

```
┌─────────────────────────────────────────────────────────────────────┐
│                         你（人类决策者）                              │
│                  产品判断 · 任务下达 · 关键审批                        │
└────────┬──────────────────────────────────┬──────────────────────────┘
         │ 语音/文字                         │ 浏览器
         ▼                                  ▼
┌─────────────────────┐          ┌──────────────────────────┐
│    桌面端 Desktop    │          │     网页端 Web Dashboard   │
│                     │          │                          │
│  Live2D + 语音交互   │          │  设置面板                  │
│  截屏理解            │◄────────►│  任务看板 (Kanban)         │
│  操控电脑            │ WebSocket│  任务进度频道 (Channels)    │
│  脚本执行            │          │  Agent 状态监控            │
└────────┬────────────┘          └─────────┬────────────────┘
         │                                 │
         │          WebSocket / REST        │
         └────────────┬────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        核心后端 (Core Backend)                       │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌───────────┐ │
│  │ Orchestrator │  │ Agent 注册表  │  │ 任务引擎    │  │ 记忆系统   │ │
│  │ (编排层)     │  │ (身份/权限)   │  │ (生命周期)  │  │ (分层存储) │ │
│  └──────┬──────┘  └──────────────┘  └────────────┘  └───────────┘ │
│         │                                                          │
│  ┌──────▼──────────────────────────────────────────────────────┐   │
│  │                    消息总线 (Event Bus)                       │   │
│  │              事件驱动 · 实时推送 · 任务频道                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         │                                                          │
│  ┌──────▼──────────────────────────────────────────────────────┐   │
│  │                   执行 Agent 池                               │   │
│  │                                                              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │ Coding   │ │ Research │ │ Daily    │ │ Computer │       │   │
│  │  │ Agent    │ │ Agent    │ │ Task     │ │ Control  │       │   │
│  │  │          │ │          │ │ Agent    │ │ Agent    │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         │                                                          │
│  ┌──────▼──────────────────────────────────────────────────────┐   │
│  │                    LLM Gateway                               │   │
│  │         Claude API  |  GPT API  |  Gemini API                │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| **后端框架** | Python + FastAPI | AI 生态最完整，async 原生支持 |
| **桌面端** | Electron (Live2D渲染) + Python子进程 (电脑操控) | Live2D 需要 WebGL，电脑操控需要 pyautogui/pywinauto |
| **网页端** | React + Vite + TailwindCSS + shadcn/ui | 本地开发快，组件生态好 |
| **实时通信** | Socket.IO (python-socketio) | 双向通信，房间/频道原生支持 |
| **数据库** | SQLite (结构化数据) + ChromaDB (向量存储) | 本地部署零依赖，够用 |
| **任务队列** | Python asyncio + 内存队列 (后期可换 Redis) | 初期保持简单，单机够用 |
| **LLM 网关** | LiteLLM 统一代理层 | 一个接口兼容 Claude/GPT/Gemini，切换零成本 |
| **STT** | Whisper API (OpenAI) 或 RealtimeSTT (本地) | API 省事；本地更快更隐私 |
| **TTS** | Edge TTS (免费) / ElevenLabs API (高质量) | Edge TTS 零成本入门 |
| **Live2D** | pixi-live2d-display (Electron 内) | 成熟的 JS Live2D 渲染库 |
| **电脑操控** | pyautogui + pywinauto + subprocess | 鼠标键盘 + Windows 窗口操作 + 命令行 |
| **屏幕理解** | 截图 + Vision API (Claude/GPT-4o) | 多模态模型直接理解屏幕内容 |

---

## 3. 核心后端详细设计

### 3.1 Orchestrator（编排层）

编排层是整个系统的大脑，参考 ClawdBot 的三层架构：`你 → Orchestrator → 执行 Agents`。

```
职责：
├── 任务接收：从桌面端/网页端接收用户指令
├── 任务分析：理解意图，判断复杂度
├── 任务拆解：将复杂任务分解为子任务树
├── Agent 调度：选择合适的执行 Agent
├── 模式选择：
│   ├── 单 Agent 直接执行（简单任务）
│   ├── Cross-Debate（多 Agent 独立出方案，再汇总）
│   └── Cross-Review（一个 Agent 执行，其他交叉审核）
├── 进度监控：跟踪每个子任务的状态
├── 结果汇总：合并子任务产出，向用户汇报
└── 经验学习：记录成功/失败模式到长期记忆
```

**编排层自身使用强模型（Claude Opus / GPT-4o）**，因为任务分析和调度需要最强的推理能力。

### 3.2 Agent 注册表（身份与权限）

参考飞书"工牌"理念，每个 Agent 有明确身份：

```python
# Agent 身份定义
class AgentProfile:
    id: str                    # 唯一标识，如 "coding-agent-01"
    name: str                  # 显示名，如 "代码工匠"
    role: str                  # 角色描述
    capabilities: list[str]    # 能力标签 ["python", "web", "debug"]
    permissions: dict          # 权限配置
    preferred_llm: str         # 偏好模型，如 "claude-sonnet-4-20250514"
    system_prompt: str         # 角色系统提示词
    personality: str           # 风格/性格（影响输出风格）
    max_concurrent_tasks: int  # 最大并发
    tools: list[str]           # 可用工具列表
```

**权限体系：**
```
权限级别：
├── L1 只读：只能查看文件、搜索信息
├── L2 生成：可以生成内容、写文件到沙盒
├── L3 执行：可以运行代码、调用外部 API
├── L4 操控：可以操作电脑（鼠标键盘）
└── L5 管理：可以创建/修改其他 Agent 配置
```

### 3.3 任务引擎

```
任务生命周期：
created → planning → executing → reviewing → done/failed

任务数据模型：
Task:
├── id: 唯一标识
├── title: 任务标题
├── description: 详细描述
├── type: coding | research | daily | creative | mixed
├── status: created | planning | executing | reviewing | done | failed | paused
├── priority: urgent | high | normal | low
├── parent_task_id: 父任务（支持子任务树）
├── assigned_agents: 分配的 Agent 列表
├── mode: single | cross-debate | cross-review
├── artifacts: 产出物列表（文件、代码、报告等）
├── channel_id: 对应的进度频道 ID
├── created_at / updated_at
└── metadata: 额外元数据（如 briefing 内容、审核轮次等）
```

**子任务树示例：**
```
[Task] 开发一个个人博客
├── [SubTask] 技术选型 Cross-Debate
│   ├── Agent-A 方案
│   ├── Agent-B 方案
│   └── 汇总决策
├── [SubTask] 后端开发
│   ├── [SubTask] 数据库设计
│   ├── [SubTask] API 开发
│   └── [SubTask] Cross-Review 审核
├── [SubTask] 前端开发
└── [SubTask] 部署
```

### 3.4 记忆系统

参考文章中"分层记忆"设计：

```
记忆分层：
├── 即时上下文 (Working Memory)
│   └── 当前对话/任务的上下文窗口（LLM context）
│
├── 短期记忆 (Short-term Memory)
│   ├── 存储：内存 / SQLite
│   ├── 生命周期：会话级，任务完成后归档
│   └── 内容：当前任务的中间状态、Agent 间通信记录
│
├── 项目记忆 (Project Memory)
│   ├── 存储：SQLite + 文件系统
│   ├── 生命周期：项目级，跨会话持久化
│   └── 内容：项目结构、技术栈、决策历史、已知问题
│
└── 长期记忆 (Long-term Memory)
    ├── 存储：ChromaDB (向量) + SQLite (结构化)
    ├── 生命周期：永久，带衰减权重
    └── 内容：
        ├── 用户偏好（你喜欢的编码风格、常用工具等）
        ├── 历史经验（成功/失败模式）
        ├── 知识库（积累的领域知识）
        └── Agent 表现记录（哪个 Agent 擅长什么）
```

**记忆检索策略：**
- 根据当前任务语义，从向量库中检索最相关的 Top-K 条记忆
- 记忆有优先级评分：用户明确声明 > 推断偏好 > 历史经验
- 遗忘机制：旧记忆检索权重随时间衰减

### 3.5 消息总线与任务频道

参考 agenthub 的消息板设计：

```
消息总线设计：
├── 全局事件流
│   ├── task.created / task.updated / task.completed
│   ├── agent.status_changed
│   └── system.alert
│
├── 任务频道 (Per-Task Channels)
│   ├── 每个任务自动创建一个频道
│   ├── 频道内支持线程（Thread）
│   ├── 消息类型：
│   │   ├── thought     — Agent 思考过程
│   │   ├── tool_call   — 工具调用记录
│   │   ├── artifact    — 产出物（代码片段、文件等）
│   │   ├── error       — 错误/失败记录
│   │   ├── decision    — 决策点（需要人类审批的）
│   │   ├── debate      — Cross-Debate 中各 Agent 的方案
│   │   └── review      — Cross-Review 的审核意见
│   └── 支持人类在频道中插话干预
│
└── WebSocket 实时推送到桌面端和网页端
```

---

## 4. 桌面端详细设计

### 4.1 整体架构

```
┌─────────────────────────────────────────────┐
│              Electron 主窗口                  │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │     Live2D 渲染层 (pixi.js)         │    │
│  │     - 模型加载与动画                  │    │
│  │     - 口型同步 (TTS音频驱动)          │    │
│  │     - 表情切换 (情绪映射)             │    │
│  │     - 交互动作 (点击响应等)           │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ 语音输入  │ │ 文字输入  │ │ 状态显示    │  │
│  │ (STT)    │ │ (文本框)  │ │ (当前任务)  │  │
│  └──────────┘ └──────────┘ └────────────┘  │
└────────────┬────────────────────────────────┘
             │ IPC (进程间通信)
             ▼
┌─────────────────────────────────────────────┐
│           Python 后台服务进程                  │
│                                             │
│  ┌────────────┐  ┌────────────────────┐     │
│  │ 语音管线    │  │ 电脑操控模块         │     │
│  │ STT ←→ TTS │  │ - 截屏 + Vision API │     │
│  └────────────┘  │ - pyautogui 鼠标键盘│     │
│                  │ - pywinauto 窗口操作 │     │
│                  │ - subprocess 脚本    │     │
│                  │ - PowerShell 系统命令│     │
│                  └────────────────────┘     │
│                                             │
│  ┌──────────────────────────────────┐       │
│  │ WebSocket Client → 核心后端       │       │
│  └──────────────────────────────────┘       │
└─────────────────────────────────────────────┘
```

### 4.2 语音管线

```
用户说话
  → 麦克风捕获
  → STT (Whisper API / RealtimeSTT)
  → 文本
  → 发送到核心后端 (Orchestrator)
  → Orchestrator 处理 + 调度 Agent
  → 返回文本结果
  → TTS (Edge TTS / ElevenLabs)
  → 音频流
  → 扬声器播放 + Live2D 口型同步
```

**关键细节：**
- STT 使用流式识别，说完即出文本，不需等待
- TTS 使用流式合成，文本到音频延迟 < 1s
- Live2D 口型通过音频音量/频率驱动，参考 Neuro 的虚拟音频线缆方案
- 支持打断：用户开口说话时自动停止当前 TTS 播放

### 4.3 电脑操控模块

```
操控能力分层：
├── L1 感知层
│   ├── 截屏 (mss库，高性能截图)
│   ├── 屏幕理解 (截图 → Vision API → 结构化描述)
│   ├── 窗口列表获取 (pywinauto)
│   └── 剪贴板读取
│
├── L2 基础操作层
│   ├── 鼠标：移动、点击、双击、右键、拖拽 (pyautogui)
│   ├── 键盘：打字、快捷键、组合键 (pyautogui)
│   ├── 窗口：打开、关闭、最小化、切换 (pywinauto)
│   └── 剪贴板写入
│
├── L3 程序交互层
│   ├── 启动程序 (subprocess / os.startfile)
│   ├── 文件操作 (创建、读取、移动、删除)
│   └── 系统设置 (通过 PowerShell)
│
└── L4 脚本执行层
    ├── Python 脚本执行 (沙盒环境)
    ├── PowerShell 脚本
    ├── Batch 脚本
    └── 任意命令行命令 (需确认)
```

**安全机制（参考文章中密钥泄露教训）：**
- L4 操作需要人类确认（桌面端弹窗或语音确认）
- 操作日志全记录
- 敏感操作（删除文件、修改系统设置）双重确认
- 沙盒目录限制：Agent 默认只能操作指定工作目录

### 4.4 Live2D 集成

```
Live2D 功能：
├── 模型加载：加载你现有的 .moc3 模型文件
├── 待机动画：空闲时的呼吸、眨眼等
├── 说话动画：TTS 播放时口型同步
├── 表情系统：
│   ├── 正常 → 任务执行中
│   ├── 开心 → 任务完成
│   ├── 思考 → Agent 推理中
│   ├── 困惑 → 遇到问题需要确认
│   └── 专注 → 复杂任务处理中
├── 交互响应：鼠标点击/悬停触发动作
└── 窗口模式：
    ├── 全窗口模式（主界面）
    └── 悬浮球模式（桌面角落常驻，可拖动）
```

---

## 5. 网页端详细设计

### 5.1 页面结构

```
网页端布局：
├── 🔧 设置面板 (/settings)
│   ├── LLM 配置
│   │   ├── API Keys 管理 (Claude / GPT / Gemini)
│   │   ├── 模型选择（编排层用什么、执行层用什么）
│   │   └── 参数调节（temperature、max_tokens 等）
│   ├── Agent 管理
│   │   ├── 查看所有 Agent 列表
│   │   ├── 创建/编辑 Agent（角色、能力、权限、提示词）
│   │   └── Agent 性能统计（成功率、平均耗时）
│   ├── 记忆管理
│   │   ├── 查看/编辑长期记忆
│   │   ├── 手动添加知识条目
│   │   └── 记忆导入/导出
│   ├── 语音设置
│   │   ├── STT 引擎选择
│   │   ├── TTS 引擎 + 音色选择
│   │   └── 唤醒词配置
│   └── 安全设置
│       ├── 操作确认级别
│       ├── 沙盒目录配置
│       └── 日志保留策略
│
├── 📋 任务看板 (/kanban)
│   ├── 看板视图（拖拽式）
│   │   ├── 待规划 (Backlog)
│   │   ├── 规划中 (Planning)
│   │   ├── 执行中 (In Progress)
│   │   ├── 审核中 (Reviewing)
│   │   ├── 已完成 (Done)
│   │   └── 已失败 (Failed)
│   ├── 任务卡片信息
│   │   ├── 标题 + 类型标签
│   │   ├── 分配的 Agent 头像
│   │   ├── 进度条
│   │   ├── 子任务计数
│   │   └── 最后更新时间
│   ├── 筛选/搜索
│   │   ├── 按类型：coding / research / daily / creative
│   │   ├── 按状态
│   │   └── 按 Agent
│   └── 快速创建任务
│
├── 📡 任务频道 (/task/:id/channel)
│   ├── 频道头部
│   │   ├── 任务标题 + 状态
│   │   ├── 分配的 Agent 列表
│   │   ├── 子任务树视图
│   │   └── 产出物列表（可下载）
│   ├── 消息流（实时滚动）
│   │   ├── 💭 Agent 思考过程（可折叠）
│   │   ├── 🔧 工具调用记录
│   │   ├── 📄 代码/文件产出
│   │   ├── ⚠️ 错误信息
│   │   ├── 🗳️ 决策点（需要你审批的，带按钮）
│   │   ├── 🗣️ Cross-Debate 各方案对比
│   │   └── 🔍 Cross-Review 审核意见
│   ├── 人类干预区
│   │   ├── 文字输入（给 Agent 补充信息/修改方向）
│   │   ├── 暂停/继续/取消按钮
│   │   └── 手动触发审核
│   └── 时间线 / 日志视图切换
│
└── 📊 总览仪表盘 (/dashboard)
    ├── Agent 状态一览（在线/忙碌/空闲）
    ├── 今日任务统计
    ├── 活跃任务实时状态
    └── 系统资源使用情况
```

---

## 6. 关键流程

### 6.1 典型任务流程（以"帮我写一个 Chrome 扩展"为例）

```
1. 你通过桌面端语音："帮我写一个 Chrome 扩展，功能是..."
   
2. STT → 文本 → Orchestrator

3. Orchestrator 分析任务：
   - 类型：coding
   - 复杂度：高
   - 决策：使用 Cross-Debate 确定技术方案，再单 Agent 实现

4. Orchestrator 创建任务，网页端看板出现新卡片
   同时创建任务频道，开始记录

5. Cross-Debate 阶段：
   频道记录 → [Agent-A 方案] [Agent-B 方案] [Agent-C 方案]
   Orchestrator 汇总 → 发送对比给你
   你通过桌面端/网页端拍板

6. 实现阶段：
   选定的 Agent 开始写代码
   频道实时显示：思考过程、文件创建、代码片段

7. Cross-Review 阶段：
   其他 Agent 审查代码
   频道记录：发现的问题、修复建议
   
8. 完成：
   产出物（扩展代码包）出现在频道中
   看板卡片移到"已完成"
   桌面端 Live2D 开心表情 + 语音："Chrome 扩展写好了！"
```

### 6.2 电脑操控流程

```
1. 你："帮我把桌面上所有截图整理到一个文件夹里"

2. Orchestrator → Computer Control Agent

3. Agent 执行：
   a. 截屏 → Vision API 理解桌面内容
   b. 识别出截图文件的位置
   c. 创建 "截图整理" 文件夹 (subprocess)
   d. 移动文件 (Python file operations)
   e. 截屏验证结果 → Vision API 确认

4. 频道记录全过程截图和操作日志

5. 回报："已将 15 张截图整理到'截图整理'文件夹中"
```

---

## 7. 目录结构

```
ai-assistant/
├── backend/                        # Python 核心后端
│   ├── main.py                     # FastAPI 入口
│   ├── config.py                   # 配置管理
│   ├── orchestrator/
│   │   ├── orchestrator.py         # 编排层主逻辑
│   │   ├── task_decomposer.py      # 任务分解
│   │   ├── agent_scheduler.py      # Agent 调度
│   │   ├── cross_debate.py         # Cross-Debate 模式
│   │   └── cross_review.py         # Cross-Review 模式
│   ├── agents/
│   │   ├── base_agent.py           # Agent 基类
│   │   ├── coding_agent.py         # 代码开发 Agent
│   │   ├── research_agent.py       # 信息搜索/研究 Agent
│   │   ├── daily_agent.py          # 日常任务 Agent
│   │   ├── computer_agent.py       # 电脑操控 Agent
│   │   └── registry.py             # Agent 注册表
│   ├── task_engine/
│   │   ├── task_manager.py         # 任务生命周期管理
│   │   ├── task_models.py          # 数据模型
│   │   └── kanban.py               # 看板状态管理
│   ├── memory/
│   │   ├── memory_manager.py       # 记忆管理器
│   │   ├── short_term.py           # 短期记忆
│   │   ├── long_term.py            # 长期记忆 (ChromaDB)
│   │   └── project_memory.py       # 项目记忆
│   ├── message_bus/
│   │   ├── event_bus.py            # 事件总线
│   │   ├── channels.py             # 任务频道管理
│   │   └── websocket_server.py     # WebSocket 服务
│   ├── llm/
│   │   ├── gateway.py              # LLM 网关 (LiteLLM)
│   │   ├── prompt_builder.py       # 提示词构建
│   │   └── tool_definitions.py     # 工具定义
│   ├── tools/                      # Agent 可用工具
│   │   ├── web_search.py
│   │   ├── file_operations.py
│   │   ├── code_executor.py
│   │   └── screen_capture.py
│   └── database/
│       ├── db.py                   # SQLite 连接管理
│       └── migrations/             # 数据库迁移
│
├── desktop/                        # Electron 桌面端
│   ├── package.json
│   ├── main/                       # Electron 主进程
│   │   ├── index.js
│   │   ├── tray.js                 # 系统托盘
│   │   └── ipc.js                  # IPC 通信
│   ├── renderer/                   # 渲染进程
│   │   ├── index.html
│   │   ├── live2d/
│   │   │   ├── live2d-renderer.js  # Live2D 渲染
│   │   │   ├── lip-sync.js         # 口型同步
│   │   │   └── expression.js       # 表情控制
│   │   ├── ui/
│   │   │   ├── chat-overlay.js     # 对话气泡
│   │   │   └── status-bar.js       # 状态栏
│   │   └── styles/
│   └── python-bridge/              # Python 服务桥接
│       ├── voice_pipeline.py       # STT + TTS
│       ├── computer_control.py     # 电脑操控
│       └── screen_reader.py        # 截屏 + 理解
│
├── web/                            # React 网页端
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx       # 总览仪表盘
│   │   │   ├── Kanban.tsx          # 任务看板
│   │   │   ├── TaskChannel.tsx     # 任务进度频道
│   │   │   └── Settings.tsx        # 设置面板
│   │   ├── components/
│   │   │   ├── TaskCard.tsx
│   │   │   ├── ChannelMessage.tsx
│   │   │   ├── AgentAvatar.tsx
│   │   │   ├── DecisionPoint.tsx   # 需要审批的决策点
│   │   │   └── SubTaskTree.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts     # WebSocket 连接
│   │   │   └── useTaskStore.ts     # 任务状态管理
│   │   └── lib/
│   │       └── api.ts              # 后端 API 调用
│   └── public/
│
├── data/                           # 数据目录
│   ├── db/                         # SQLite 数据库
│   ├── chroma/                     # ChromaDB 向量库
│   ├── memories/                   # 记忆文件
│   ├── live2d-models/              # Live2D 模型文件
│   └── logs/                       # 运行日志
│
├── configs/                        # 配置文件
│   ├── agents.yaml                 # Agent 定义
│   ├── llm.yaml                    # LLM 配置
│   └── system.yaml                 # 系统配置
│
└── scripts/                        # 工具脚本
    ├── setup.sh                    # 一键安装
    └── start.sh                    # 一键启动
```

---

## 8. 开发路线建议（分阶段）

### Phase 1：骨架搭建（1-2 周）

目标：跑通最小闭环 — **语音说一句话 → Agent 回一句话 → Live2D 嘴巴动**

- [ ] 后端：FastAPI 框架 + WebSocket 基础
- [ ] 后端：LLM Gateway（LiteLLM 接入 Claude API）
- [ ] 后端：最简 Orchestrator（直接转发给单个 Agent）
- [ ] 桌面端：Electron + Live2D 模型加载显示
- [ ] 桌面端：STT + TTS 管线跑通
- [ ] 桌面端：口型同步

### Phase 2：任务系统（1-2 周）

目标：**能创建任务、看到看板、看到进度**

- [ ] 后端：SQLite 数据库 + 任务 CRUD
- [ ] 后端：任务生命周期状态机
- [ ] 后端：消息总线 + 任务频道
- [ ] 网页端：React 项目搭建
- [ ] 网页端：任务看板（拖拽式）
- [ ] 网页端：任务频道页面（消息流展示）
- [ ] 网页端：设置面板（API Key 配置）

### Phase 3：多 Agent 编排（2-3 周）

目标：**Cross-Debate / Cross-Review 跑通，多 Agent 协作**

- [ ] 后端：Agent 注册表 + 多 Agent 定义
- [ ] 后端：任务分解引擎
- [ ] 后端：Cross-Debate 流程
- [ ] 后端：Cross-Review 流程
- [ ] 后端：Agent 调度器
- [ ] 网页端：频道中展示辩论/审核过程
- [ ] 网页端：人类审批决策点交互

### Phase 4：电脑操控（1-2 周）

目标：**能截屏理解 + 真正操控电脑**

- [ ] 桌面端：截屏模块 + Vision API 集成
- [ ] 桌面端：pyautogui 鼠标键盘操控
- [ ] 桌面端：pywinauto 窗口管理
- [ ] 桌面端：脚本执行沙盒
- [ ] 安全机制：操作确认弹窗
- [ ] 网页端：操控日志在频道中展示

### Phase 5：记忆与打磨（2-3 周）

目标：**长期记忆、经验积累、体验优化**

- [ ] 后端：ChromaDB 向量记忆
- [ ] 后端：自动记忆生成（从对话/任务中提取）
- [ ] 后端：记忆检索与注入
- [ ] 网页端：记忆管理界面
- [ ] 桌面端：Live2D 表情系统完善
- [ ] 全局：错误处理、重试机制、边界情况
- [ ] 全局：性能优化、日志完善

---

## 9. 关键设计原则（从参考项目中提炼）

1. **Briefing 写目标不写文件**（ClawdBot 教训）
   — 给 Agent 的指令描述目标和约束，不限定实现路径

2. **Agent 共识需要人类验证**（Cross-Debate 集体错误案例）
   — 三个 Agent 都同意不代表正确，关键决策必须人类拍板

3. **密钥和敏感信息永远不过聊天**（密钥泄露事故）
   — 使用环境变量，Agent 上下文中不出现原始密钥

4. **本地完成所有工作再推远端**（auto-merge 事故）
   — 实现、测试、审核、修复全做完，再标记为 done

5. **Agent 需要"工牌"**（飞书文章）
   — 明确身份、权限、能力边界，多 Agent 协作的基础

6. **分层记忆，按需加载**（OpenClaw Skills 思路）
   — 不把所有记忆塞进上下文，根据任务语义检索相关片段

7. **频道即日志**（agenthub 消息板）
   — 每个任务的完整过程可追溯、可审计、可回放
