# GreyWind / Greyfield 设计文档 v2

> 状态：Draft  
> Owner：Greyfield  
> 类型：Architecture / OS-level Design Spec  
> 目标：在保留单外壳、分层虫群与进化选择机制的前提下，正式引入主干频道交互协议、条件赛马机制、愿景监督分身，以及“小主脑复用优先、受控孵化”的生命周期模型。

---

## 1. 一句话定位

GreyWind 不应只是“单人格 + 内部多 Agent”的调度器，
而应进化为一个 **单外壳、分层虫群、条件赛马、可进化、面向未来 OS 底层的活体操作系统**。

对外，用户只与一个主干人格对话。  
对内，系统以虫巢社会的方式运行：

- 有等级
- 有分工
- 有受控竞争
- 有环境隔离
- 有晋升降级
- 有基因继承与淘汰

这份文档在既有 Module E / Hive Scheduler 规格之上，进一步冻结以下新增原则：

1. **主干频道协议（Single-Trunk Protocol）**
2. **复杂任务条件赛马（Conditional Trial Broods）**
3. **主脑分身裁判（Vision Arbiter / Dreamer Shadow）**
4. **小主脑复用优先、受控孵化（Reusable Submind Lifecycle）**
5. **进化大师（Evolution Master）**

### 1.1 术语与灵感映射

本系统的虫群治理模型融合了战锤 40K 泰伦虫族与星际争霸异虫的设计灵感。以下为核心术语映射：

| GreyWind 术语 | 泰伦虫族对应 | 星际争霸异虫对应 | 系统定位 |
|---|---|---|---|
| 系统人格外壳 Persona Shell | 虫巢意志 Hive Mind | — | 对外统一意识，用户只感知一个人格 |
| 主脑 Overmind | — | 主宰 Overmind | 线程级唯一主动权威，战略决策与调度 |
| 进化大师 Evolution Master | 诺恩后虫 Norn-Queen | 阿巴瑟 Abathur | 基因进化设计、策略优化，有受限独立意志 |
| 愿景分身 Vision Arbiter | 虫巢领主 Swarmlord | — | 愿景监督与赛马裁判，非第二主权 |
| 小主脑 Submind | 虫巢暴君 Hive Tyrant | 脑虫 Cerebrate | 领域级治理节点，接受主脑指挥 |
| 虫巢基地 Hive Base | 虫巢舰 Hive Ship | 孵化场 Hatchery | 独立执行环境，资源与状态隔离 |
| 宿主 Host | 节点生物 Synapse Creature | 王虫 Overlord | 工具/环境绑定，指令中继 |
| 单位 Unit | 虫巢武士 Warrior | 刺蛇 / 跳虫 | 任务执行单元 |
| 工蜂 Drone | 撕裂虫 Ripper | 工蜂 Drone | 基础资源采集与清理 |
| 灵能节点网络 Synapse Net | 灵能网络 Synapse Network | 心灵链接 Psionic Link | 指令传递与状态同步 |
| 进化层 Evolution Layer | 基因库 + 自然选择 | 进化深渊 Evolution Pit | 基因进化试验与淘汰 |
| 赛马机制 Trial Race | — | — | GreyWind 原创：条件并行竞争与择优收敛 |

**关键设计选择**：GreyWind 不是纯泰伦模型（无实体的完形灵能意识，所有个体无自我），也不是纯异虫模型（单主宰绝对控制，基因锁死忠诚）。它取泰伦的分层灵能节点网络作为治理骨架，取异虫的主宰 + 脑虫 + 阿巴瑟分工模型作为角色设计。进化大师借鉴了阿巴瑟的"受限独立意志"——在进化领域有自主判断权，但不能越权调度。竞争与进化机制（赛马、谱系淘汰）是 GreyWind 自己的设计。

---

## 2. 设计目标

### 2.1 主目标

