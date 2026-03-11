# 灰风（GreyWind）— 系统规格书

> **读者**：开发者 / Claude Code CLI
> **核心策略**：从 Open-LLM-VTuber 拆模块级零件，集成进灰风统一代码库。不是 fork，是拆件重组。
> **开发原则**：Minimal Spine → Module 渐进演化。让系统先活起来，再逐步长出功能。

---

## 一、产品定义

一句话：**带人格外壳的个人 Agent OS。**

```
你（人类）
  │
  ├── 桌面端（即时交互 + 电脑代操作）
  │     Live2D 桌宠 · 语音对话 · 屏幕感知 · 桌面/浏览器操控
  │
  └── 网页端（任务管理 + 过程审计 + 配置中枢）
        Dashboard · 任务看板 · 任务频道 · 设置 · 记忆管理

两端连同一个后端 ↓

后端：皮套 Agent（对话人格）
      → 主控 Agent（任务分解与调度）
        → 蜂巢（专家 Agent 池：Operator / Researcher / Planner / Reviewer）
```

桌面端只做感知与执行，不持有业务逻辑。所有决策、任务管理、记忆检索在后端完成。

---

## 二、开发原则

1. **Minimal Spine**：不实现这个模块系统还能运行吗？能 → Module，不能 → Spine。
2. **Module 可插拔**：每个 Module 独立，不依赖其他 Module（除非明确标注前置），顺序由使用感受决定。
3. **接口稳定**：WebSocket 消息协议定好后，Module 只加字段不改字段，Spine 永远不用重构。
4. **引擎层只搬不改**：从 OLV 搬来的 asr/tts/vad/llm 只改 import 路径，不改内部逻辑，方便同步上游改进。
5. **配置最小化**：conf.yaml 只放你真正会改的东西，其他走代码默认值。
6. **风险分级**：所有电脑操控操作有 R0-R3 分级 + 确认机制 + 审计日志。
7. **Briefing 写目标不写文件**：给 Agent 的指令描述目标和约束，不限定实现路径。

---

## 三、Open-LLM-VTuber 模块拆件

Open-LLM-VTuber（https://github.com/Open-LLM-VTuber/Open-LLM-VTuber ，6.1k star，MIT 协议）是目前最成熟的 Live2D + LLM 桌宠项目。我们从中拆取引擎级模块。

### 直接搬入

| 模块 | 源路径 | 目标路径 | 说明 |
|------|--------|----------|------|
| ASR 引擎 | `asr/` | `engines/asr/` | 统一接口 + 10+ 引擎（Whisper/FunASR/sherpa-onnx…） |
| TTS 引擎 | `tts/` | `engines/tts/` | 含 GPT-SoVITS/CosyVoice 音色克隆 |
| VAD | `vad/` | `engines/vad/` | 语音活动检测 |
| LLM 适配 | `llm/` | `engines/llm/` | 多供应商适配（OpenAI/Gemini/Ollama…） |
| Live2D | `live2d_model.py` | `engines/live2d/` | 模型加载 + 表情控制 |
| MCP | `mcp_server_manager/` | `tools/mcp_manager/` | MCP 工具集成 |
| 工具管理 | `tool_manager/` | `tools/tool_manager/` | 工具 schema 管理 |

### 参考设计但重写

Agent 接口、服务上下文（DI 容器）、对话流管理、WebSocket 处理、配置系统 — 参考 OLV 设计思路，但重写以支持任务调度和多 Agent。

### 不要的部分

直播平台集成、多人会话/多租户、代理服务器配置、OLV 前端子模块。

---

## 四、项目结构

