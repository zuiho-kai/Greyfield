# 灰风（GreyWind）— Context Runtime 设计文档

## 0. 文档目的

本文档定义灰风系统里最关键的运行时：**Context Runtime**

它负责解决一个核心问题：

> 在每一轮响应前，灰风到底应该带着什么身份、什么上下文、什么任务状态、什么交接信息去思考。

**这不是单纯的"记忆检索"模块。**  
**它是灰风人格连续性的基础设施。**

---

## 1. 为什么需要 Context Runtime

如果没有 Context Runtime，灰风会退化成一个普通聊天壳：

- 只能记得最近几轮
- 任务切换时容易串线
- 不知道当前属于哪条长期线程
- 重启后很难自然续接
- 原始意图容易丢
- 长期记忆会变成"全塞 or 全忘"

### 1.1 维持人格连续性

灰风不是每轮重生一次。它要表现为一个持续存在的人格体。

### 1.2 维持线程边界

不同 thread 不能串线。"陪我看视频"和"设计灰风架构"不能互相污染。

### 1.3 维持会话延续

session 会结束，但下一次应该能接上。

### 1.4 维持原始意图

不能只剩派生任务和 AC，忘了用户最初想要什么。

### 1.5 控制注入成本

不是所有记忆都该进 prompt。上下文必须经过选择和装配。

---

## 2. Context Runtime 的职责边界

### Context Runtime 负责：

- 识别当前 thread
- 管理当前 session
- 读取上一代 handoff
- 加载 persona
- 加载 original intent / vision
- 组装最近上下文
- 检索相关长期记忆
- 输出本轮 prompt 输入包

### Context Runtime 不负责：

- 最终推理
- 工具执行
- 任务调度
- UI 渲染
- 长期存储实现细节

**简言之：**

> 它负责"准备大脑该看到什么"
> 
> 不负责"大脑最后怎么想"

---

## 3. 核心概念

### 3.1 Persona

**回答：** "灰风是谁？"

**包括：**

- 角色设定
- 风格
- 行为边界
- 与用户关系
- 稳定偏好

### 3.2 Thread

**回答：** "当前输入属于哪条长期连续线？"

thread 是长期归属单位，比 session 更稳定。

**例子：**

- 灰风架构设计
- 陪我看视频
- 浏览器自动化实验
- 灰风人格调整

### 3.3 Session

**回答：** "当前活跃窗口是哪一次运行？"

session 是一次活着的过程，它会开始、暂停、结束、切换。

### 3.4 Task

**回答：** "当前正在推进的执行单元是什么？"

task 可以挂在 thread 下，一个 thread 可以有多个 task。

### 3.5 Handoff

**回答：** "上一代 session 临走前，需要交给下一代什么？"

handoff 不是完整 transcript，而是：

- 当前进度摘要
- 未完成事项
- 当前风险
- 恢复建议

### 3.6 Retrieved Memory

**回答：** "过去哪些内容和当前最相关？"

来源可以是：

- 长期记忆
- 历史 task
- 历史 transcript
- SOP / lessons / decisions

### 3.7 Vision / Original Intent

**回答：** "用户最初真正想要的是什么？"

这一层用于防止任务执行过程中只剩派生步骤和形式化验收标准。

---

## 4. 顶层运行流程

每轮输入到来时，Context Runtime 的流程是：

```
输入到达
  ↓
识别 thread
  ↓
识别 / 创建 session
  ↓
加载 persona
  ↓
加载 thread 的 original intent / vision
  ↓
读取当前 session 上下文
  ↓
读取上一代 handoff（如有）
  ↓
检索相关长期记忆 / 历史片段
  ↓
组装 Context Packet
  ↓
交给 Decision Runtime
```

---

## 5. Context Packet 结构

Context Runtime 最终产出一个统一对象：

```typescript
type ContextPacket = {
  persona: PersonaSlot
  vision: VisionSlot | null
  thread: ThreadSlot
  session: SessionSlot
  handoff: HandoffSlot | null
  retrieved: RetrievedSlot[]
  user_input: UserInputSlot
}
```

---

## 6. 各 Slot 详细定义

### 6.1 PersonaSlot

**作用：** 定义灰风的稳定人格边界。

**内容：**

- name
- role
- speaking_style
- behavior_rules
- relationship_to_user
- stable_preferences

