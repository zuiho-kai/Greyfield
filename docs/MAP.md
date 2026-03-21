# GreyWind 文档 Map

## 0. 这份 Map 是干什么的

这个仓库当前不是代码仓库，而是文档仓库。

问题不在于文档少，而在于：

- 主文档和参考文档混在一起
- 历史版本还留在同一层级里
- 有重复文件
- 新人不知道该先读哪篇

这份 `MAP.md` 用来解决“从哪里开始看、每篇文档负责什么、哪些先别看”。

---

## 1. 当前目录地图

```text
docs/
├── MAP.md                              # 这份地图：怎么读、怎么找
├── INDEX.md                            # 扁平索引：文档状态、角色、建议
├── spine-now.md                        # 当前冻结的最小 Spine
├── greywind-implementation-spec.md     # 当前可执行规格
├── architecture-v2.md                  # 系统中轴：Context Runtime / Session / Thread / Task
├── context-runtime.md                  # 上下文运行时设计
├── engineering-lessons.md              # 错题本体系入口
├── worktree-workflow.md                # Worktree 工作流规范
├── worktree-log.md                     # Worktree 跟踪记录表
├── rules/                              # 通用硬规则（按任务类型分文件）
│   ├── tool-write.md                  # 工具与写入
│   ├── code-quality.md                # 代码质量
│   ├── flow-interact.md               # 流程与交互
│   ├── debug-fix.md                   # 调试与修复
│   ├── git-cr.md                      # Git / Worktree / CR
│   └── network.md                     # 网络与抓取
├── competitor-analysis-my-neuro.md     # 竞品分析：my-neuro
├── design/
│   └── module-c-browser/
│       ├── design.md                  # Module C 浏览器操控设计文档
│       └── mini-sr.md                 # Module C Mini SR（验收清单）
├── error-books/
│   ├── _index.md                      # 速查索引（每次必读）
│   ├── flow-rules.md                  # 流程子文件索引（每次必读）
│   ├── flow-gate.md                   # 门控/流程执行
│   ├── flow-code-habit.md             # 代码修改习惯
│   ├── flow-design.md                 # 设计阶段
│   ├── tool-rules.md                  # 工具使用
│   ├── interface-rules.md             # 接口协作
│   └── common-mistakes.md             # 跨角色通用错误
├── archive/
│   ├── ai-assistant-architecture.md    # 更早的远景架构参考
│   ├── greywind-airi-borrowing-strategy.md
│   ├── greywind-airi-borrowing-strategy.docx
│   └── remote-chat-realtime-voice-notes.md
└── 历史文档/
    ├── greywind-spec.md
    ├── greywind-spec-v2.md
    ├── greywind-spec-v3.md
    ├── greywind-spec-final.md
    ├── minimal-spine-plan.md
    ├── 推进经验.md
    ├── early-system-architecture.md
    ├── growth-spec-draft.md
    └── GrayWind Personal Assistant.md
```

---

## 2. 主文档分工

### `spine-now.md`

这是当前阶段最重要的文档。

它负责回答：

- 现在只做什么
- 现在明确不做什么
- 当前冻结的语音与最小连续性 Spine 是什么

如果一项能力不在这里，默认不要提前做。

### `greywind-implementation-spec.md`

这是当前最接近“可执行开发规格”的主文档。

它负责回答：

- 现阶段工程怎么搭
- Spine 和后续 Module 怎么推进
- 目录结构、配置、消息协议、实施步骤是什么

如果要真正开始落代码，这篇是主施工文档。

### `architecture-v2.md`

这是系统级方向文档。

它负责回答：

- GreyWind 的真正中轴是什么
- 为什么不是“普通 agent + memory”
- Persona / Session / Task 三条轴如何建立

它不是当前施工清单，但决定了系统不会长歪。

### `context-runtime.md`

这是 `architecture-v2.md` 的核心展开。

它负责回答：

- 每一轮响应前到底该装配哪些上下文
- thread / session / handoff / original intent 怎么进入 prompt
- Context Packet 应该长什么样

这篇是 GreyWind 长期连续性的技术基座文档。

### `design/`

Module 设计文档目录。每个新 Module 在进入实现前，设计文档落盘在这里。

它负责回答：

- 该 Module 的愿景对齐、架构卡位、最小可用定义
- 竞品参考、技术选型、验收标准
- 与现有模块的交互点和文件变更清单

当前包含：

- `module-c-browser/` — 浏览器操控（Execution Runtime 第一个 provider）
- `module-d-desktop/` — 桌面操控（PyAutoGUI provider）
- `module-e-hive/` — 虫巢系统（多 Agent 进化调度）
  - `design.md` — 泰伦虫族式架构设计（v1.2，整合顾问 v1+v2）
  - `mini-sr.md` — 验收标准
  - `gpt-des.md` — 顾问详细规格（v1）
  - `gpt-design_v2.md` — 顾问更新规格（v2，主干频道+条件赛马+愿景分身）

---

## 2.5 设计来源谱系

GreyWind 不是凭空长出来的。

早期历史稿里有一条比较清楚的来源谱系，这条信息仍然有价值，但过去没有显式保留在首层文档里。现在补在这里。

### 主要影响来源