```
greywind/
├── src/greywind/
│   ├── engines/                    # ← 从 OLV 搬来的引擎（只改 import）
│   │   ├── asr/                    #    ASR 接口 + 工厂 + 各引擎实现
│   │   ├── tts/                    #    TTS 接口 + 工厂 + GPT-SoVITS/CosyVoice/EdgeTTS…
│   │   ├── vad/                    #    语音活动检测
│   │   ├── llm/                    #    LLM 供应商适配
│   │   └── live2d/                 #    Live2D 模型管理
│   │
│   ├── persona/                    # 皮套 Agent（桌面端人格）
│   │   ├── persona_agent.py        #   对话 + 任务感知
│   │   ├── voice_pipeline.py       #   STT→LLM→TTS 管线编排
│   │   ├── screen_sense.py         #   截屏→Vision API→结构化描述
│   │   ├── lip_sync.py             #   音频→口型同步信号
│   │   └── emotion_mapper.py       #   LLM 情绪→Live2D 表情映射
│   │
│   ├── conductor/                  # 主控 Agent（大脑）
│   │   ├── conductor.py            #   任务分析、分解、调度
│   │   ├── task_decomposer.py
│   │   ├── agent_scheduler.py
│   │   ├── cross_debate.py         #   多 Agent 辩论
│   │   └── cross_review.py         #   交叉审核
│   │
│   ├── hive/                       # 蜂巢（专家 Agent 池）
│   │   ├── agent_base.py           #   Agent 基类（id/role/capabilities/tools/prompt）
│   │   ├── operator.py             #   浏览器/桌面/终端操作
│   │   ├── researcher.py           #   检索/摘要/对比
│   │   ├── planner.py              #   SOP/依赖管理
│   │   ├── reviewer.py             #   验收/挑错
│   │   └── registry.py             #   Agent 注册表
│   │
│   ├── tasks/                      # 任务引擎
│   │   ├── models.py               #   Task/SubTask/Message/Artifact 数据模型
│   │   ├── manager.py              #   生命周期 + 状态机
│   │   ├── channels.py             #   任务频道（决策流/执行流/产物流）
│   │   └── scheduler.py            #   定时任务
│   │
│   ├── memory/                     # 记忆系统（渐进演化：JSON→SQLite→ChromaDB）
│   │   ├── interface.py
│   │   ├── store_json.py           #   Spine 阶段
│   │   ├── store_sqlite.py         #   Module 阶段
│   │   ├── store_vector.py         #   Module 阶段
│   │   └── retriever.py            #   记忆检索策略
│   │
│   ├── tools/                      # 工具层
│   │   ├── mcp_manager/            #   ← 搬自 OLV
│   │   ├── tool_manager/           #   ← 搬自 OLV
│   │   ├── browser_control.py      #   Playwright
│   │   ├── desktop_control.py      #   pyautogui + pywinauto
│   │   ├── file_ops.py
│   │   └── screen_capture.py       #   mss 截屏
│   │
│   ├── server/                     # 服务层
│   │   ├── app.py                  #   FastAPI
│   │   ├── ws_handler.py           #   WebSocket 消息处理
│   │   ├── routes_api.py           #   REST API（任务/记忆/设置）
│   │   ├── event_bus.py            #   事件总线
│   │   └── service_context.py      #   DI 容器
│   │
│   ├── config/
│   │   ├── models.py               #   Pydantic 配置模型
│   │   └── loader.py
│   │
│   └── database/
│       ├── db.py                   #   SQLite
│       └── migrations.py
│
├── frontend/
│   ├── desktop/                    # Electron 桌面壳
│   │   ├── main.js
│   │   ├── preload.js
│   │   └── renderer/
│   │       ├── index.html
│   │       ├── live2d-renderer.js  #   pixi-live2d-display
│   │       ├── voice-ui.js
│   │       ├── chat-overlay.js
│   │       └── socket-client.js
│   │
│   └── web/                        # React 网页管理端
│       └── src/pages/
│           ├── Dashboard.tsx
│           ├── Board.tsx           #   任务看板
│           ├── Channel.tsx         #   任务频道
│           ├── Settings.tsx
│           └── Knowledge.tsx       #   记忆管理
│
├── live2d-models/
├── characters/
│   └── greywind.yaml              # 角色设定
├── data/
│   ├── greywind.db                # SQLite
│   ├── memory.json                # Spine 阶段记忆
│   └── logs/
│
├── conf.yaml                      # 全局配置（~50行，见下方）
├── run.py                         # 统一入口
├── pyproject.toml                 # Python 3.10+，uv 管理依赖
└── start.bat                      # Windows 一键启动
```

