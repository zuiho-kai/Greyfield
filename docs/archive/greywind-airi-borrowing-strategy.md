# GreyWind 参考项目拆解与借鉴策略

围绕“生长模式开发 + 愿景开发”的选择性借鉴建议  
重点回答：`proj-airi` 现在还能抄什么，不能抄什么  
版本：2026-03-12

## 一句话结论

Project AIRI / `proj-airi` 仍然值得抄，但只适合抄“外围器官”和“可插拔部件”，不适合替代 GreyWind 的中轴。

GreyWind 的中轴仍然是 Context Runtime、Thread / Session / Handoff 与原始意图保护。

## 1. 先给结论

如果目标是尽快做出一个“能跑、能展示、能交互”的 AI VTuber / 数字伴侣，Project AIRI 很值得参考；它已经形成了多端共享 UI、WebSocket 中枢、插件化、实时语音与部分游戏代理的完整工程面貌。

但如果目标是把 GreyWind 做成“长期连续存在的人格系统”，那就不能把 AIRI 当成总架构模板。AIRI 更像一个强大的产品外壳与运行平台；GreyWind 当前文档强调的核心，则是 Context Runtime 作为人格连续性的基础设施。

所以判断标准不是“它先进不先进”，而是：它所提供的模块，是否会强化 GreyWind 的脊椎，还是会把你带回“UI/工具很强，但连续性很弱”的普通 agent 路线。

## 2. 为什么不能把 AIRI 整体照搬

GreyWind v2 的关键判断是：系统真正的中轴不是 agent 本身，而是 context runtime；prompt 应由上下文装配而来，而不是简单从 memory store 直接拼出来。

这意味着 GreyWind 的第一性问题是：

- 我是谁
- 我在哪条 thread 上
- 当前 session 处于什么状态
- 上一代 handoff 交接了什么
- 用户原始意图是否被保护住

而 AIRI 的公开架构更明显地围绕多端应用共享、实时消息路由、聊天编排、工具调用与插件体系展开。它非常适合构建产品运行平台，但没有把 Thread / Session / Handoff / Vision Slot 作为绝对中心。

因此，AIRI 可以增强 GreyWind 的表现层、执行层、接入层，但不应取代 GreyWind 的上下文中轴。你现在的生长模式开发，不是“先搭一个巨型框架再慢慢填空”，而是先保住 Spine，再给它长器官。

## 3. 按层拆：哪些能抄，哪些不能

| 层 | 建议 | 可抄对象 | 理由 / 注意点 |
|------|------|------|------|
| Persona Shell / UI 层 | 可抄 | 多端共享 UI、舞台层、状态展示、聊天交互、动画外壳 | 这类代码属于“脸”和“肢体”，对 GreyWind 的人格连续性影响最小，复用收益高。 |
| 语音与实时交互 | 可抄 | 实时语音链路、WebSocket 事件流、VAD/STT/TTS demo、设备与会话接入 | 能显著缩短落地时间，但要接到你自己的 session / thread 标识上。 |
| 工具 / 插件接入 | 可抄 | plugin-sdk、MCP 相关桥接、server-runtime 事件路由 | 适合作为执行层和集成层，不要把工具系统当成系统中轴。 |
| 游戏 / 外部应用代理 | 视情况 | Minecraft、Factorio、Android、浏览器等专项代理 | 适合作为后续 Module，前提是它们通过统一执行接口挂到 GreyWind，而不是反客为主。 |
| 聊天编排 / orchestrator | 部分 | hook 机制、消息 ingest 生命周期、token 级事件钩子 | 可参考扩展点设计；编排器不能代替 Context Runtime。 |
| 记忆 / RAG / embedded DB | 慎用 | 数据库驱动、向量存储接入、记忆子项目 | 可以作为存储与检索后端；不能把“记忆系统”误当成“上下文装配系统”。 |
| 整仓 monorepo 组织 | 整体慎抄 | 全量 pnpm + turborepo + 多端同构布局 | 对当前 Spine Now 过重，容易把注意力从“活起来”转移到“搭架子”。 |
| 前端 store 作为核心大脑 | 不要 | 以 stage-ui / chat store 承担编排中枢 | GreyWind 的中轴应在 `context_runtime` / `decision_runtime`，不在 UI store。 |

## 4. 对 proj-airi 的具体判断

### 4.1 仍然值得抄的部分

- 实时语音与多端交互基础设施：AIRI 明确把 Web / 桌面 / 移动作为统一产品面来做，多端共享一套 UI 与消息流，这对你未来做桌面壳、网页看板、移动陪伴形态有很高参考价值。
- 插件与集成心态：AIRI 的价值不只在主仓库，还在 `proj-airi` 下拆出的多个子项目。对 GreyWind 来说，最适合借的是“部件化能力”，不是“总架构归顺”。
- 专项代理与实验模块：如 Minecraft、Factorio、Android 这类能力，天然适合成为 GreyWind 的后续生长模块。原则是把它们视为专家器官，而不是把主神经系统换成它们。

