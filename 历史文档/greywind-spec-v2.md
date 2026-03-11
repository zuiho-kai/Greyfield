# 灰风（GreyWind）— 个人 AI 助手系统规格书

> 本文档是给 Claude Code 的完整开发指令。
> **核心策略：不从零写。桌面端直接 fork Open-LLM-VTuber，只扩展后端任务系统和网页管理端。**
> 开发原则：Minimal Spine + Module 渐进演化。

---

## 一、关键发现：Spine 已经有人做好了

**Open-LLM-VTuber**（https://github.com/Open-LLM-VTuber/Open-LLM-VTuber）
6.1k stars，912 commits，活跃维护中。

它已经实现了灰风桌面端需要的几乎所有能力：

| 需求 | Open-LLM-VTuber 状态 |
|------|---------------------|
| Live2D 桌宠 + 透明背景 + 置顶 + 拖拽 | ✅ 完整桌面宠物模式 |
| 语音对话 + 自然打断 | ✅ 实时流式 |
| STT 多引擎（Whisper/FunASR/sherpa-onnx等） | ✅ |
| TTS 多引擎 + GPT-SoVITS/CosyVoice 音色克隆 | ✅ 参考音频定制声音 |
| LLM 多模型（Claude/GPT/Gemini/Ollama/DeepSeek等） | ✅ |
| 截屏理解（Screen Sense） | ✅ 多模态屏幕感知 |
| 摄像头理解 | ✅ |
| Live2D 表情情绪映射 | ✅ 后端控制表情 |
| MCP 协议兼容 | ✅ |
| AI 操控浏览器 | ✅ AI using its own browser |
| 长期记忆（Letta） | ✅ |
| 文字/语音双模式 | ✅ |
| 对话历史持久化 | ✅ |
| Agent 接口可扩展 | ✅ 实现简单接口即可接入自定义 Agent |
| AI 内心想法显示 | ✅ |
| 触摸反馈 | ✅ |
| 唤醒词 | ✅ |
| 多会话管理 | ✅ |

**结论：不需要从零写桌面端。直接 fork 这个项目，把精力花在它没有的部分。**

---

## 二、它没有什么？—— 这就是我们要做的

Open-LLM-VTuber 是一个**桌宠/伴侣**，不是一个**任务操作系统**。

它缺的恰好是你的核心需求：

| 需求 | Open-LLM-VTuber | 需要我们做 |
|------|-----------------|-----------|
| 任务持久化（创建/跟踪/管理任务） | ❌ 只有对话 | ✅ |
| 任务看板（Kanban） | ❌ | ✅ |
| 每个任务一个频道（工作群） | ❌ | ✅ |
| 多 Agent 编排（蜂巢） | ❌ 单 Agent | ✅ |
| 主控 Agent + 专家 Agent 分工 | ❌ | ✅ |
| Cross-Debate / Cross-Review | ❌ | ✅ |
| 后台长任务自主执行 | ❌ | ✅ |
| 网页管理端（设置/看板/频道/记忆） | ❌ 只有桌面端 | ✅ |
| 任务级记忆隔离 | ❌ | ✅ |
| 风险分级 + 审计日志 | ❌ | ✅ |
| 桌面全面操控（pyautogui/pywinauto） | ❌ 只有浏览器 | ✅ |
| 定时任务 + 主动播报 | ❌ | ✅ |

---

## 三、产品定义（不变）

类比群星里的灰风：皮套（Live2D）+ 大脑（主控 Agent）+ 蜂巢（专家 Agent 池）。

```
皮套层 = Open-LLM-VTuber（已有，fork 改造）
大脑层 = 主控 Agent + 任务引擎（新建）
蜂巢层 = 专家 Agent 池（新建）
管理层 = 网页端（新建）
```

桌面端是感知与执行的前台。
网页端是编排与治理的前台。
两端连同一个后端。

---

## 四、项目结构