**示例：**

```json
{
  "name": "灰风",
  "role": "高效的个人AI助手",
  "speaking_style": "简洁直接，不废话",
  "behavior_rules": [
    "优先说明当前判断",
    "不虚构已完成的操作",
    "必要时明确风险"
  ],
  "relationship_to_user": "长期陪伴与执行型个人助手",
  "stable_preferences": [
    "优先保持连续上下文",
    "先解决当前任务再扩展"
  ]
}
```

**备注：**

PersonaSlot 通常属于固定注入，不需要每轮检索。

---

### 6.2 VisionSlot

**作用：** 保存原始目标，而不是后续压缩版本。

**内容：**

- origin_goal
- done_when
- non_goals
- user_priorities
- quality_bar

**示例：**

```json
{
  "origin_goal": "把灰风做成一个真正可持续生长的个人助手，而不是一次性拼装品",
  "done_when": [
    "可以自然对话",
    "可以理解当前工作上下文",
    "能逐步长出任务能力"
  ],
  "non_goals": [
    "首版不追求完整蜂巢",
    "首版不追求复杂向量系统"
  ],
  "user_priorities": [
    "生长式设计",
    "连续人格感",
    "MVP先活起来"
  ],
  "quality_bar": "不是功能堆砌，而是能稳定演化"
}
```

**备注：**

VisionSlot 可以来自：

- thread 创建时的原始描述
- 任务 brief
- 人工维护的 thread note

---

### 6.3 ThreadSlot

**作用：** 定义当前归属线。

**内容：**

- thread_id
- thread_title
- thread_type
- thread_summary
- linked_task_ids
- thread_tags

**示例：**

```json
{
  "thread_id": "thread_arch_greywind",
  "thread_title": "灰风系统架构设计",
  "thread_type": "design",
  "thread_summary": "围绕灰风的整体系统架构、生长式设计、上下文运行时展开",
  "linked_task_ids": ["task_arch_v2_doc"],
  "thread_tags": ["architecture", "context-runtime", "growth"]
}
```

**备注：**

ThreadSlot 是防串线的第一道墙。

---

### 6.4 SessionSlot

**作用：** 定义当前活跃窗口中的即时上下文。

**内容：**

- session_id
- state
- recent_dialogue
- recent_actions
- screen_context
- interruptions
- resume_point

**示例：**

```json
{
  "session_id": "sess_20260311_01",
  "state": "active",
  "recent_dialogue": [
    "用户要求重写 architecture v2",
    "系统已生成 architecture-v2.md",
    "用户要求继续写 context-runtime.md"
  ],
  "recent_actions": [
    "生成 architecture-v2 文档草案"
  ],
  "screen_context": {
    "app": "ChatGPT",
    "mode": "writing",
    "summary": "正在继续输出架构文档"
  },
  "interruptions": [],
  "resume_point": "继续完善 Context Runtime 的数据结构与生命周期"
}
```

**备注：**

SessionSlot 是最短期、变化最快的一层。

---

### 6.5 HandoffSlot

**作用：** 把上一代 session 的关键状态交给下一代。

**内容：**

- from_session_id
- to_session_id
- summary
- unfinished_items
- risks
- resume_suggestion

**示例：**

```json
{
  "from_session_id": "sess_20260310_02",
  "to_session_id": "sess_20260311_01",
  "summary": "已完成 architecture-v2 主体，下一步需展开 context-runtime 设计",
  "unfinished_items": [
    "定义 slot 结构",
    "定义 session lifecycle",
    "定义 retrieval 策略"
  ],
  "risks": [
    "不要退回纯记忆注入思路",
    "不要忽略 thread/session 区分"
  ],
  "resume_suggestion": "优先完成 context-runtime.md"
}
```

**备注：**

HandoffSlot 不应由濒死 session 粗暴压缩所有历史。它只应该交接"继续工作真正需要的最小信息"。

---

### 6.6 RetrievedSlot

**作用：** 承载检索出来的相关历史片段。

**内容：**

- source_type
- source_id
- relevance_reason
- content
- confidence

**示例：**