---

## 五、配置

### conf.yaml（只保留你真正会改的东西）

```yaml
server:
  host: "127.0.0.1"
  port: 12393

llm:
  provider: "openai"            # openai / gemini / claude / ollama
  model: "claude-sonnet-4-20250514"
  api_key: "${ANTHROPIC_API_KEY}"
  base_url: null

asr:
  engine: "whisper_api"         # whisper_api / sherpa_onnx / fun_asr / faster_whisper
  model: "whisper-1"

tts:
  engine: "edge_tts"            # edge_tts / gpt_sovits / cosyvoice / fish_audio
  voice: "zh-CN-XiaoxiaoNeural"
  gpt_sovits:                   # tts.engine 为 gpt_sovits 时生效
    ref_audio: "characters/greywind_voice_ref.wav"
    ref_text: "参考音频对应的文字"

vision:
  provider: "openai"
  model: "gpt-4o"

character: "greywind"

tasks:
  auto_execute_below: "R1"      # R0-R1 自动执行
  confirm_above: "R2"           # R2+ 需确认

memory:
  backend: "json"               # json / sqlite / vector
```

### characters/greywind.yaml

```yaml
name: "灰风"
persona: |
  你是灰风，一个高效的个人AI助手。
  说话简洁直接，不废话。
  你有能力看到用户屏幕、操控浏览器和桌面程序。
  你可以创建和管理任务，调度专家Agent协作完成复杂工作。
live2d_model: "greywind"
emotion_map:
  neutral: "idle"
  thinking: "think"
  happy: "smile"
  focused: "serious"
  error: "surprised"
```

---

## 六、消息协议

所有 WebSocket 通信基于此格式。Module 只加字段/类型，不改已有字段。

```jsonc
// 客户端 → 服务端
{ "type": "audio_chunk",      "payload": { "audio_base64": "..." } }
{ "type": "text_input",       "payload": { "text": "帮我搜索XXX" } }
{ "type": "interrupt" }
{ "type": "confirm_response", "payload": { "action_id": "...", "approved": true } }

// 服务端 → 客户端
{ "type": "transcript",       "payload": { "text": "...", "is_final": true } }
{ "type": "reply_text",       "payload": { "text": "...", "emotion": "focused" } }
{ "type": "reply_audio",      "payload": { "audio_base64": "...", "duration_ms": 1500 } }
{ "type": "status",           "payload": { "state": "thinking|speaking|idle|executing" } }
{ "type": "error",            "payload": { "message": "..." } }
// Module 阶段扩展 ↓
{ "type": "task_update",      "payload": { "task_id": "...", "status": "...", "summary": "..." } }
{ "type": "confirm_request",  "payload": { "action": "...", "risk": "R2", "details": "..." } }
```

---

## 七、技术选型

| 层 | 技术 | 理由 |
|----|------|------|
| 后端 | Python + FastAPI + Socket.IO | AI 生态最完整，和 OLV 同语言 |
| 数据库 | SQLite | 本地零依赖，单用户够用 |
| 向量库 | ChromaDB（后期 Module） | 本地嵌入式 |
| LLM | OLV 自带适配层（engines/llm/） | 多供应商统一接口 |
| 桌面壳 | Electron | Live2D 需要 WebGL |
| Live2D | pixi-live2d-display | 成熟的 JS 渲染库 |
| 浏览器操控 | Playwright（通过 MCP） | OLV 已有集成 |
| 桌面操控 | pyautogui + pywinauto | 鼠标键盘 + Windows 窗口 |
| 屏幕理解 | mss 截图 + Vision API | 多模态模型直接理解 |
| 网页前端 | React + Vite + Tailwind + shadcn/ui | |
| 部署 | Windows 本地，全 localhost | |

---

## 八、Spine + Module 演化路径

### Spine（3-5天）

只做这些，其他一律不碰。Spine 阶段灰风是单进程服务，**Persona = Conductor**（皮套 Agent 同时就是大脑），没有独立主控也没有蜂巢。等 Module G 再拆分。

