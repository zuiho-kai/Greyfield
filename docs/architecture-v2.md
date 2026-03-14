# 灰风（GreyWind）— 架构 v2

## 0. 这版为什么重写

### v1 的中心

v1 的系统核心是：
- **Persona** - 人格
- **Conductor** - 指挥
- **Hive** - 蜂巢
- **Tasks** - 任务
- **Memory** - 记忆

这回答了"系统由哪些器官组成"的问题。

### v1 的缺失

但它没有把以下内容提升到系统中轴：
- thread（线程）
- session（会话）
- handoff（交接）
- original intent（原始意图）
- context assembly（上下文装配）

对于一个会**长期陪伴、持续执行任务、跨多次会话延续状态**的 AI 助手来说，真正的中轴不是 agent 本身，而是 **context runtime**（上下文运行时）。

### v2 的目标

**把灰风从"模块化 agent 系统"升级为"线程感知/会话感知/交接感知的人格系统"。**

### v2 的开发姿态

v2 同时支持一种明确的方法论：

> **愿景开发模式：长期愿景先钉住，但当前实现只冻结必要 Spine。**

这意味着：

- 可以先明确 GreyWind 最终想成为什么
- 但不会因为远景完整，就要求当前版本一次做完
- 愿景负责决定系统不会长歪
- Spine 负责决定当前版本不会做炸

所以 v2 不是“纯远景文档”，也不是“只管当前能跑”的 MVP 文档。

它的作用是：

- 给当前开发提供长期方向
- 给未来模块生长提供结构约束
- 保护 original intent，不让系统退化回普通聊天壳

---

## 1. 新版一句话定义

> **灰风不是一个带记忆的 agent。灰风是一个在 thread 和 session 链上持续存在的人格体。**

### 对外
- 桌面常驻的 Live2D 人格助手

### 对内
- 通过 Context Runtime 维持身份、意图、上下文、交接链和任务连续性

---

## 2. v2 的设计目标

v2 重点解决五个问题：

| 问题 | 说明 |
|------|------|
| **会话与人格的分离** | session 会结束，但灰风不能失忆 |
| **任务的线程化** | 任务不再只是卡片，而是在 thread 上的执行单元 |
| **原始意图的保护** | 防止被 AC / 子任务压扁 |
| **结构化记忆** | 注入要有槽位和优先级，不是全塞 prompt |
| **会话链式交接** | 旧 session 存档，新 session 接棒 |

---

## 3. v2 的三条中轴

灰风系统不再只按模块划分，而按三条中轴理解：

### 3.1 人格轴（Persona Axis）

**负责回答：** "我是谁，我该怎么说话，我和用户是什么关系？"

**包含内容：**
- 角色设定
- 说话风格
- 稳定行为边界
- 长期偏好
- 皮套表现层

### 3.2 会话轴（Session Axis）

**负责回答：** "我现在在哪条线里继续存在？"

**包含内容：**
- current thread（当前线程）
- current session（当前会话）
- previous session handoff（前代会话交接）
- recent dialogue（最近对话）
- current screen context（当前屏幕上下文）
- interruption / resume point（中断/恢复点）

### 3.3 任务轴（Task Axis）

**负责回答：** "我正在推进什么目标？"

**包含内容：**
- original intent（原始意图）
- vision / done-when（愿景/完成标准）
- plan（计划）
- subtasks（子任务）
- worklog（工作日志）
- artifacts（产物）
- approvals（审批）

---

## 4. 顶层架构

```
                    用户
                     │
                     ▼
         GrayWind Persona Shell
   (Live2D / STT / TTS / 表情 / 插话)
                     │
                     ▼
              Context Runtime
        ├─ Persona Loader
        ├─ Vision / Intent Loader
        ├─ Thread Resolver
        ├─ Session Manager
        ├─ Handoff Manager
        ├─ Retrieval Engine
        └─ Prompt Assembler
                     │
                     ▼
            Decision Runtime
        ├─ Persona Agent（Spine 阶段）
        ├─ Conductor（后续长出）
        └─ Hive Workers（后续长出）
                     │
                     ▼
           Execution Runtime
        ├─ Browser Tools
        ├─ Desktop Tools
        ├─ Screen Awareness
        ├─ File / Shell
        └─ Scheduler
                     │
                     ▼
            Persistence Layer
        ├─ Thread Store
        ├─ Session Store
        ├─ Task Store
        ├─ Memory Store
        └─ Artifact Store
```