```
greywind/
├── desktop/                          # Fork from Open-LLM-VTuber
│   ├── (Open-LLM-VTuber 原有代码)     # Live2D + 语音 + 屏幕感知 + 浏览器操控
│   ├── conf.yaml                     # 配置（模型、TTS引擎、Live2D模型等）
│   └── 我们的改动：
│       ├── agents/greywind_agent.py  # 自定义 Agent 实现（继承 Agent 接口）
│       │                             # 在原有对话能力上加：
│       │                             #   - 连接后端任务系统
│       │                             #   - 任务创建/查询/汇报
│       │                             #   - 接收后台任务通知
│       │                             #   - 转发复杂任务给主控
│       └── tools/                    # 额外工具
│           ├── desktop_control.py    # pyautogui/pywinauto 桌面操控
│           └── task_bridge.py        # 与后端任务系统的 WebSocket 桥接
│
├── backend/                          # 新建：任务操作系统后端
│   ├── main.py                       # FastAPI + Socket.IO 入口
│   ├── config.py                     # 配置
│   ├── orchestrator/                 # 主控 Agent（大脑）
│   │   ├── conductor.py              # 任务分析、分解、调度
│   │   ├── cross_debate.py           # 多 Agent 辩论
│   │   └── cross_review.py           # 交叉审核
│   ├── agents/                       # 蜂巢
│   │   ├── base.py                   # Agent 基类
│   │   ├── operator.py              # 操作者（浏览器/桌面/终端）
│   │   ├── researcher.py            # 研究者（检索/摘要/对比）
│   │   ├── planner.py               # 规划者（拆步骤/SOP）
│   │   └── reviewer.py              # 审核者（验收/挑错）
│   ├── tasks/                        # 任务引擎
│   │   ├── models.py                 # 任务数据模型
│   │   ├── manager.py                # 任务生命周期 + 状态机
│   │   └── channels.py              # 任务频道（消息流）
│   ├── memory/                       # 记忆系统
│   │   ├── memory.py                 # 统一接口
│   │   ├── store_json.py            # Spine 阶段：JSON
│   │   ├── store_sqlite.py          # Module 阶段：SQLite
│   │   └── store_vector.py          # Module 阶段：ChromaDB
│   ├── llm/                          # LLM 网关
│   │   └── gateway.py               # LiteLLM 统一封装
│   ├── bus/                          # 事件总线
│   │   └── event_bus.py             # 任务事件 + WebSocket 推送
│   └── database/
│       └── db.py                     # SQLite
│
├── web/                              # 新建：网页管理端
│   ├── package.json
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx         # 总览
│   │   │   ├── Board.tsx             # 任务看板
│   │   │   ├── Channel.tsx           # 任务频道（cat-cafe 风格）
│   │   │   ├── Settings.tsx          # 后台设置
│   │   │   └── Knowledge.tsx         # 记忆管理
│   │   └── ...
│   └── ...
│
├── data/
│   ├── db/                           # SQLite
│   ├── memory.json                   # Spine 阶段记忆
│   └── logs/                         # 审计日志
│
└── start.bat                         # 一键启动：桌面端 + 后端 + 网页端
```

---

## 五、开发路径（Spine + Module）

### Spine：让 Open-LLM-VTuber 跑起来（1-2 天）

不写代码，只做配置和验证：

```
步骤：
1. git clone --recursive https://github.com/Open-LLM-VTuber/Open-LLM-VTuber.git desktop
2. 安装依赖（按官方文档）
3. 配置 conf.yaml：
   - LLM: Claude API（或你偏好的模型）
   - TTS: Edge TTS（先用免费的跑通）
   - ASR: Whisper API 或 sherpa-onnx
4. 放入你的 Live2D 模型到 frontend/live2d_models/
5. 启动，验证：
   - [ ] 桌面出现 Live2D 角色
   - [ ] 能语音对话
   - [ ] 能截屏理解（Screen Sense）
   - [ ] 能文字输入
   - [ ] 对话历史保留
```

**验收：原版 Open-LLM-VTuber 正常运行。这就是你的 Spine。**

---

### Module A：参考音频定制声音（1天）

Open-LLM-VTuber 已内置 GPT-SoVITS 和 CosyVoice 支持。

```
步骤：
1. 准备参考音频（5-30秒清晰人声）
2. conf.yaml 中把 TTS 引擎切换到 GPT-SoVITS 或 CosyVoice
3. 配置参考音频路径
4. 验收：灰风说话是你想要的音色
```