**数据流：**
```
你说话 → 麦克风 → VAD → ASR → 组装 prompt（角色设定+记忆+历史+你的话）
→ LLM → 返回文本 → TTS → 扬声器 + Live2D 口型同步
```

**验收标准：**
- [ ] `start.bat` 一键启动后端 + Electron
- [ ] Live2D 模型显示，有待机动画
- [ ] 语音输入 → LLM 回复 → TTS 播放 + 口型同步
- [ ] 支持文字输入框备选
- [ ] 对话有上下文（最近 10 轮）
- [ ] 它知道自己叫灰风（memory.json → system prompt）
- [ ] 切换 LLM 只需改 conf.yaml

### Module 清单

每个 Module 独立可做，前置依赖已标注。

| Module | 做什么 | 前置 | 预估 |
|--------|--------|------|------|
| **A 音色克隆** | 启用 engines/tts/gpt_sovits，配参考音频 | Spine | 1天 |
| **B 屏幕感知** | screen_sense.py + Vision API，问"我在看什么"能答。**默认事件触发（窗口切换/用户问/任务需要），不要定时轮询，否则 API 成本爆炸** | Spine | 2天 |
| **C 浏览器操控** | Playwright + function calling + R0-R3 风险分级 | Spine | 3天 |
| **D 桌面操控** | pyautogui + pywinauto + subprocess + 审计日志 | Spine | 2天 |
| **E 任务持久化** | tasks/ + SQLite + CRUD API + 状态机 (inbox→planned→running→completed/failed) | Spine | 2天 |
| **F 网页端最小版** | Dashboard + Settings + 任务列表，WebSocket 实时更新 | E | 3天 |
| **G 主控分离** | conductor/ 从 persona 独立，皮套负责交互，主控负责调度 | E | 3天 |
| **H 任务频道** | channels（决策流/执行流/产物流）+ 看板 + 人类插话 + 审批点 | E+F | 5天 |
| **I 蜂巢** | hive/ 多 Agent + Cross-Debate + Cross-Review | G | 1-2周 |
| **J 记忆→SQLite** | store_sqlite.py，按 type/importance/时间筛选 Top-K 注入 prompt | E | 2天 |
| **K 记忆→向量** | store_vector.py + ChromaDB，语义检索 | J | 2天 |
| **L 表情联动** | emotion_mapper.py，LLM 回复带 emotion → Live2D 表情切换 | Spine | 1天 |
| **M 悬浮球** | Electron 窗口模式切换 + 系统托盘 + 状态色环 | Spine | 1天 |
| **N 主动播报** | 后台任务完成/失败时 WebSocket 通知 → 皮套语音播报 + toast | E | 2天 |

**MVP = Spine + A + B + C**（能听话、看屏幕、操作浏览器、定制声音）**≈ 9-11天**

Module 顺序不预设。Spine 跑起来用几天，最痛的点就是下一个 Module。

---

## 九、任务系统设计要点

### 任务状态机

```
inbox → planned → running → completed
                ↘ waiting_input  ↗
                ↘ failed
```

### 任务数据模型

```sql
tasks(id, title, description, type, status, priority, parent_task_id, created_at, updated_at)
task_messages(id, task_id, role, type, content, timestamp)
  -- role: conductor / operator / researcher / user / system
  -- type: thought / tool_call / artifact / error / decision / review
```

### 任务频道（Module H）

每个任务 = 一个频道，频道内 3 条并行信息流：
- **决策流**：为什么这样拆、为什么这样做
- **执行流**：调用了什么工具、操作了什么
- **产物流**：生成了什么文件/代码/报告

频道支持人类插话干预 + 决策审批点（Agent 暂停等你拍板）。

### 风险分级（电脑操控）

```
R0 纯观察：打开网页、截图、读文本 → 自动执行
R1 低风险：滚动、切换 tab、搜索 → 自动执行
R2 中风险：填表、点按钮、下载 → 执行前预览
R3 高风险：提交数据、付款、发消息 → 必须人类确认
```