---

## 5. 各层职责

### 5.1 Persona Shell（人格外壳）

这是灰风的"外显人格"。

**职责：**
- Live2D 展示
- 语音输入输出
- 口型与表情
- 状态提示
- 桌面陪伴感
- 接收文本/语音输入
- 接收后台汇报并对外表达

**特点：**
- ❌ 不拥有任务真相
- ❌ 不拥有完整记忆真相
- ✓ 是唯一对用户暴露的脸

### 5.2 Context Runtime（上下文运行时）

这是 v2 的**真正核心**。

**职责不是"查记忆"，而是：**
1. 识别当前 thread
2. 识别当前 session
3. 识别要延续哪条上下文链
4. 加载原始意图
5. 获取上一代 handoff
6. 检索相关历史
7. 拼装本轮 prompt

**关键点：** Prompt 不直接来自 memory store，而是来自 Context Runtime。

### 5.3 Decision Runtime（决策运行时）

这是"思考层"。

**Spine 阶段：**
- 只有 Persona Agent

**后续阶段：**
- 长出 Conductor
- 再长出 Hive

**职责：**
- 理解用户请求
- 规划
- 推理
- 调度
- 选择是否调用工具
- 汇报当前状态

### 5.3.1 未来 Agent 权限模型占位

当前 v2 不把完整 Agent 权限系统纳入 Spine。

但这里明确预留一个未来占位，避免后面长出多 Agent 时重新定义语义。

后续如果长出 Agent 注册表，建议同时区分两套边界：

1. **Agent 权限级别**
2. **执行风险级别**

它们不是一回事。

#### A. Agent 权限级别

这是“某个 Agent 理论上被允许做什么”。

可以沿用一个未来占位模型：

- `L1` 只读：查看文件、搜索信息、读取状态
- `L2` 生成：生成内容、写入沙盒、整理产物
- `L3` 执行：运行代码、调用外部 API、触发工具
- `L4` 操控：操作电脑、浏览器、桌面程序
- `L5` 管理：创建/修改其他 Agent 配置与系统级策略

#### B. 执行风险级别

这是“某次具体动作有多危险”。

当前实现已经采用：

- `R0-R3`

这个定义保留在 `greywind-implementation-spec.md`。

#### C. 为什么要分开

因为：

- 一个 `L4` Agent 不代表它的每次动作都能自动执行
- 一个低风险动作也不代表任何 Agent 都有资格去做

所以未来正确的组合应该是：

> Agent 先受 `L1-L5` 权限边界约束，再受单次动作的 `R0-R3` 风险边界约束。

这部分当前只是占位，不代表现在就要实现完整 Agent Registry。

### 5.4 Execution Runtime（执行运行时）

这是"动手层"。

**职责：**
- 浏览器自动化
- 桌面操作
- 屏幕理解
- 文件与脚本执行
- 定时任务与后台事件

**设计原则：**
- 高频实时控制尽量本地化
- 大模型只负责高层理解和规划
- 工具执行要带风险分级和日志

### 5.5 Persistence Layer（持久化层）

这是系统真相层。

**职责：**
- 保存 thread
- 保存 session
- 保存 handoff
- 保存任务记录
- 保存长期记忆
- 保存工件和日志

---

## 6. Thread / Session / Task 的关系

这是 v2 必须钉死的概念。

### 6.1 Thread（线程）

**定义：** 线程是长期身份线。

**例子：**
- 灰风系统架构设计
- 浏览器自动化方案
- 陪我看视频
- 灰风人格调教

**特点：**
- ✓ 长期存在
- ✓ 可以跨多次启动
- ✓ 可以有多个 session
- ✓ 是上下文归属单位

### 6.2 Session（会话）

**定义：** 会话是一次活跃运行。

**例子：**
- 今天下午这一轮对话
- 这次打开桌宠后进行的连续操作
- 这轮任务执行窗口