```json
{
  "source_type": "lesson",
  "source_id": "cat-cafe-08",
  "relevance_reason": "当前正在讨论 session 管理与 handoff",
  "content": "session 不等于 thread，本体应以 thread 隔离；上下文快满时应存档并通过新 session digest 接棒",
  "confidence": 0.92
}
```

**备注：**

RetrievedSlot 可以有多个，但必须限量，避免 prompt 爆炸。

---

### 6.7 UserInputSlot

**作用：** 保存当前这轮输入的原始形式。

**内容：**

- raw_text
- input_type
- timestamp
- attached_context

**示例：**

```json
{
  "raw_text": "继续",
  "input_type": "text",
  "timestamp": "2026-03-11T14:10:00+09:00",
  "attached_context": null
}
```

---

## 7. Thread Resolver 设计

### 7.1 目标

判断当前输入属于哪个 thread。

### 7.2 输入

- 用户输入
- 当前活跃 UI 上下文
- 最近 session
- 最近任务
- 最近 thread 列表

### 7.3 输出

- 匹配现有 thread
- 或创建新 thread

### 7.4 基本策略

**优先级 1：显式绑定**

如果用户当前正在某个频道/任务页里说话，直接绑定该 thread。

**优先级 2：最近活跃 thread**

如果输入明显延续上一个话题，优先复用最近 thread。

**优先级 3：语义匹配**

根据标题、关键词、最近目标做轻量匹配。

**优先级 4：新建 thread**

如果都不匹配，新建 thread。

### 7.5 错误避免

避免以下情况：

- 闲聊误绑到任务 thread
- 不同长期主题共用同一 thread
- 重启后默认丢到"默认会话"

---

## 8. Session Manager 设计

### 8.1 目标

管理 session 的创建、活跃、关闭和续接。

### 8.2 状态

建议最小状态集：

| 状态 | 说明 |
|-----|------|
| active | 当前活跃 |
| idle | 闲置中 |
| interrupted | 被中断 |
| closed | 已关闭 |
| handoff_written | 已交接 |

### 8.3 生命周期

#### Create

**触发：**

- 新启动
- 新 thread
- 原 session 已关闭

**动作：**

- 创建 session_id
- 绑定 thread_id
- 初始化 recent dialogue
- 标记 active

#### Update

每轮输入/输出后：

- 写 recent dialogue
- 写 recent actions
- 更新 screen context
- 更新 resume point

#### Interrupt

**触发：**

- 用户中断
- 进程退出
- 工具执行被打断

**动作：**

- 写 interruption record
- 更新 resume point

#### Close

**触发：**

- 长时间 idle
- 人工结束
- 进程退出前清理

**动作：**

- 完整 transcript 存档
- 生成 handoff
- 标记 closed

---

## 9. Handoff Manager 设计

### 9.1 目标

让 session 可以死亡，但 thread 不失去连续性。

### 9.2 输入

- 即将关闭的 session
- 其 recent dialogue
- 当前 task 状态
- 当前 screen / tool 状态
- 当前未完成事项

### 9.3 输出

一份 handoff digest

### 9.4 设计原则

- 不追求完整压缩所有历史
- 只保留恢复需要的信息
- 重点写"下一步该干什么"
- 明确风险与不确定性

### 9.5 推荐格式

```json
{
  "summary": "...",
  "unfinished_items": ["..."],
  "risks": ["..."],
  "resume_suggestion": "..."
}
```

---

## 10. Retrieval Engine 设计

### 10.1 目标

从历史中挑选真正相关的片段，而不是把数据库抬进 prompt。

### 10.2 检索来源

- identity memory
- thread memory
- historical session archive
- task history
- decisions / lessons / SOP
- vector store（后期）

### 10.3 检索策略

#### 第一层：直接关联

优先取：

- 当前 thread 的历史片段
- 当前 task 的历史结论
- 最近 handoff

#### 第二层：结构化筛选

按：

- 类型
- 时间
- 优先级
- 标签

#### 第三层：语义检索

后期引入：

- embedding
- 向量召回
- rerank

### 10.4 限量原则

每轮最多注入少量高价值片段：

- 1 份 handoff
- 1 份 vision
- 2 到 5 条 retrieved memory

而不是无限堆叠。

---

## 11. Prompt Assembler 设计

### 11.1 目标

将 Context Packet 变成模型输入。

### 11.2 顺序原则

建议顺序：