---

### Module B：自定义 Agent — 连接后端任务系统（3-5天）

这是第一个需要写代码的 Module。
Open-LLM-VTuber 支持自定义 Agent（实现其 Agent 接口即可）。

```
做什么：
1. 搭建 backend/ 最小版：FastAPI + Socket.IO + SQLite
2. 实现任务 CRUD API
3. 在 desktop/ 中创建 greywind_agent.py，继承 Open-LLM-VTuber 的 Agent 接口
4. greywind_agent 在原有对话能力上增加：
   - 识别"这是一个任务"（通过 LLM function calling）
   - 创建任务到后端
   - 查询任务状态
   - 后端任务完成时通过 WebSocket 通知桌面端播报

验收：你说"帮我调研 X 技术"，灰风创建一个任务，你在终端能看到任务记录。
```

---

### Module C：网页端最小版（3-5天）

```
做什么：
1. React + Vite + Tailwind + shadcn/ui
2. 三个页面：
   - Dashboard：当前任务列表 + 灰风状态
   - Settings：API Key、模型配置、TTS 配置
   - Conversations：从 Open-LLM-VTuber 的对话历史读取展示
3. 连后端 WebSocket 实时更新

验收：localhost:3000 能看到任务列表和设置页。
```

---

### Module D：桌面操控扩展（2-3天）

Open-LLM-VTuber 已有浏览器操控，但缺少桌面级操控。

```
做什么：
1. desktop/tools/desktop_control.py：
   - pyautogui：鼠标键盘
   - pywinauto：窗口管理
   - subprocess：启动程序/脚本
2. 注册为 MCP 工具或 function calling 工具
3. 风险分级（R0-R3）+ 确认机制
4. 审计日志

验收：让灰风"打开记事本写一段话"。
```

---

### Module E：任务频道 — cat-cafe 风格（5-7天）

```
做什么：
1. 任务模型扩展：子任务、工件、消息流
2. 每个任务 = 一个频道，频道内 3 条流：
   - 决策流（为什么这样做）
   - 执行流（做了什么）
   - 产物流（产出了什么）
3. 网页端新增页面：
   - Board（看板）：Inbox / Planned / Running / Waiting / Done / Failed
   - Channel（频道详情）：Timeline / Artifacts / Subtasks / Memory
4. 人类可在频道中插话
5. 决策审批点

验收：2个任务同时跑，每个有独立频道，能实时看进度。
```

---

### Module F：主控 Agent 分离 + 蜂巢（1-2周）

```
做什么：
1. 皮套 Agent（greywind_agent）和主控 Agent（conductor）分离
   - 皮套负责：接输入、展示、播报
   - 主控负责：分析任务、选人、调度、汇总
2. 4 类专家 Agent：
   - Operator / Researcher / Planner / Reviewer
3. 协作模式：
   - 单 Agent 直接执行
   - Cross-Debate（多方案对比）
   - Cross-Review（交叉审核）
4. 子任务并行执行

验收：下一个复杂任务，主控拆分给不同 Agent，频道里看到协作过程。
```

---

### Module G：记忆升级（渐进，2-5天）

```
阶段 1（已有）：Open-LLM-VTuber 的 Letta 记忆
阶段 2：后端加 SQLite 记忆表，按 type 分类
阶段 3：ChromaDB 向量检索
阶段 4：任务级记忆隔离 + 记忆网页管理

每阶段独立可做，不影响其他 Module。
```

---

### Module H：定时任务 + 主动播报（2-3天）

```
做什么：
1. 后端定时触发器
2. 任务完成/失败/需确认时，通过 WebSocket 通知桌面端
3. 皮套 Agent 主动语音播报
4. Windows toast 通知
5. 免打扰时段配置

验收：后台任务跑完，灰风主动说"XX 搞定了"。
```

---

## 六、MVP 定义

你的原话：**"能听我说话、看当前屏幕、帮我操作浏览器完成固定流程"**

**MVP = Spine（Open-LLM-VTuber 原版配置好） + Module A（定制声音）**

