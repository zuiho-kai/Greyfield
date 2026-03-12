# 灰风（GreyWind）— 个人 AI 助手系统规格书 v3

> 给 Claude Code 的完整开发指令。
> **策略：从 Open-LLM-VTuber 拆模块级零件，深度集成进灰风自己的统一代码库。不是 fork，是拆件重组。**

---

## 一、为什么不直接 fork

Open-LLM-VTuber（https://github.com/Open-LLM-VTuber/Open-LLM-VTuber）是目前最成熟的 Live2D + LLM 桌宠项目（6.1k star，MIT 协议），但它的定位是"AI伴侣"，不是"任务操作系统"。

直接 fork 的问题：
- 它有大量我们不需要的配置项（直播平台集成、多人会话、代理服务器等）
- 它的 Agent 接口是为"聊天伴侣"设计的，不是为"任务调度"设计的
- 深度定制时会和上游冲突不断
- 两个项目拼装（fork + 外挂后端）配置分散，维护痛苦

**我们的做法：把它当零件库，模块级复用。**

---

## 二、Open-LLM-VTuber 模块拆件清单

它的源码结构（v1.0.0+）：

```
src/open_llm_vtuber/
├── agent/                  # Agent 系统
│   ├── agent_interface.py  # Agent 抽象基类
│   ├── agent_factory.py    # Agent 工厂
│   └── agents/             # 具体实现（basic_memory_agent, hume_ai 等）
│       └── stateless_llm/  # 无状态 LLM 接口封装
├── asr/                    # 语音识别引擎
│   ├── asr_interface.py
│   ├── asr_factory.py
│   └── (faster_whisper, sherpa_onnx, fun_asr, groq_whisper, azure...)
├── tts/                    # 语音合成引擎
│   ├── tts_interface.py
│   ├── tts_factory.py
│   └── (edge_tts, gpt_sovits, cosyvoice, bark, fish_audio, azure...)
├── vad/                    # 语音活动检测
├── llm/                    # LLM 供应商适配
├── mcp_server_manager/     # MCP 工具集成
├── tool_manager/           # 工具 schema 管理
├── config_manager/         # 配置系统（Pydantic 模型）
├── conversation.py         # 对话管理
├── chat_history_manager.py # 对话历史持久化
├── live2d_model.py         # Live2D 模型管理
├── service_context.py      # 服务上下文（DI 容器）
├── server.py               # FastAPI + WebSocket 服务
├── websocket_handler.py    # WebSocket 消息处理
└── routes.py               # HTTP 路由
```

### 直接搬进来用的模块（算法/引擎级复用）

| 模块 | 搬什么 | 为什么 |
|------|--------|--------|
| `asr/` | 整个目录，包括所有引擎实现 | STT 引擎封装已经很成熟，接口统一，支持 10+ 引擎 |
| `tts/` | 整个目录，包括 GPT-SoVITS/CosyVoice 等 | TTS 引擎封装同上，含音色克隆支持 |
| `vad/` | 整个目录 | 语音活动检测，配合 STT 用 |
| `llm/` | 整个目录 | LLM 供应商适配层，比 LiteLLM 更贴合这个项目的用法 |
| `live2d_model.py` | 单文件 | Live2D 模型加载和表情控制逻辑 |
| `mcp_server_manager/` | 整个目录 | MCP 工具集成，浏览器操控等走这个 |
| `tool_manager/` | 整个目录 | 工具 schema 管理 |

### 参考设计但重写的部分

| 模块 | 参考什么 | 为什么重写 |
|------|---------|-----------|
| `agent/agent_interface.py` | 接口设计思路 | 我们的 Agent 要支持任务调度，不只是对话 |
| `service_context.py` | DI 容器模式 | 我们要加任务引擎、记忆系统、事件总线 |
| `conversation.py` | 对话流管理 | 我们的对话要和任务系统联动 |
| `server.py` / `routes.py` | 服务框架 | 我们的后端要同时服务桌面端和网页端 |
| `websocket_handler.py` | 消息处理模式 | 我们的消息协议更复杂（任务事件、多 Agent） |
| `config_manager/` | Pydantic 配置模型 | 去掉不需要的（直播等），加任务/Agent/蜂巢配置 |
| `chat_history_manager.py` | 持久化思路 | 我们要统一到 SQLite，不只是对话历史 |