1. 保持 GreyWind 对外始终只有一个人格与一个主干入口。
2. 让复杂任务具备并行试验与择优收敛能力，而不是被单一路径绑定。
3. 让竞争发生在隔离环境中，而不是发生在同一上下文里的抢权。
4. 让小主脑成为可复用的中层治理资产，而不是按任务随手创建的临时角色。
5. 让愿景监督与执行治理分离，减少“做得很快但做偏了”的风险。
6. 将优胜劣汰从“事后奖惩”升级为“执行中可触发的制度化选择”。
7. 保持现有 ContextPacket、BroodTask、Host、Handoff、Evolution Layer 等接口方向不被推翻。

### 2.2 非目标

当前阶段明确不是：

1. 完全去中心化的平权 Agent 社会
2. 任意任务默认全量并行赛马
3. 让多个主脑同时对用户发言
4. 无限制自我复制与自我改写
5. 以卡拉式全局一致性网络替代虫群治理骨架
6. 以“选举政治”替代等级审计与战功晋升

---

## 3. 核心设计原则

### 3.1 单外壳，内部虫群

GreyWind 必须继续保持 **one persona / one visible thread / one coherent working style**。

用户看到的应永远是：

- 一个主干频道
- 一个统一人格
- 一个连续的工作体验

内部可以有：

- 一个主脑（Overmind / 主宰）
- 一个进化大师（Evolution Master / 阿巴瑟）—— 有受限独立意志
- 多个小主脑（Subminds / 脑虫）
- 多个虫巢基地（Hive Bases / 孵化场）
- 多个宿主（Hosts / 王虫）
- 多个单位（Units）与工蜂（Drones）

但这些内部节点不能直接把用户体验变成“委员会对话”。

### 3.2 虫群是骨架，竞争是机制，不是噪音

GreyWind 的本体仍然是虫群：

- 等级明确
- 权威可审计
- 晋升可逆
- 失败可降级
- 劣势谱系可淘汰

竞争不是为了热闹，而是为了：

- 让更好的分解策略出现
- 让更低成本的执行链胜出
- 让更稳的恢复模式被继承
- 让低质量路径自然退出调度核心

### 3.3 竞争必须隔离，不能污染主线

赛马机制只有在 **环境隔离** 成立时才是升级。

禁止以下模式：

- 多个小主脑在同一工作环境中抢控制权
- 多个路径共写同一主线上下文
- 多个执行链共享脏状态，导致结果不可比较

允许的模式是：

- 每个候选小主脑在独立频道 / 独立 Hive Base / 独立 Host 环境中工作
- 所有候选分支共享同一目标约束，但不共享细粒度执行状态
- 由主脑统一收敛并选择结果

### 3.4 主脑负责治理，分身负责愿景监督

主脑本体负责：

- 接收主干命令
- 识别任务复杂度
- 决定是否赛马
- 选择小主脑
- 发出 BroodTask 包
- 做最终择优与收敛

主脑分身负责：

- 维护愿景与 done-when
- 解释需求边界
- 作为裁判比较多个小主脑产出
- 发现需求歧义并建议升级求证

主脑分身 **不是第二个调度权威**，也 **不能独立对外承诺需求**。

### 3.5 复用优先，新增受控

小主脑默认应被视为 **可复用治理资产**，而不是按任务一次性消耗品。

新增小主脑只在以下情况成立：

- 新领域第一次出现
- 复杂任务需要隔离赛马
- 现有小主脑明显过载或退化
- 出现值得验证的新谱系/新策略

新增的小主脑默认先进入 **试验态**，不直接成为常驻主力。

---

## 4. 系统模型（v2）