**特点：**
- ⏱ 会结束
- ⏸ 会被中断
- 🔄 会切换
- 📋 结束后需要 handoff 给下一代 session

### 6.3 Task（任务）

**定义：** 任务是具体推进单元。

**特点：**
- 可以挂在某个 thread 下
- 可以有状态
- 可以拆子任务
- 可以产生 worklog 和 artifacts

### 6.4 三者关系

```
Thread
 ├─ Session A
 │   ├─ Task 1
 │   └─ Task 2
 ├─ Session B
 │   └─ Task 3
 └─ Session C
     └─ Task 4
```

**结论：**
- **thread** = 连续身份
- **session** = 活跃窗口
- **task** = 执行单元

---

## 7. Context Runtime 详细设计

### 7.1 输入

每轮装配上下文时，Context Runtime 读取：

- 用户当前输入
- 当前 thread id
- 当前 session id
- 当前 task id（如果有）
- 当前屏幕状态
- 最近对话
- 最近动作
- 过去 handoff
- 检索结果

### 7.2 输出

输出一个结构化的上下文包：

```typescript
type ContextPacket = {
  persona: PersonaSlot
  vision: VisionSlot
  thread: ThreadSlot
  session: SessionSlot
  handoff: HandoffSlot | null
  retrieved: RetrievedMemorySlot[]
  user_input: string
}
```

### 7.3 Prompt 槽位设计

| 槽位 | 内容 | 目的 |
|------|------|------|
| **Slot 1：Persona** | 灰风是谁、语气风格、用户关系、稳定边界、稳定偏好 | 保证人格一致性 |
| **Slot 2：Vision/Intent** | 这条 thread/task 最初要达到什么、done-when、用户真正关心什么 | 防止需求被压扁 |
| **Slot 3：Thread Identity** | 当前 thread 是什么、历史背景、长期话题 | 防止跨 thread 污染 |
| **Slot 4：Session Context** | 最近 N 轮对话、最近动作、屏幕摘要、当前状态 | 知道"刚进行到哪" |
| **Slot 5：Handoff Digest** | 上一代 session 摘要、未完成事项、风险点 | 构造 session chain |
| **Slot 6：Retrieved Memory** | 检索出的长期记忆、历史片段、SOP/lessons | 只注入相关记忆 |
| **Slot 7：User Input** | 当前这轮输入 | 当前请求 |

---

## 8. 记忆系统 v2

v2 不再只分"短期/长期"，而分成**五类**：

### 8.1 Identity Memory
保存：
- 角色设定
- 稳定偏好
- 关系设定
- 长期风格

### 8.2 Thread Memory
保存：
- 该 thread 的背景
- 关键决策
- 历史结论
- thread 内约定

### 8.3 Session Memory
保存：
- 最近对话
- 最近动作
- 当前屏幕摘要
- 当前状态与中断点

### 8.4 Handoff Memory
保存：
- 从旧 session 交给新 session 的摘要
- 未完成点
- 当前风险
- 推荐恢复路径

### 8.5 Retrieved Memory
保存方式不限，但用途明确：

**用途：** 作为被召回的上下文片段注入 prompt

**来源：**
- SQLite
- 向量库
- 历史 transcript
- lessons / SOP

---

## 9. Session Chain 机制

### 9.1 为什么需要

因为 **session 会死**。但灰风的**人格连续性不能死**。

### 9.2 生命周期

```
Session Start
    ↓
  确定 thread
  读取 persona
  读取 vision
  读取最近 handoff
  启动新 session
    ↓
Session Running
    ↓
  累积 recent dialogue
  写入 current state
  记录关键动作
  维护 screen context
    ↓
Session Close
    ↓
  完整 transcript 存档
  写 handoff digest
  标记 session 完成/中断/等待恢复
    ↓
Next Session Resume
    ↓
  读取上一代 handoff
  必要时检索旧 transcript
  组装新的 context packet
```

---

## 10. 任务频道 v2

频道依然保留，但重新定义：

> **频道不是上下文本体，频道是 thread 的可视化工作面板。**

### 10.1 一个频道包含