因为 Open-LLM-VTuber 原版已经支持：语音对话 + 截屏理解 + 浏览器操控。

你只需要：
1. Clone 并配置（1-2 天）
2. 放入你的 Live2D 模型
3. 配置好 LLM API
4. 用 GPT-SoVITS 配置你想要的音色
5. 测试浏览器操控功能

**MVP 预估时间从 8-13 天缩短到 1-3 天。**

然后把省下来的时间花在真正需要新建的部分：任务系统 + 网页端 + 多 Agent 蜂巢。

---

## 七、给 Claude Code 的执行指令

### 第一步：Spine — 配置 Open-LLM-VTuber

```
1. Clone Open-LLM-VTuber 到 greywind/desktop/
   git clone --recursive https://github.com/Open-LLM-VTuber/Open-LLM-VTuber.git desktop

2. 按官方文档安装依赖：
   文档地址：https://open-llm-vtuber.github.io/en/ 或 http://docs.llmvtuber.com/en/docs/intro/

3. 配置 conf.yaml：
   - llm: 选 Claude API 或 OpenAI API
   - tts: 先用 edge_tts
   - asr: 选 whisper_api 或 sherpa_onnx
   - live2d_model: 指向用户的模型

4. 验证所有功能正常：语音对话、屏幕感知、浏览器操控、表情联动

注意：不要修改 Open-LLM-VTuber 的核心代码。
所有定制通过 conf.yaml 和自定义 Agent 接口实现。
这样可以持续跟进上游更新。
```

### 第二步：搭建后端任务系统骨架

```
创建 greywind/backend/：
1. FastAPI + Socket.IO 服务
2. SQLite 数据库
3. 任务 CRUD API（创建/查询/更新/删除）
4. 任务状态机：inbox → planned → running → completed/failed
5. 事件总线：任务状态变更时 WebSocket 推送
6. 最小记忆：memory.json（角色设定 + 用户偏好）

验收：API 可用，curl 能创建和查询任务。
```

### 第三步：自定义 Agent 桥接桌面端和后端

```
在 desktop/ 中实现 greywind_agent.py：
1. 继承 Open-LLM-VTuber 的 Agent 接口
2. 在对话能力基础上，通过 function calling 识别任务意图
3. 连接后端 API 创建/查询任务
4. 接收后端 WebSocket 推送，触发语音播报

验收：通过语音让灰风创建任务，后端有记录。
```

### 第四步：网页端最小版

```
创建 greywind/web/：
1. React + Vite + Tailwind + shadcn/ui
2. Dashboard + Settings + 任务列表
3. WebSocket 实时更新

验收：localhost:3000 看到任务列表。
```

### 之后：按 Module E → F → G → H 的顺序根据使用感受推进。

---

## 八、技术选型（精简版）

| 层 | 技术 | 理由 |
|----|------|------|
| 桌面端 | **Open-LLM-VTuber（不动）** | 已有全部桌面能力 |
| 后端 | Python + FastAPI + Socket.IO | 和 Open-LLM-VTuber 同语言生态 |
| 数据库 | SQLite | 本地零依赖 |
| 向量库 | ChromaDB（后期） | 本地嵌入式 |
| LLM | LiteLLM（后端）/ Open-LLM-VTuber 自带（桌面端） | |
| 网页端 | React + Vite + Tailwind + shadcn/ui | |
| 桌面操控 | pyautogui + pywinauto（扩展） | |
| 部署 | Windows 本地，全部 localhost | |

---

## 九、不从零写的代价和风险

**好处**：
- MVP 从 2 周缩到 2-3 天
- Live2D + 语音 + 屏幕感知 + 浏览器操控 这些最复杂的部分不用写
- 6k star 项目，社区活跃，持续更新
- 模块化设计，Agent 接口清晰

**风险和应对**：
- 上游更新可能和你的改动冲突 → 所有定制走 Agent 接口和配置文件，不改核心代码
- 上游不维护了 → MIT 协议，最坏情况自己 fork 维护
- 功能不完全符合需求 → 通过自定义 Agent + 外部后端扩展，不受限于它的架构