```text
Persona Shell（虫巢意志 / Hive Mind — 对外统一人格）
  -> Trunk Channel（主干频道）
    -> Context Runtime（上下文运行时）
      -> Overmind（主脑 / 主宰 — 线程级唯一权威）
        -> Evolution Master（进化大师 / 阿巴瑟 — 基因进化设计，有受限独立意志）
        -> Vision Arbiter（愿景分身 / 虫巢领主 — 监督裁判，非第二主权）
        -> Subminds（小主脑 / 脑虫 — 领域级治理节点）
          -> Hive Bases（虫巢基地 / 孵化场）
            -> Hosts（宿主 / 王虫 — 工具环境绑定）
              -> Units（单位 / 武士）
                -> Drones（工蜂 / 撕裂虫）

Evolution Layer（进化层 — 由进化大师主导）
  -> Gene Intake（基因摄入）
  -> Trial Broods（试验虫巢）
  -> Selection Engine（选择引擎）
  -> Genome Registry（基因组注册表）
  -> Extinction Ledger（灭绝账本）

Competition Layer（竞争层）
  -> Complexity Gate（复杂度门控）
  -> Candidate Submind Selection（候选小主脑选择）
  -> Isolated Trial Channels（隔离试验频道）
  -> Comparative Scoring（对比评分）
  -> Winner Convergence（胜者收敛）
```

---

## 5. 交互协议：主干频道模型

### 5.1 主干频道定义

主干频道是用户唯一可见的任务入口。

用户行为：

- 在主干频道提出目标
- 在必要时澄清需求
- 接收统一、收敛后的阶段结果与最终结果

系统行为：

- 不把内部争论直接暴露给用户
- 不要求用户在多个内部频道之间切换
- 不让不同小主脑直接分别向用户争抢解释权

### 5.2 主干频道处理流程

当用户在主干频道发出命令：

1. 主脑解析目标、约束和 done-when
2. 主脑判断任务复杂度与风险级别
3. 主脑决定：
   - 是否直接单路执行
   - 是否调用一个已有小主脑
   - 是否创建多个候选小主脑进入赛马
4. 主脑分身同步接收愿景上下文，并监督后续方案是否偏题
5. 如果内部仍无法消歧，主脑才向用户请求补充

### 5.3 用户介入边界

以下情况允许上抛给用户：

- 需求本身存在多种合理解释，且价值差异明显
- 多条路径在目标函数上难分高下，但牵涉用户偏好
- done-when 不明确到足以影响资源投入
- 风险动作需要用户确认

以下情况不应频繁打扰用户：

- 小主脑内部 SOP 级别的不确定性
- 可以由愿景分身通过已有上下文澄清的问题
- 低风险、低成本的技术性分歧

---

## 6. 主脑（Overmind）与愿景分身（Vision Arbiter）

### 6.1 主脑职责

主脑继续是唯一线程级主动权威。

职责包括：

- 维护 thread 级全局真理
- 接收用户意图并做战略判断
- 决定 spawn / decompose / assign / converge
- 控制晋升、降级、采纳、淘汰
- 在多小主脑赛马结束后做最终收敛

### 6.2 愿景分身职责

愿景分身是主脑的监督视角，不是第二主脑。

职责包括：

- 维护目标边界与 done-when
- 判断某分支是否偏离用户真实目标
- 为小主脑提供“愿景解释”，而不是“拍板调度”
- 作为赛马评估过程中的一致判尺
- 发现需求缺口并建议上抛给主脑 / 用户

### 6.3 愿景分身约束

愿景分身不得：

- 独立创建或分配 BroodTask
- 独立决定最终胜者
- 越过主脑直接向用户承诺新需求
- 擅自补全关键缺失需求

### 6.4 进化大师（Evolution Master）

进化大师是系统中唯一专职负责进化与策略优化的角色，灵感来自泰伦虫族的诺恩后虫（Norn-Queen）和星际争霸异虫的阿巴瑟（Abathur）。

**核心特征：拥有受限独立意志。**

与小主脑（纯执行节点，无独立意志，类似脑虫/虫巢暴君）不同，进化大师在进化领域内拥有自主决策权：

- 可以独立判断哪些基因/策略值得试验
- 可以独立设计新的分解策略、review 规则、协作模式
- 可以主动向主脑提议进化方向，而非被动等待指令
- 可以拒绝主脑提出的"退化性"进化请求（需给出理由）

**职责：**