### 不要的部分

| 模块 | 为什么不要 |
|------|-----------|
| 直播平台集成（Bilibili等） | 灰风是个人助手，不是主播 |
| 多人会话/多租户 | 单用户 |
| 代理服务器/proxy 配置 | 不需要 |
| 前端子模块（React 桌面客户端） | 我们自己写前端，控制力更强 |

---

## 三、灰风统一项目结构

```
greywind/
├── src/
│   └── greywind/
│       │
│       │── ===== 从 Open-LLM-VTuber 搬来的零件 =====
│       ├── engines/                    # 引擎层（直接复用）
│       │   ├── asr/                    # ← 搬自 open_llm_vtuber/asr/
│       │   │   ├── asr_interface.py    #    统一 ASR 接口
│       │   │   ├── asr_factory.py      #    工厂：按配置字符串实例化
│       │   │   ├── whisper_asr.py
│       │   │   ├── sherpa_onnx_asr.py
│       │   │   ├── fun_asr.py
│       │   │   └── ...
│       │   ├── tts/                    # ← 搬自 open_llm_vtuber/tts/
│       │   │   ├── tts_interface.py
│       │   │   ├── tts_factory.py
│       │   │   ├── edge_tts.py
│       │   │   ├── gpt_sovits.py       # 参考音频定制音色
│       │   │   ├── cosyvoice_tts.py
│       │   │   └── ...
│       │   ├── vad/                    # ← 搬自 open_llm_vtuber/vad/
│       │   ├── llm/                    # ← 搬自 open_llm_vtuber/llm/
│       │   │   ├── llm_interface.py
│       │   │   ├── llm_factory.py
│       │   │   ├── openai_llm.py       # Claude/GPT/任何 OpenAI 兼容
│       │   │   ├── gemini_llm.py
│       │   │   └── ...
│       │   └── live2d/                 # ← 搬自 open_llm_vtuber/live2d_model.py
│       │       └── live2d_model.py     #    模型加载 + 表情控制
│       │
│       │── ===== 灰风自己的核心 =====
│       ├── persona/                    # 皮套 Agent（桌面端人格）
│       │   ├── persona_agent.py        # 继承 AgentInterface，对话+任务感知
│       │   ├── voice_pipeline.py       # STT→LLM→TTS 管线编排
│       │   ├── screen_sense.py         # 截屏→Vision API→结构化描述
│       │   ├── lip_sync.py             # 音频→口型同步信号
│       │   └── emotion_mapper.py       # LLM 情绪→Live2D 表情映射
│       │
│       ├── conductor/                  # 主控 Agent（大脑）
│       │   ├── conductor.py            # 任务分析、分解、调度
│       │   ├── task_decomposer.py      # 任务拆解
│       │   ├── agent_scheduler.py      # Agent 选择与调度
│       │   ├── cross_debate.py         # 多 Agent 辩论
│       │   └── cross_review.py         # 交叉审核
│       │
│       ├── hive/                       # 蜂巢（专家 Agent 池）
│       │   ├── agent_base.py           # 执行 Agent 基类
│       │   ├── operator.py             # 操作者（浏览器/桌面/终端）
│       │   ├── researcher.py           # 研究者（检索/摘要/对比）
│       │   ├── planner.py              # 规划者（SOP/依赖管理）
│       │   ├── reviewer.py             # 审核者（验收/挑错）
│       │   └── registry.py             # Agent 注册表
│       │
│       ├── tasks/                      # 任务引擎
│       │   ├── models.py               # 数据模型（Task, SubTask, Message, Artifact）
│       │   ├── manager.py              # 任务生命周期 + 状态机
│       │   ├── channels.py             # 任务频道（决策流/执行流/产物流）
│       │   └── scheduler.py            # 定时任务
│       │
│       ├── memory/                     # 记忆系统
│       │   ├── interface.py            # 统一记忆接口
│       │   ├── store_json.py           # Spine 阶段：JSON 文件
│       │   ├── store_sqlite.py         # Module 阶段：SQLite
│       │   ├── store_vector.py         # Module 阶段：ChromaDB
│       │   └── retriever.py            # 记忆检索策略
│       │
│       ├── tools/                      # 工具层
│       │   ├── mcp_manager/            # ← 搬自 open_llm_vtuber/mcp_server_manager/
│       │   ├── tool_manager/           # ← 搬自 open_llm_vtuber/tool_manager/
│       │   ├── browser_control.py      # Playwright 浏览器操控
│       │   ├── desktop_control.py      # pyautogui + pywinauto
│       │   ├── file_ops.py             # 文件操作
│       │   └── screen_capture.py       # mss 截屏
│       │
│       ├── server/                     # 服务层
│       │   ├── app.py                  # FastAPI 应用
│       │   ├── ws_handler.py           # WebSocket 消息处理
│       │   ├── routes_api.py           # REST API（任务/记忆/设置）
│       │   ├── routes_ws.py            # WebSocket 路由
│       │   ├── event_bus.py            # 事件总线
│       │   └── service_context.py      # DI 容器（参考 OLV 设计，扩展）
│       │
│       ├── config/                     # 配置系统
│       │   ├── models.py               # Pydantic 配置模型（精简版）
│       │   └── loader.py               # 配置加载
│       │
│       └── database/
│           ├── db.py                   # SQLite 连接管理
│           └── migrations.py           # 数据库迁移
│
├── frontend/                           # 桌面端前端
│   ├── desktop/                        # Electron 桌面壳
│   │   ├── main.js
│   │   ├── preload.js
│   │   └── renderer/
│   │       ├── index.html
│   │       ├── live2d-renderer.js      # pixi-live2d-display 渲染
│   │       ├── voice-ui.js             # 语音交互 UI
│   │       ├── chat-overlay.js         # 对话气泡
│   │       └── socket-client.js
│   └── web/                            # 网页管理端
│       ├── package.json
│       └── src/
│           ├── pages/
│           │   ├── Dashboard.tsx
│           │   ├── Board.tsx           # 任务看板
│           │   ├── Channel.tsx         # 任务频道
│           │   ├── Settings.tsx
│           │   └── Knowledge.tsx       # 记忆管理
│           └── ...
│
├── live2d-models/                      # Live2D 模型文件
├── characters/                         # 角色配置
│   └── greywind.yaml                  # 灰风角色设定（一个文件搞定）
├── data/
│   ├── greywind.db                    # SQLite 主数据库
│   ├── memory.json                    # Spine 阶段记忆
│   └── logs/
│
├── conf.yaml                          # 全局配置（精简，只留需要的）
├── run.py                             # 统一入口
├── pyproject.toml
└── start.bat                          # Windows 一键启动
```