### 记忆演化路径

皮套的对话代码不用改。它永远是"把记忆塞进 prompt 调 LLM"。变的只是 memory 层"记忆从哪来、怎么选"：

| 阶段 | 效果 | 实现 |
|------|------|------|
| Spine | 记得这次聊了什么 + 知道自己叫灰风 | context window + memory.json |
| Module J | 记得上周的偏好，重启后仍在 | SQLite，按 type/importance 筛 Top-K |
| Module K | 从几百条记忆中语义检索最相关的 | ChromaDB 向量检索 |

---

## 十、给 Claude Code 的执行指令

### 第一步：项目初始化 + 引擎搬运

```
1. 创建 greywind/ 项目骨架（按第四节目录结构）
2. 初始化 pyproject.toml，Python 3.10+，uv 管理依赖
3. git clone Open-LLM-VTuber 到临时目录
4. 复制以下模块到 src/greywind/engines/：
   - src/open_llm_vtuber/asr/  → engines/asr/
   - src/open_llm_vtuber/tts/  → engines/tts/
   - src/open_llm_vtuber/vad/  → engines/vad/
   - src/open_llm_vtuber/llm/  → engines/llm/
   - src/open_llm_vtuber/live2d_model.py → engines/live2d/
   - src/open_llm_vtuber/mcp_server_manager/ → tools/mcp_manager/
   - src/open_llm_vtuber/tool_manager/  → tools/tool_manager/
5. 修改 import 路径（open_llm_vtuber → greywind.engines）
6. 补齐依赖到 pyproject.toml
7. 验证引擎能独立实例化（写测试脚本调 tts/asr 各跑一句话）

注意：保留原文件 MIT 协议声明。只改 import 路径，不改引擎内部逻辑。
```

### 第二步：实现 Spine

```
1. config/ 配置系统：加载 conf.yaml + characters/greywind.yaml，Pydantic 验证，${VAR} 环境变量替换
2. server/service_context.py：按配置实例化 ASR/TTS/LLM，预留 TaskManager/MemoryManager/EventBus 槽位
3. memory/store_json.py：load/save memory.json，get_system_prompt() → 角色设定 + 记忆注入
4. persona/voice_pipeline.py：音频→VAD→ASR→组装prompt→LLM→TTS→音频输出
   关键：全链路必须流式。LLM 流式输出 → TTS 拿到第一句就开始合成 → 合成完第一句就开始播放。
   不能等 LLM 全部输出完再调 TTS，否则体验变成"说一句等3秒"。
   打断：检测到新语音输入时立即停止当前 TTS 播放和 LLM 生成。
   OLV 的引擎已支持流式，搬过来后保持这个特性。
5. server/app.py + ws_handler.py：FastAPI + WebSocket /ws 端点，按第六节消息协议
6. frontend/desktop/：Electron + pixi-live2d-display + WebSocket + 音频播放 + 口型同步 + 文字输入
7. run.py + start.bat

验收：说话→回话→嘴巴动，知道自己叫灰风。
```

### 第三步：按 Module 清单推进

Spine 验收通过后，根据实际使用感受选下一个 Module。每个 Module 的验收标准：

- **A**：灰风说话是你想要的音色
- **B**：问"我在看什么"，能准确描述屏幕内容
- **C**：说"帮我打开 GitHub 搜索 XX"，浏览器完成操作
- **D**：说"打开记事本写一段话"，桌面端执行
- **E**：说"帮我调研 X"，后端有任务记录，curl 能查到
- **F**：localhost:3000 看到任务列表和设置页
- **G**：复杂任务自动拆分，频道里看到调度过程
- **H**：2 个任务同时跑，各有独立频道，能实时看进度
- **I**：主控拆子任务给不同 Agent，频道里看到协作过程

---

## 附录：远景参考

本文档是可执行的开发指令。更完整的远景设计（Agent 注册表权限体系、记忆分层细节、网页端完整页面规格、典型任务流程示例等）见原始架构文档 `ai-assistant-architecture.md`，在对应 Module 实施时回查。