1. **基因设计**：设计新的 worker 模板、review heuristic、coordination protocol、host lifecycle 规则
2. **策略优化**：分析 SelectionReport，识别可进化的模式，提出改进方案
3. **试验管理**：主导 Evolution Layer 的 Trial Broods，决定试验参数与评估标准
4. **谱系维护**：维护 Genome Registry，决定哪些基因采纳、哪些淘汰
5. **退化预警**：监控小主脑与宿主的 survival score，在谱系退化前主动预警

**约束：**

- 不得绕过主脑直接调度小主脑或分配 BroodTask
- 不得对外（用户侧）发言
- 不得独立决定小主脑的晋升/降级（只能建议，主脑批准）
- 进化决策必须有 ledger 记录，不允许黑箱操作

**与主脑的关系：**

进化大师向主脑负责，但不是主脑的傀儡。主脑负责"做什么"（战略目标与调度），进化大师负责"怎么进化得更好"（基因设计与策略优化）。主脑可以否决进化大师的建议，但不能替代其专业判断。

这类似于异虫中刀锋女王与阿巴瑟的关系——凯瑞甘下达战略目标，阿巴瑟自主决定如何从基因层面实现。也类似于泰伦虫族中虫巢意志与诺恩后虫的关系——虫巢意志是全局方向，诺恩后虫在进化和舰队管理上有极高的自主决策权。

---

## 7. 小主脑（Submind）生命周期

### 7.1 定位

小主脑是领域级治理节点，不是普通执行 Agent。

它们应负责：

- 维护域内黑板
- 组织 Host 与 Unit / Drone 执行
- 把高层目标转成可执行 BroodTask DAG
- 做域内重试、回滚、review 协调
- 向上汇报成本、质量、风险与进化信号

### 7.2 三种状态

#### 常驻小主脑（Resident Submind）

- 长期复用
- 领域适配明确
- 有稳定生存分和历史表现
- 进入默认调度池

#### 试验小主脑（Trial Submind）

- 为复杂任务、新策略、新谱系而孵化
- 仅在隔离频道参与赛马
- 默认不进入长期默认池
- 由 Trial / Selection 决定后续命运

#### 休眠小主脑（Dormant Submind）

- 保留基因与历史 ledger
- 当前不默认被选中
- 在相关任务出现时可唤醒

### 7.3 复用优先策略

主脑在选择小主脑时，按以下顺序判断：

1. 现有小主脑是否有明确 domain fit
2. 是否有同类任务的稳定成功史
3. 最近 survival score 是否健康
4. 当前 load 是否可接受
5. handoff / review / recoverability 是否优秀

仅当上述匹配失败或存在充分的试验理由时，才新增小主脑。

### 7.4 新增小主脑的触发条件

允许新增的场景：

1. 新 domain 首次出现
2. 复杂任务需要隔离赛马
3. 现有小主脑长期过载
4. 现有谱系持续退化
5. 新候选策略值得形成单独治理节点试验

### 7.5 转正规则

新建小主脑默认是试验态。

满足以下条件后，才可转为常驻：

- 在稳定领域中持续取得正向增益
- 相比现有小主脑有可量化优势
- 不显著增加全局复杂度与审查负担
- 交接质量和 thread continuity 足够稳定

---

## 8. 赛马机制：条件并行与择优收敛

### 8.1 赛马不是默认，而是复杂度触发

不是所有任务都应该赛马。

建议默认策略：

- 简单任务：单小主脑 / 单路线
- 中等任务：单小主脑，必要时局部双路验证
- 复杂任务：多小主脑并行赛马
- 高价值高不确定任务：多小主脑 + 愿景分身持续监督

### 8.2 赛马单位

赛马的不是用户入口，而是内部候选执行链。

赛马对象可以是：

- 不同小主脑
- 不同分解策略
- 不同 review heuristic
- 不同 host lifecycle 规则
- 不同 worker 模板或协作模式

### 8.3 赛马前提：环境隔离

每条赛马路线必须拥有：

- 独立频道
- 独立 Hive Base 或等价状态面板
- 独立 Host 绑定和局部状态
- 独立日志、成本和失败统计