### 配置精简对比

Open-LLM-VTuber 的 conf.yaml 有几百行，包含大量我们不需要的配置。
灰风的 conf.yaml 只保留：

```yaml
# greywind conf.yaml — 只有你真正会改的东西

server:
  host: "127.0.0.1"
  port: 12393

llm:
  provider: "openai"          # openai / gemini / claude / ollama
  model: "claude-sonnet-4-20250514"
  api_key: "${ANTHROPIC_API_KEY}"
  base_url: null              # OpenAI 兼容端点

asr:
  engine: "whisper_api"       # whisper_api / sherpa_onnx / fun_asr / faster_whisper
  model: "whisper-1"

tts:
  engine: "edge_tts"          # edge_tts / gpt_sovits / cosyvoice / fish_audio
  voice: "zh-CN-XiaoxiaoNeural"
  # 音色克隆配置（tts.engine 为 gpt_sovits 时）
  gpt_sovits:
    ref_audio: "characters/greywind_voice_ref.wav"
    ref_text: "参考音频对应的文字"

vision:
  provider: "openai"          # 用于截屏理解的多模态模型
  model: "gpt-4o"

character: "greywind"         # 指向 characters/greywind.yaml

tasks:
  default_risk_level: "R2"    # R0/R1/R2/R3
  auto_execute_below: "R1"    # 低于此等级自动执行
  confirm_above: "R2"         # 高于此等级需确认

memory:
  backend: "json"             # json / sqlite / vector
```