### 4.2 只能参考、不能直接继承的部分

- 聊天编排主链：AIRI 的聊天 orchestrator 很强，但它的重点是消息发送、钩子与工具流程；GreyWind 需要在这之前先做 Context Packet 装配，再决定如何发给模型。
- 记忆相关子项目：AIRI 有 RAG、memory system、embedded database 等子项目，这些能给你存储和检索能力，却无法直接回答“哪条 thread 是当前归属”“上个 session 的 handoff 如何恢复”“原始 intent 是否还活着”。
- 大型 monorepo 的组织方式：对一个已经确定采用生长模式开发的项目，先把目录、CI、子包、端侧同构一口气做满，收益并不高，反而容易把 Spine 稀释掉。

### 4.3 现阶段不要抄的部分

- 不要抄“先有大平台，再慢慢把灵魂塞进去”的节奏。
- 不要抄“前端编排层天然就是系统大脑”的设定。
- 不要为了对齐 AIRI 的生态，把 GreyWind 的 Python 中轴、Context Runtime 与 Session Chain 让位给前端 store / event graph。

## 5. 保持“生长模式开发 + 愿景开发”的借鉴流程

这里最关键的不是“抄哪些项目”，而是建立一套不会把项目带偏的引入流程。建议把所有外部项目都视为器官库，而不是蓝图库。

### 1. 先守愿景，不先守框架

任何引入都必须回答：它是否强化“长期人格连续性”这条愿景；如果只是让 demo 更炫、更像产品，但会削弱 Thread / Session / Handoff 的中心性，就先不引入。

### 2. 先守 Spine，再加 Module

Spine Now 定义的最小闭环，优先级永远高于大型生态接入：

- Live2D
- VAD
- ASR
- LLM
- TTS
- 最近对话
- 基础 `thread_id`
- 基础 `session_id`
- 最小 Context Assembler

### 3. 只抄叶子，不抄脊椎

优先抄渲染器、语音链路、WebSocket 路由、插件桥、专项代理；不直接抄聊天中枢、会话观、记忆观。脊椎必须自己长。

### 4. 先适配接口，再移植实现

先定义 GreyWind 自己的接口，再把外部实现接进来。这样未来外部项目变动时，你只替换适配层，不伤核心。

### 5. 一次只引入一个器官

每次只接入一个明确模块，例如“把 AIRI 的某个实时语音 demo 接到 GreyWind 的 Persona Shell”，而不是一次性引入整套架构。

### 6. 引入后立刻做上下文归位

任何外来模块接入后，都要补这些元信息，保证它进入 GreyWind 的上下文秩序，而不是游离在外：

- `thread_id`
- `session_id`
- event provenance
- risk level
- worklog 记录

## 6. 建议的借鉴路线图

| 阶段 | GreyWind 目标 | 优先参考 / 借鉴对象 | 控制规则 |
|------|------|------|------|
| Phase 0 / Spine | 先活起来 | Open-LLM-VTuber 的语音引擎；AIRI 的实时语音 demo、WebSocket 接入思路 | 绝不引入整仓架构；只补最小 context assembler。 |
| Phase 1 | 更像一个“存在着”的灰风 | AIRI 的 UI 表达、多端交互、状态呈现；z-waif / Neuro 的行为感 | 所有表现层能力都必须落到 session 连续性之下。 |
| Phase 2 | 会看、会做 | AIRI / `proj-airi` 的专项代理、MCP / 插件桥接、外部工具接入 | 执行统一挂到 Execution Runtime，带风险分级和日志。 |
| Phase 3+ | 长期连续、可恢复、可增长 | 仅把外部 memory / DB / RAG 当后端能力 | Context Runtime 继续是唯一上下文装配中枢。 |

## 7. 最后给你的操作性答案

- 能抄，而且应该抄；但抄的是 AIRI / `proj-airi` 的“部件能力”，不是“世界观”。
- GreyWind 的世界观已经在现有文档里定得很清楚：Thread 是长期身份线，Session 是活跃窗口，Task 是执行单元，Context Runtime 是连续人格引擎。外部项目只能成为这些结构上的器官。
- 最稳妥的实践句式是：“把某项目的 X 模块，接到 GreyWind 的 Y 接口下”，而不是“把 GreyWind 改造成某项目那样”。

## 附录 A：本文判断依据

- GreyWind 内部文档：`architecture-v2.md`、`greywind-implementation-spec.md`、`spine-now.md`、`context-runtime.md`。
- Project AIRI 官方仓库 README：项目定位、子项目清单、多端与插件化路线。
- Project AIRI 官方文档概览：当前处于活跃早期开发阶段，网页端偏基础、客户端更适合高级操作。
- 第三方架构索引（DeepWiki 对 GitHub 源码的整理）：多端共用 stage-ui、中央 WebSocket server、chat orchestrator、plugin / server-runtime 等。