不得让多个候选路线写入同一执行状态。

### 8.4 赛马目标函数

“赢过别组”是目标，但不能是唯一目标。

推荐把适应度写成综合评分：

```text
fitness =
  outcome_quality
  + speed_bonus
  + reuse_value
  + robustness
  - token_cost
  - host_cost
  - review_cost
  - rework_penalty
  - coordination_overhead
```

系统应明确比较：

- 结果质量
- 完成速度
- 资源成本
- review 负担
- 恢复能力
- 上下文污染控制
- 对外一致性
- 可复用价值

### 8.5 赛马收敛

赛马结束后：

1. 主脑汇总各分支 Selection 数据
2. 愿景分身判断是否有偏题或伪优解
3. 主脑选择：
   - 最佳结果
   - 最佳策略
   - 是否晋升胜者谱系
   - 是否降级失败谱系
4. 将收敛结果写回主干频道

### 8.6 赛马与权威边界

允许：

- 多小主脑并行试验
- 多路线对同一目标竞争
- 失败分支被淘汰或休眠

不允许：

- 同一时刻多个 thread-level authority 对外发言
- 多个小主脑争夺用户可见主权
- 通过“人望”而非指标争夺位置

---

## 9. 任务与频道模型（v2）

### 9.1 Channels are not chat rooms

频道不是闲聊窗口，而是状态面板。

系统至少需要以下频道类型：

#### Trunk Channel

用户唯一可见频道。

包含：

- 用户目标
- 当前阶段状态
- 统一对外汇报
- 必要时的澄清问题

#### Hive Channel

一个 Hive Base 一个。

包含：

- objective
- done-when
- active BroodTasks
- 状态
- 风险
- 产物引用
- 进化注记

#### Trial Channel

一个赛马分支一个。

包含：

- 分支假设
- 路线策略
- 独立成本与失败统计
- 中间产物
- 分支局部结论

#### Host Channel

一个 Host 一个。

包含：

- 环境状态
- 工具句柄
- 操作日志
- rollback / retry 记录
- 失败信息

#### Ledger Channels / Views

- Promotion Ledger
- Demotion Ledger
- Trial Ledger
- Selection Report View
- Genome / Extinction View

### 9.2 BroodTask 扩展约定

原有 BroodTask 结构继续保留。建议新增或约定以下语义字段：

```ts
interface BroodTaskV2 {
  brood_id: string
  thread_id: string
  hive_base_id?: string
  trial_group_id?: string
  issued_by: "overmind" | "submind"
  vision_ref?: string
  race_mode?: "none" | "control" | "experiment"
  convergence_required?: boolean
  winner_take_scope?: "result" | "strategy" | "promotion"
}
```

说明：

- `trial_group_id` 用于将同一赛马组的任务串起来
- `vision_ref` 指向当前愿景判尺
- `race_mode` 用于标注是否属于赛马分支
- `winner_take_scope` 决定胜利影响范围

---

## 10. 记忆、上下文与连续性

### 10.1 继续坚持统一 ContextPacket

所有虫群实体必须继续通过统一 ContextPacket 消费上下文。

```ts
interface ContextPacket {
  persona: PersonaContext
  vision?: VisionContext
  thread?: ThreadContext
  session?: SessionContext
  handoff?: HandoffDigest
  retrieved?: RetrievedMemory[]
  user_input: UserInputContext
}
```

这一点不因赛马机制而改变。

### 10.2 愿景上下文的作用上升

在 v2 中，`vision` 不再是可有可无的装饰字段，而是：

- 主脑分身的主要输入
- 多小主脑统一比较的判尺
- 检测偏题和判断 done-when 的基础

### 10.3 连续性原则

- 主干连续性比内部赛马连续性更重要
- Host 连续性仅在状态型工具链上保留
- 赛马失败分支不应污染主干 handoff
- 只有胜者结果与必要摘要进入 thread 主记忆

### 10.4 Handoff 规则补充

赛马场景下，handoff 还应支持：