角色配置单独一个文件：

```yaml
# characters/greywind.yaml
name: "灰风"
persona: |
  你是灰风，一个高效的个人AI助手。
  说话简洁直接，不废话。
  你有能力看到用户屏幕、操控浏览器和桌面程序。
  你可以创建和管理任务，调度专家Agent协作完成复杂工作。

live2d_model: "greywind"      # live2d-models/ 下的目录名
emotion_map:
  neutral: "idle"
  thinking: "think"
  happy: "smile"
  focused: "serious"
  error: "surprised"
```

**总配置从几百行压缩到 ~50 行。** 大部分引擎配置走工厂默认值。

---

## 四、Spine + Module 演化路径（不变）

### Spine（3-5天）

只做这些，其他一律不碰：

```
1. 创建项目骨架
2. 把 OLV 的 asr/ tts/ vad/ llm/ live2d 模块复制进 engines/
3. 实现 persona/voice_pipeline.py：STT→LLM→TTS 管线
4. 实现 server/app.py：FastAPI + WebSocket
5. 实现 frontend/desktop/：Electron + Live2D 渲染 + 口型同步
6. 实现 memory/store_json.py：最简记忆
7. conf.yaml + characters/greywind.yaml
8. start.bat 一键启动
```

**验收：说话→回话→嘴巴动，知道自己叫灰风。**

Spine 阶段灰风是一个单进程服务：
- FastAPI 跑 WebSocket
- Electron 连 WebSocket
- 皮套 Agent 直接调 LLM，没有主控也没有蜂巢

### Module 路径（按需，每个独立）

| Module | 做什么 | 前置 | 预估 |
|--------|--------|------|------|
| A 音色克隆 | 启用 engines/tts/gpt_sovits.py | Spine | 1天 |
| B 屏幕感知 | persona/screen_sense.py + Vision API | Spine | 2天 |
| C 浏览器操控 | tools/browser_control.py + Playwright | Spine | 3天 |
| D 桌面操控 | tools/desktop_control.py + pyautogui | Spine | 2天 |
| E 任务持久化 | tasks/ + database/ + SQLite | Spine | 2天 |
| F 网页端最小版 | frontend/web/ Dashboard+Settings | E | 3天 |
| G 主控分离 | conductor/ 从 persona 中独立 | E | 3天 |
| H 任务频道 | tasks/channels.py + web Channel页 | E+F | 5天 |
| I 蜂巢 | hive/ 多 Agent | G | 1-2周 |
| J 记忆升级 SQLite | memory/store_sqlite.py | E | 2天 |
| K 记忆升级向量 | memory/store_vector.py + ChromaDB | J | 2天 |
| L 表情联动 | persona/emotion_mapper.py | Spine | 1天 |
| M 悬浮球 | Electron 窗口模式切换 | Spine | 1天 |
| N 主动播报 | 定时触发→皮套语音通知 | E | 2天 |

**MVP = Spine + A + B + C = 能听话、看屏幕、操作浏览器、定制声音 ≈ 9-11天**

---

## 五、给 Claude Code 的执行指令

### 第一步：项目初始化 + 引擎搬运