- 当前 thread 信息
- 当前 session 信息
- tasks
- worklog
- artifacts
- decisions
- lessons
- research

### 10.2 频道的作用

- 📊 审计
- 📈 追踪
- 🔊 插话
- 🎛 干预
- 🔙 回看
- 💾 沉淀知识

---

## 11. Spine v2

### 11.1 与 v1 的区别

v1 Spine 只要求"灰风能说话"。

**v2 Spine 还要包含最小的 session/thread 意识。**

### 11.2 Spine v2 必须包含

- ✓ Live2D
- ✓ STT
- ✓ LLM
- ✓ TTS
- ✓ 最近对话上下文
- ✓ memory.json
- ✓ 基础 thread_id
- ✓ 基础 session_id
- ✓ 最小 Context Assembler

### 11.3 Spine v2 不包含

- ❌ 多 Agent
- ❌ Hive
- ❌ 独立 Conductor
- ❌ SQLite 记忆
- ❌ Web 任务看板
- ❌ 向量检索
- ❌ 复杂 task engine

---

## 12. 生长路线

| 阶段 | 目标 | 关键组件 |
|------|------|---------|
| **Phase 0** | 活起来 | Persona Shell、基础 Context Assembler、最近对话、memory.json、thread/session 标识 |
| **Phase 1** | 会看 | Screen Awareness、窗口识别、定时截屏+差异检测、屏幕摘要、主动播报 |
| **Phase 2** | 会做 | Browser tools、风险分级、操作日志 |
| **Phase 3** | 有任务 | Task Store、任务状态机、thread/task 绑定 |
| **Phase 4** | 会交接 | Handoff Manager、Session Chain、Resume/Recovery |
| **Phase 5** | 主控分离 | Persona 和 Conductor 解耦 |
| **Phase 6** | 长出蜂巢 | Operator / Researcher / Reviewer / Reporter |
| **Phase 7** | 长期记忆 | SQLite、向量检索、SOP/lessons |

---

## 13. 当前目录建议（v2 视角）

```
src/greywind/
├── persona/
│   └── ...
├── context_runtime/
│   ├── persona_loader.py
│   ├── vision_loader.py
│   ├── thread_resolver.py
│   ├── session_manager.py
│   ├── handoff_manager.py
│   ├── retrieval_engine.py
│   └── prompt_assembler.py
├── decision_runtime/
│   ├── persona_agent.py
│   ├── conductor.py
│   └── hive/
│       └── ...
├── tasks/
│   └── ...
├── memory/
│   └── ...
├── execution/
│   └── ...
├── server/
│   └── ...
└── storage/
    └── ...
```

### 说明

**关键变化：**
- `context_runtime/` 在 v2 中是**一等公民**
- `decision_runtime/` 不再是唯一中心

---

## 14. 核心原则

### 14.1 灰风的连续性来自 Thread 和 Session Chain

❌ 不是来自单次上下文窗口

✓ 是来自跨 session 的链式结构

### 14.2 原始意图优先于衍生验收标准

❌ 不要让需求被压成只剩 AC

✓ 保护用户的真实目的

### 14.3 上下文装配优先于记忆堆砌

❌ 不是塞得越多越好

✓ 而是结构越清楚越好

### 14.4 Session 会结束，但人格不能断

❌ Handoff 不是锦上添花

✓ Handoff 是基础设施

### 14.5 频道是工作面板，不是真相本体

❌ 不是唯一的信息来源

✓ 真相在 thread/session/task/artifact 存储中

---

## 15. 总结

### 一句话结论

> v2 的灰风，不再只是"皮套 + 大脑 + 蜂巢"。
>
> 它首先是一个**能在 thread 和 session 链上持续存在的上下文人格系统**。

### 核心创新

1. **从模块思维到链式思维** - 不是独立模块的组合，而是有时间轴的连续体
2. **从记忆堆砌到上下文装配** - 有槽位、有优先级、有结构
3. **从会话隔离到会话链接** - handoff 是基础，session chain 是主体
4. **从单次任务到长期线程** - thread 是真正的组织单位
5. **从皮套 agent 到人格系统** - 人格在 thread 上连续存在

---