- 当前有哪些赛马分支仍活跃
- 哪些分支已被淘汰
- 胜者候选是谁
- 是否仍需用户澄清
- 胜者继承了哪些 Host 状态

建议补充：

```ts
interface TrialHandoffDigest extends HandoffDigest {
  active_trial_groups?: string[]
  candidate_winners?: string[]
  eliminated_branches?: string[]
  unresolved_vision_questions?: string[]
}
```

---

## 11. 晋升、降级与替换机制

### 11.1 晋升不是选举，是基于指标的上位

小主脑与宿主的晋升逻辑继续遵循：

- 可量化
- 可审计
- 可逆
- 不破坏 thread continuity

因此，系统更适合采用 **挑战制 / 孵化晋升制**，而不是“长期竞选制”。

### 11.2 小主脑替换规则

允许出现以下情况：

- 现任小主脑连续退化
- 某候选小主脑在隔离赛马中持续胜出
- 现任小主脑过载，且候选者在同域有更高适应度

替换流程：

1. 触发挑战窗口
2. 候选小主脑在隔离环境中执行
3. 生成 SelectionReport
4. 主脑批准替换
5. 旧小主脑降级、休眠或缩权
6. 新小主脑接手默认调度权

### 11.3 不允许的夺位模式

- 通过聊天影响力争位置
- 在同一主线 thread 里直接对冲现任权威
- 未经主脑批准自行宣布上位

---

## 12. 进化层（v2）

### 12.1 进化闭环保持不变

系统继续坚持：

```text
Intake -> Isolation -> Trial -> Selection -> Adoption or Extinction
```

### 12.2 进化大师主导进化闭环

进化层不再是无主的自动化流程，而是由进化大师（Evolution Master）主导的受控进化系统。

进化大师在进化闭环中的角色：

- **Intake 阶段**：识别值得吸收的外部基因（新策略、新模式、新工具能力）
- **Isolation 阶段**：设计隔离试验方案，确定评估标准
- **Trial 阶段**：监控试验进展，必要时调整参数
- **Selection 阶段**：分析 SelectionReport，向主脑提交采纳/淘汰建议
- **Adoption/Extinction 阶段**：执行主脑批准的进化决策，更新 Genome Registry

### 12.3 新增一类重要内部基因：治理基因

除了 worker / review / memory / host 相关基因外，v2 应显式支持：

- 小主脑分解风格基因
- 愿景监督规则基因
- 赛马触发阈值基因
- 收敛策略基因
- Submind 生命周期规则基因
- **进化策略基因**（进化大师的核心资产，决定进化方向与试验偏好）

### 12.4 什么最值得竞争

v2 阶段最值得放进 Trial 的，不是“人格”，而是：

- decomposition strategies
- review heuristics
- host lifecycle rules
- coordination protocols
- conditional-racing thresholds
- submind reuse / spawn policies

### 12.5 选择标准更新

SelectionReport 除原有 throughput / cost / failure / review_pass 外，建议再纳入：

- vision alignment
- convergence quality
- user interruption rate
- branch isolation quality
- reuse value
- context pollution reduction

---

## 13. 架构裁决：为什么这套方案比“纯卡拉”更适合作为 OS 底层

GreyWind 的底层不应是纯统一心智网络，而应继续以虫群为骨架。

原因：

1. 虫群天然适合优胜劣汰、分层治理与谱系淘汰
2. OS 底层需要权威可审计，而不是泛共识化
3. Host、Task、Review、Promotion 都更像“生物式治理”而不是“精神网络合唱”
4. 赛马机制要求竞争存在，纯卡拉更倾向一致性而非筛选

因此：

- 卡拉式能力最多做高层 overlay
- 虫群等级制仍是治理骨架
- 信息素式局部偏置 + 灵能式高权威协调，比纯一致性网络更适合 GreyWind

---

## 14. 模块落点建议

### 14.1 建议新增/改造模块

新增：