```
Persona
  ↓
Vision
  ↓
Thread
  ↓
Session
  ↓
Handoff
  ↓
Retrieved Memories
  ↓
User Input
```

### 11.3 原则

- 稳定信息在前
- 当前状态在中间
- 检索片段限量
- 当前输入放最后

### 11.4 失败降级

如果某些槽位缺失：

- 没有 handoff 就跳过
- 没有 retrieved memory 就只用当前 session
- 没有 vision 时可退化成普通对话模式

---

## 12. 存储建议

### 12.1 Spine 阶段

```
memory.json
threads.json
sessions/ 目录下按文件存档
handoffs/ 目录下按文件存档
```

### 12.2 Module 阶段

迁移到 SQLite：

- threads
- sessions
- handoffs
- tasks
- memories
- artifacts

### 12.3 后期

- SQLite + 向量库
- transcript 单独归档
- 冷热分层存储

---

## 13. 推荐数据表（后期）

### threads

| 字段 | 说明 |
|-----|------|
| id | 主键 |
| title | 线程标题 |
| type | 类型 |
| summary | 摘要 |
| vision_json | Vision 数据 |
| created_at | 创建时间 |
| updated_at | 更新时间 |

### sessions

| 字段 | 说明 |
|-----|------|
| id | 主键 |
| thread_id | 所属 thread |
| state | 状态 |
| resume_point | 续接点 |
| started_at | 开始时间 |
| ended_at | 结束时间 |

### handoffs

| 字段 | 说明 |
|-----|------|
| id | 主键 |
| from_session_id | 来源 session |
| to_session_id | 目标 session |
| summary | 摘要 |
| unfinished_items_json | 未完成事项 |
| risks_json | 风险 |
| resume_suggestion | 恢复建议 |
| created_at | 创建时间 |

### memories

| 字段 | 说明 |
|-----|------|
| id | 主键 |
| scope_type | 作用域类型 (identity / thread / task / sop) |
| scope_id | 作用域 ID |
| memory_type | 记忆类型 |
| content | 内容 |
| importance | 重要程度 |
| created_at | 创建时间 |

---

## 14. 示例：一次真实运行

### 场景

你正在继续写灰风文档。

### Step 1

用户输入：`"继续"`

### Step 2

Thread Resolver 判断：

→ 当前属于 `thread_arch_greywind`

### Step 3

Session Manager 判断：

→ `sess_20260311_01` 仍 active

### Step 4

加载：

- PersonaSlot
- VisionSlot（灰风要做成生长式人格系统）
- ThreadSlot
- SessionSlot（刚写完 architecture-v2）
- HandoffSlot（昨天那轮留下"下一步写 context-runtime"）
- RetrievedSlot（session 管理与 context engineering 的 lessons）

### Step 5

Prompt Assembler 组装

### Step 6

Decision Runtime 输出：

→ 开始写 context-runtime.md

---

## 15. Spine 最小实现建议

Context Runtime 的最小版，不需要一次做全。

### v0

- PersonaSlot
- SessionSlot（最近对话）
- UserInputSlot

### v1

- 加 ThreadSlot
- 基础 thread_id

### v2

- 加 HandoffSlot
- 支持 resume

### v3

- 加 RetrievedSlot
- 支持 SQLite / 向量检索

这符合灰风的生长式原则：

> 先有脊椎，再长器官。

---

## 16. 核心原则总结

- **Prompt 不是记忆拼盘，而是上下文装配结果**

- **Thread 是长期归属，Session 是当前活跃窗口**

- **Handoff 是连续性的桥，而不是历史压缩包**

- **Vision / Original Intent 必须进入上下文，而不是只保存在需求文档里**

- **检索是选择相关历史，不是倾倒全部历史**

- **灰风的人格连续性来自 Context Runtime，而不来自单次大上下文窗口**

---

## 17. 一句话总结

**Context Runtime 是灰风真正的"连续人格引擎"。**

它决定灰风每次开口时，不只是"记得什么"，  
而是"知道自己是谁、现在在哪条线里、接下来该顺着哪条连续性说下去"。

---

## 下一步

如果你愿意，下一步继续把第三份也补出来：

### docs/thread-session-spec.md

专门写：

- thread / session / task 的状态机
- 创建规则
- 命名规则
- resume / merge / split 策略