```
1. 创建 greywind/ 项目骨架（按上面的目录结构）
2. 初始化 pyproject.toml，Python 3.10+，用 uv 管理依赖
3. git clone Open-LLM-VTuber 到临时目录
4. 从中复制以下模块到 greywind/src/greywind/engines/：
   - src/open_llm_vtuber/asr/ → engines/asr/
   - src/open_llm_vtuber/tts/ → engines/tts/
   - src/open_llm_vtuber/vad/ → engines/vad/
   - src/open_llm_vtuber/llm/ → engines/llm/
   - src/open_llm_vtuber/live2d_model.py → engines/live2d/
   - src/open_llm_vtuber/mcp_server_manager/ → tools/mcp_manager/
   - src/open_llm_vtuber/tool_manager/ → tools/tool_manager/
5. 修改 import 路径（open_llm_vtuber → greywind.engines）
6. 补齐依赖到 pyproject.toml
7. 验证引擎能独立实例化（写个测试脚本调 tts/asr 各跑一句话）

注意：
- 复制时保留原文件的 MIT 协议声明
- 只改 import 路径，不改引擎内部逻辑
- 每个引擎目录下的 interface.py 和 factory.py 是关键抽象，保持不动
```

### 第二步：实现 Spine

```
1. 实现 config/ 配置系统：
   - 加载 conf.yaml + characters/greywind.yaml
   - Pydantic 模型验证
   - 环境变量替换 ${VAR}

2. 实现 server/service_context.py：
   - 参考 OLV 的 ServiceContext 模式
   - 按 conf.yaml 配置实例化 ASR/TTS/LLM 引擎
   - 预留 TaskManager/MemoryManager/EventBus 槽位（Module 阶段填入）

3. 实现 memory/store_json.py：
   - load/save memory.json
   - get_system_prompt() → 角色设定 + 记忆注入

4. 实现 persona/voice_pipeline.py：
   - 完整管线：音频输入→VAD→ASR→组装prompt→LLM→TTS→音频输出
   - 流式处理：TTS 边生成边播
   - 打断支持：检测到新语音输入时停止当前 TTS

5. 实现 server/app.py + server/ws_handler.py：
   - FastAPI 启动
   - WebSocket 端点 /ws
   - 消息协议（见下方）

6. 实现 frontend/desktop/：
   - Electron 主进程
   - pixi-live2d-display 渲染
   - WebSocket 连接后端
   - 音频播放 + 口型同步
   - 文字输入框

7. run.py 统一入口 + start.bat

验收：说话→回话→嘴巴动。
```

### 核心消息协议

```json
// 客户端 → 服务端
{ "type": "audio_chunk", "payload": { "audio_base64": "..." } }
{ "type": "text_input", "payload": { "text": "帮我搜索XXX" } }
{ "type": "interrupt" }

// 服务端 → 客户端
{ "type": "transcript", "payload": { "text": "帮我搜索XXX", "is_final": true } }
{ "type": "reply_text", "payload": { "text": "好的，我来搜索", "emotion": "focused" } }
{ "type": "reply_audio", "payload": { "audio_base64": "...", "duration_ms": 1500 } }
{ "type": "status", "payload": { "state": "thinking|speaking|idle|executing" } }
{ "type": "error", "payload": { "message": "..." } }

// Module 阶段扩展（加字段不改已有字段）
{ "type": "task_update", "payload": { "task_id": "...", "status": "...", "summary": "..." } }
{ "type": "confirm_request", "payload": { "action": "...", "risk": "R2", "details": "..." } }
{ "type": "confirm_response", "payload": { "action_id": "...", "approved": true } }
```

### 第三步之后

按 Module 清单，根据实际使用感受选下一个做什么。

---

## 六、开发原则（必须遵守）

1. **引擎层只搬不改**：asr/tts/vad/llm 从 OLV 搬来后，只改 import 路径，不改内部逻辑。后续 OLV 有改进可以同步。
2. **Spine 接口稳定**：WebSocket 消息协议定好后，Module 只加字段不改字段。
3. **每个 Module 独立**：不依赖其他 Module（除非明确标注前置）。
4. **配置最小化**：conf.yaml 只放你真正会改的东西，其他走代码默认值。
5. **不预设顺序**：Spine 跑起来用几天，最痛的点就是下一个 Module。
6. **记忆从 JSON 长出来**：不是第一天就搞向量数据库，而是 JSON → SQLite → ChromaDB 渐进。