| 来源 | 主要吸收点 | 当前落点 |
|------|------|------|
| `Neuro` | 桌面 AI、Live2D、多模态陪伴感 | Persona Shell、桌面存在感、语音交互 |
| `Cat Cafe` | 任务频道化、过程可视化 | Task Channel、worklog / artifact 可视化 |
| `Autoresearch` | Agent 行为协议、任务推进秩序 | Decision Runtime、任务推进边界 |
| `OpenClaw` | Gateway / control plane、分层记忆思路 | Context Runtime、分层上下文装配 |
| `Open-LLM-VTuber` | 可搬运的语音与 Live2D 引擎层 | `greywind-implementation-spec.md` 的引擎搬运策略 |
| `AIRI / proj-airi` | 多端交互、实时语音、插件与接入层 | `archive/greywind-airi-borrowing-strategy.md` |

### 使用方式

这些来源是“影响来源”，不是“继承模板”。

也就是说：

- 可以吸收它们的长处
- 不能让它们替代 GreyWind 的中轴
- 真正的系统脊椎仍以 `architecture-v2.md` 和 `context-runtime.md` 为准

---

## 3. 建议阅读顺序

### 如果你要“现在就开始做”

1. `spine-now.md`
2. `greywind-implementation-spec.md`
3. `architecture-v2.md`
4. `context-runtime.md`

### 如果你要“判断系统方向对不对”

1. `architecture-v2.md`
2. `context-runtime.md`
3. `spine-now.md`

### 如果你要“判断语音 realtime / 本地 Qwen 怎么接”

1. `spine-now.md`
2. `archive/remote-chat-realtime-voice-notes.md`
3. `greywind-implementation-spec.md`

### 如果你要“看远景，但不想污染当前 Spine”

1. `archive/ai-assistant-architecture.md`
2. `architecture-v2.md`

---

## 4. 当前分类规则

### A. 当前有效主文档

只包含：

- `spine-now.md`
- `greywind-implementation-spec.md`
- `architecture-v2.md`
- `context-runtime.md`

这四篇共同构成“当前有效文档层”。

### B. 参考归档

只在需要时回查：

- `archive/ai-assistant-architecture.md`
- `archive/remote-chat-realtime-voice-notes.md`
- `archive/greywind-airi-borrowing-strategy.md`
- `archive/greywind-airi-borrowing-strategy.docx`

这些文档不能覆盖当前 Spine，只能提供判断素材。

### C. 历史版本

统一放在 `历史文档/`。

用途只有两个：

- 回看演化路径
- 找丢掉但仍有价值的旧想法

默认不要把历史版本当当前规格。

### D. 重复/占位文件

`engineering-lessons.md` 是错题本体系的入口文件，指向 `error-books/` 目录下的各子文件。

错题本体系从 bot_civ 项目复用通用条目，按模块拆分，用于在开发过程中避免重复踩坑。

---

## 4.5 历史层里仍有价值但未升格到主文档的内容

历史层不是纯废稿。

有几类内容现在仍然有参考价值，但还没有正式升格进当前主文档层：

### A. 设计来源谱系

主要见：

- `历史文档/early-system-architecture.md`
- `历史文档/GrayWind Personal Assistant.md`

价值：

- 解释 GreyWind 最初受哪些项目影响
- 帮助理解“为什么会有频道、蜂巢、Gateway”这些词

### B. 未来 Agent 权限模型细粒度定义

主要见：

- `archive/ai-assistant-architecture.md`

价值：

- 给后续 Agent 注册表和权限系统提供占位
- 补充当前只有 `R0-R3` 风险分级、还没有 `L1-L5` Agent 权限级别的空白

### C. 更细的页面结构和交互颗粒度

主要见：

- `archive/ai-assistant-architecture.md`
- `历史文档/greywind-spec.md`

价值：

- 帮助未来做 Dashboard / Channel / DecisionPoint 等页面时回看
- 不影响当前 Spine，但能减少以后重想一遍 UI 的成本

### D. 更强的“工作群 / 任务频道”类比表达

主要见：

- `历史文档/early-system-architecture.md`

价值：

- 适合对人解释系统直觉
- 但当前主文档已经用更严格的说法替代：频道是工作面板，不是真相本体

### E. 某些表现层小细节

主要见：

- `archive/ai-assistant-architecture.md`

例如：

- Live2D 口型驱动方式
- 更细的桌面端状态播报表达
- 审批点组件粒度

这些都不是当前首层主文档必须保留的内容，但也没有必要忘掉。

---

## 5. 使用规则

### 规则 1

要做当前实现，优先以 `spine-now.md` 和 `greywind-implementation-spec.md` 为准。

### 规则 2

要讨论系统中轴，优先以 `architecture-v2.md` 和 `context-runtime.md` 为准。

### 规则 3

`archive/` 里的内容默认不具备“当前生效”地位。

### 规则 4

`历史文档/` 里的内容默认只做考古，不做现行规范。

### 规则 5

以后新增文档时，先决定它属于：

- 当前主文档
- 参考归档
- 历史版本
- 占位说明

所有文档统一放在 `docs/` 目录下，不要混放在根目录。

### 规则 6

当前文档体系支持“愿景开发模式”。

含义是：

- 长期愿景由首层主文档明确保存
- 当前实现边界由 `spine-now.md` 冻结
- 参考归档可以提供未来方向，但不能反过来绑架当前 Spine

如果你在写新文档，最好先判断它是在做哪一件事：

- 描述长期愿景
- 约束当前 Spine
- 记录参考判断
- 存档历史演化

---

## 6. 一句话总结

现在的主线很简单：

`spine-now.md` 定边界，`greywind-implementation-spec.md` 定施工，`architecture-v2.md` 定中轴，`context-runtime.md` 定连续性。

而这四篇合起来，支持的正是：**愿景先钉住，Spine 先活起来，模块再逐步长出来。**