- `src/greywind/hive/trunk_protocol.py`
- `src/greywind/hive/vision_arbiter.py`
- `src/greywind/hive/evolution_master.py`
- `src/greywind/hive/trial_race.py`
- `src/greywind/hive/submind_registry.py`
- `src/greywind/hive/convergence_engine.py`

改造：

- `overmind.py`：增加复杂度判断、赛马触发与收敛逻辑
- `submind.py`：区分 resident / trial / dormant 生命周期
- `synapse_net.py`：从泛广播改为更强调分层状态同步
- `prompt_assembler.py`：强化 `vision`、`trial_group_id` 等上下文拼装
- `ws_handler.py`：支持 trunk / trial / hive / host 多频道状态广播

### 14.2 Ledger 建议

至少增加：

- `trial_ledger`
- `submind_registry`
- `convergence_ledger`
- `vision_decision_log`

---

## 15. Phase 计划（v2）

### Phase E0 — Interface Lock

冻结：

- ContextPacket
- HandoffDigest
- BroodTask
- Host abstraction
- Vision Arbiter interface
- Trial Group interfaces
- Submind lifecycle enums

### Phase E1 — Minimal Trunk + One Submind

实现：

- 主干频道
- 主脑骨架
- 一个常驻小主脑
- 一个 Host
- 基础 BroodTask 生命周期
- 愿景上下文占位

### Phase E2 — Conditional Racing

实现：

- 复杂度判断
- 双路试验
- Trial Channel
- 基础收敛逻辑
- 愿景分身作为裁判输入

### Phase E3 — Submind Lifecycle & Evolution

实现：

- resident / trial / dormant 三态
- 小主脑复用与受控孵化
- SelectionReport 扩展指标
- 小主脑替换与休眠策略

### Phase E4 — Retrieval / Memory / Scaling Upgrades

实现：

- 更强 handoff
- 长期 lesson integration
- 结构化 persistence
- 更丰富的 race threshold tuning

---

## 16. 最小可接受版本（v2）

一个最小可接受版本应至少证明：

1. 用户只在主干频道说话
2. 主脑能够判断简单任务 vs 复杂任务
3. 简单任务可单路执行
4. 复杂任务可触发双路隔离赛马
5. 主脑分身可提供愿景监督输入
6. 小主脑可被复用，而非每次都新建
7. 试验小主脑可以在失败后被休眠或淘汰
8. 胜者结果能够收敛回主干频道
9. 不允许多个内部节点同时争夺对外发言权
10. 所有内部选择都有 ledger 记录

---

## 17. 开放问题

1. 复杂度阈值如何定义，才能避免过度赛马？
2. 小主脑转正需要几轮稳定胜出？
3. 愿景分身在多大程度上可以自动解释模糊需求？
4. 失败分支的中间产物保留多久？
5. 哪些领域适合长期常驻小主脑，哪些更适合临时孵化？
6. 主脑是否应维持固定数量的“热备小主脑池”？

---

## 18. 最终规则集（v2）

1. 用户只对一个主干人格发令，不对委员会发令。
2. 主脑是线程级唯一主动权威；愿景分身不是第二主权。
3. 竞争可以存在，但必须被隔离、度量并最终收敛。
4. 简单任务优先单路执行；复杂任务才触发条件赛马。
5. 小主脑默认复用；新增必须有明确试验或专精理由。
6. 晋升依赖指标，不能依赖政治化拉票。
7. 失败分支可以灭绝，但不应污染主干连续性。
8. 只有胜出的结果、策略和必要摘要进入主线记忆。
9. 进化没有记录是非法的；选择没有指标也是非法的。
10. 进化大师在进化领域有受限独立意志，但不得绕过主脑调度或对外发言。
11. Hive 必须强化 GreyWind 的 spine，而不是取代它。

---

## 19. 一句话总结

> GreyWind v2 的核心，不是”让更多 Agent 一起说话”，
> 而是”让一个主干人格在虫群治理下，由进化大师驱动持续进化，按复杂度决定是否分裂，并在隔离赛马中筛出更强路径，再把胜者收敛回一个统一意志”。

