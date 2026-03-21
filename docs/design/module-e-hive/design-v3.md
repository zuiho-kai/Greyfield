# Module E 虫巢系统（Hive）— 设计文档 v3.0

> 创建时间：2026-03-21
> 状态：Draft
> 版本：v3.0（v2.2 基础上新增：术语对齐泰伦/异虫设定 + 进化大师角色）
> 设计来源：泰伦虫族社会结构 + 星际争霸异虫等级体系 + OpenRoom 事件总线 + Cat Cafe 频道化 + 当皇上三省六部

---

## 1. 一句话定位

**灰风虫巢 = 一个具备神经进化能力的任务型多 Agent 操作系统，对外呈现 Discord 式多频道结构，对内以泰伦虫族等级制运行，由进化大师驱动持续进化，低阶 Agent 通过战功积累可晋升至高阶。**

### 1.1 术语与灵感映射

本系统融合了战锤 40K 泰伦虫族与星际争霸异虫的设计灵感。以下为核心术语映射：

| GreyWind 术语 | 泰伦虫族对应 | 星际争霸异虫对应 | 系统定位 |
|---|---|---|---|
| 系统人格外壳 Persona Shell | 虫巢意志 Hive Mind | — | 对外统一意识，用户只感知一个人格 |
| 主脑 Overmind（L3） | — | 主宰 Overmind | 线程级唯一主动权威，战略决策与调度 |
| 进化大师 Evolution Master（L3） | 诺恩后虫 Norn-Queen | 阿巴瑟 Abathur | 基因进化设计、策略优化，有受限独立意志 |
| 愿景分身 Vision Arbiter | 虫巢领主 Swarmlord | — | 愿景监督与赛马裁判，非第二主权 |
| 小主脑 Submind（L2） | 虫巢暴君 Hive Tyrant | 脑虫 Cerebrate | 领域级治理节点，接受主脑指挥 |
| 虫群工作组 Brood（L1） | — | 虫群 Brood | 一组协同 Unit 的集合，内部直接协作 |
| 战斗单位 Unit（L0） | 虫巢武士 Warrior | 刺蛇 / 跳虫 | 专业执行者 + 原子任务执行 |
| 原子任务 ToolAction | 撕裂虫 Ripper | 工蜂 Drone | 文件/浏览器/代码操作（原 Drone 层级） |
| 虫巢容器 Hive Container | 虫巢舰 Hive Ship | 孵化场 Hatchery | Session 级资源容器，不参与决策 |
| 灵能节点网络 Synapse Net | 灵能网络 Synapse Network | 心灵链接 Psionic Link | ContextPacket 分发与状态同步 |
| 进化层 Evolution Layer | 基因库 + 自然选择 | 进化深渊 Evolution Pit | 由进化大师主导的基因进化与淘汰 |
| 赛马机制 Trial Race | — | — | GreyWind 原创：条件并行竞争与择优收敛 |
| 基因种子 GeneSeed | 基因种子 Gene-Seed | 原质 Essence | 三层经验注入（Constitution/Playbook/Lessons） |

**关键设计选择**：GreyWind 不是纯泰伦模型（无实体的完形灵能意识，所有个体无自我），也不是纯异虫模型（单主宰绝对控制，基因锁死忠诚）。它取泰伦的分层灵能节点网络作为治理骨架，取异虫的主宰 + 脑虫 + 阿巴瑟分工模型作为角色设计。进化大师借鉴了阿巴瑟的"受限独立意志"——在进化领域有自主判断权，但不能越权调度。竞争与进化机制（赛马、谱系淘汰）是 GreyWind 自己的设计。

---

## 2. 核心设计原则

### 2.1 多频道暴露模型（Multi-Channel Visibility）

用户**默认只看到 Trunk（主干频道）**，其他频道作为**详情面板折叠在右侧侧边栏**，类似 Discord + Cat Cafe 的三层结构：

```
┌─────────────────────────────────────────────────────────────────┐
│  左侧：频道导航栏（Channel Sidebar）                              │
│  ── 类似 Discord 左侧频道列表                                     │
│  ── 显示所有任务/虫巢基地/小主脑会话                              │
│                                                                 │
│  • 主频道（Trunk）【默认展开】                                    │
│  • Hive Base: movie-crawler【折叠】                              │
│  • Trial Group: task-001【折叠】                                 │
│  • Ledger【折叠】                                                │
└──────────────────┬──────────────────────────────────────────────┘
                   │
┌──────────────────┼──────────────────────────────────────────────┐
│  中间：对话流（Conversation Stream）— Trunk                       │
│  ── 领导仪表盘视角：主脑决策 + 小主脑汇报                          │
│  ── 约 10-15 条关键节点消息                                       │
│                                                                 │
│  [主脑] 分析需求，复杂度：中等，触发双路验证...                    │
│  [小主脑-CodeA] 方案A：requests，预计成功率 95%，耗时 30s         │
│  [小主脑-CodeB] 方案B：playwright，预计成功率 98%，耗时 36s       │
│  [主脑] @用户 两个方案进行中，预计2分钟完成...                     │
│  [主脑] Trial 完成，选择方案B（成功率更高），Submind-B 表现优异   │
│  [系统] Submind-B 晋升积分 +1                                    │
└──────────────────┼──────────────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────────────────┐
│  右侧：详情面板（Detail Panel）— 默认折叠，可展开                   │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ Hive Channel │ │ Trial Panel  │ │ Ledger View  │             │
│  │ • 当前任务   │ │ • 赛马分支A  │ │ • 晋升记录   │             │
│  │ • 产物列表   │ │ • 赛马分支B  │ │ • 战功排行   │             │
│  │ • 依赖关系   │ │ • 实时进度   │ │ • 基因版本   │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

**默认交互模式**：
- **Trunk（主干）**：仅显示主脑战略决策 + 小主脑战术汇报（约 10-15 条），领导视角
- **右侧详情面板**：默认折叠，用户可点击展开查看
  - **Trial Panel**：赛马分支实时进度（执行细节）
  - **Hive Channel**：资源环境状态
  - **Ledger View**：战功统计、晋升记录
- 简单任务不弹出 Trial Panel，复杂任务或用户主动点开时才展开
- 用户在 Trunk 可直接 @主脑 @小主脑 参与对话
- 点击 Trial Panel 可手动终止某分支

**消息量级控制**：
- **Trunk**：10-15 条/任务（仅关键节点）
- **Trial Channels**（折叠）：各 15-20 条（执行细节）
- **Brood Channels**（折叠）：10-20 条（Unit 协作）

用户不会被 50+ 条消息淹没，同时保留可追溯性。

### 2.2 虫群等级制（Tyranid Hierarchy）

| 等级 | 英文名 | 中文名 | 虫族对应 | 职责 | 状态 |
|------|--------|--------|----------|------|------|
| L3 | Overmind | 主脑 | 主宰 Overmind | 全局战略决策、赛马触发、收敛仲裁 | 系统唯一，永不沉睡 |
| L3 | Evolution Master | 进化大师 | 诺恩后虫 + 阿巴瑟 | 基因进化设计、策略优化、试验管理 | 系统唯一，有受限独立意志 |
| L2 | Submind | 小主脑 | 脑虫 Cerebrate / 虫巢暴君 | 领域级战术调度、任务分解、Brood 协调 | 常驻/试验/休眠三态 |
| L1 | Brood | 虫群工作组 | 虫群 Brood | 一组协同 Unit 的集合，内部直接协作 | 动态组建 |
| L0 | Unit | 战斗单位 | 武士 Warrior / 跳虫 Zergling | 专业执行者 + 原子任务执行（ToolAction） | 按领域细分多种类型 |

**关键变更说明**：

1. **层级压缩**：v2.2 从 6 层压缩到 4 层
   - **删掉 Drone 独立层级**：原 L0 Drone（工蜂）并入 Unit 内部的 ToolAction，不再是独立心智层级
   - **Hive 退化为容器**：原 L2 Hive 不再是一等治理层级，仅作为 Session 级资源容器存在

2. **职责边界硬化**：
   - **Overmind（L3）**：只负责"是否开赛马、谁赢、是否升级/休眠、是否向用户汇报"
   - **Evolution Master（L3）**：只负责"基因进化设计、策略优化、试验管理"，有受限独立意志，不参与调度
   - **Submind（L2）**：只负责"把一个目标拆成若干 BroodTask"
   - **Brood（L1）**：只负责"执行协作"和"内部角色通信"
   - **Hive**：只负责"资源容器 + 生命周期 + 隔离上下文"，**不参与决策**
   - **Unit（L0）**：只负责产出，不负责调度；原子任务通过 ToolAction 封装

3. **Unit 内部结构**：
```
Unit (L0)
├── Core：专业执行者（前端虫/后端虫/设计虫/审核虫）
├── ToolAction：原子任务封装（原 Drone 层级）
│   ├── FileAction：文件读写、格式转换
│   ├── BrowserAction：浏览器操作
│   └── CodeAction：代码片段执行
└── GeneSeed：领域经验注入
```

**专家基因（Expert Gene）机制**：

每个专业 Unit 都有独立的基因库：
- **设计虫基因** → `L0_unit/designer/` —— 设计模式、组件库经验、常见错误
- **前端虫基因** → `L0_unit/frontend/` —— 框架特性、性能优化、兼容性处理
- **后端虫基因** → `L0_unit/backend/` —— 架构模式、数据库优化、安全规范
- **审核虫基因** → `L0_unit/reviewer/` —— Review checklist、常见缺陷模式、最佳实践

经验双向落盘：
- **成功经验** → 项目完成后，每个参与 Unit 的成功经验写入对应基因库
- **失败经验** → 过程中遇到问题立即写入失败基因库（错题本），并关联解决方案

### 2.3 三大核心机制

#### 机制一：条件赛马（Conditional Trial Broods）

**硬规则触发赛马**（只有满足 2 项以上才允许开启 Trial）：

| 触发条件 | 说明 |
|----------|------|
| 1. 需要外部执行 | 任务涉及浏览器/桌面/API 等外部操作 |
| 2. 存在多可行路径 | 技术方案不唯一（如 requests vs playwright） |
| 3. 高风险 | 涉及数据修改、安全敏感、不可回滚操作 |
| 4. 历史失败率高 | 同 domain 近 7 天失败率 > 30% |

**赛马规则**：
- **固定两路**：不允许 3 路以上，不做动态分支数
- **用户不能直接指定路数**，只能"允许/不允许试验"
- 必须在隔离环境中进行（独立频道/独立 Host/独立状态）
- 每个候选分支共享目标约束，但不共享执行状态
- 用户可在 Trial Panel 看到全过程并手动干预
- 由 Overmind 统一收敛并选择胜者

**收敛判据**（两层结构）：

**第一层：硬门槛**（必须全部通过）
- 是否成功完成（outcome_success）
- 是否违反约束（constraint_violation）
- 是否通过审查（review_passed）

**第二层：软评分**（在通过硬门槛的候选中比较）
- 结果质量（40%）：功能正确性、代码质量
- 速度奖励（20%）：执行耗时
- 健壮性（15%）：错误处理、边界情况
- 复用价值（10%）：方案可复用性
- Token 成本（-10%）：LLM 调用开销
- 协作开销（-5%）：Brood 协调成本

不通过硬门槛的候选直接淘汰，不进行软评分比较。

#### 机制二：主脑分身裁判（Vision Arbiter / Dreamer Shadow）

- **不是第二主脑**，而是监督视角
- 维护愿景边界和 done-when 定义
- 作为赛马比较的一致判尺
- 发现需求缺口建议上抛给用户或 Overmind

#### 机制三：小主脑复用优先、受控孵化

- 小主脑是**可复用治理资产**，不是一次性消耗品
- **三态管理**：常驻(Resident) / 试验(Trial) / 休眠(Dormant)
- **新增触发条件**：新领域/复杂赛马/过载/退化/新策略验证
- **转正条件**：持续正向增益 + 可量化优势 + 交接质量稳定

#### 机制四：进化大师（Evolution Master）

进化大师是系统中唯一专职负责进化与策略优化的角色，灵感来自泰伦虫族的诺恩后虫（Norn-Queen）和星际争霸异虫的阿巴瑟（Abathur）。

**核心特征：拥有受限独立意志。**

与小主脑（纯执行节点，无独立意志，类似脑虫/虫巢暴君）不同，进化大师在进化领域内拥有自主决策权：

- 可以独立判断哪些基因/策略值得试验
- 可以独立设计新的分解策略、review 规则、协作模式
- 可以主动向主脑提议进化方向，而非被动等待指令
- 可以拒绝主脑提出的"退化性"进化请求（需给出理由）

**职责**：

1. **基因设计**：设计新的 worker 模板、review heuristic、coordination protocol、host lifecycle 规则
2. **策略优化**：分析 SelectionReport，识别可进化的模式，提出改进方案
3. **试验管理**：主导 Evolution Layer 的 Trial Broods，决定试验参数与评估标准
4. **谱系维护**：维护 Genome Registry / 基因库三层结构，决定哪些基因采纳、哪些淘汰
5. **退化预警**：监控小主脑与 Unit 的 survival score，在谱系退化前主动预警

**约束**：

- 不得绕过主脑直接调度小主脑或分配 BroodTask
- 不得对外（用户侧）发言
- 不得独立决定小主脑的晋升/降级（只能建议，主脑批准）
- 进化决策必须有 ledger 记录，不允许黑箱操作

**与主脑的关系**：

主脑负责"做什么"（战略目标与调度），进化大师负责"怎么进化得更好"（基因设计与策略优化）。主脑可以否决进化大师的建议，但不能替代其专业判断。类似刀锋女王与阿巴瑟的关系——凯瑞甘下达战略目标，阿巴瑟自主决定如何从基因层面实现。

**与基因库三层结构的关系**：

- **Constitution（L1 宪法）**：进化大师维护，极少更新，更新需主脑批准
- **Playbook（L2 战术手册）**：进化大师主导版本化管理，分析 SelectionReport 后提议更新
- **Lessons（L3 近期教训）**：自动落盘，进化大师负责审查是否升级为 Playbook

### 2.5 消息持久化与总结机制（Cat Cafe 式）

所有 Channel 的聊天消息**实时持久化到数据库**，支持跨 Session 回顾和检索。

**三层存储结构**：

```
消息存储（Message Store）
├── Raw Messages（原文）
│   └── 保留完整对话历史，支持全文检索
│   └── 存储：SQLite / PostgreSQL
│
├── Summary Chains（摘要链）
│   └── 事件驱动生成，非固定消息数
│   └── 触发条件：任务完成、分支淘汰、用户插话、Session 结束
│   └── 存储：向量数据库（支持语义检索）
│
└── Key Decisions（关键决策）
    └── 提取决策点、方案选择、经验教训
    └── 直接写入 Ledger
```

**总结策略**（事件驱动优先）：

| 层级 | 触发条件 | 内容 | 使用场景 |
|------|----------|------|----------|
| **即时摘要** | 消息数达阈值（兜底） | 话题转移提示 | UI 快速浏览 |
| **阶段摘要** | **事件驱动**：子任务完成、分支淘汰、方案选定 | 做了什么、决策理由、产出物 | 任务交接、用户回顾 |
| **Session 摘要** | Session 结束时 | 完整目标、关键决策、成功/失败经验 | 跨 Session 恢复、经验沉淀 |

**事件触发优先级**（从高到低）：
1. **BroodTask 完成**：生成阶段摘要
2. **Trial 分支被淘汰**：记录淘汰原因
3. **方案被选中**：记录选择理由
4. **进入 Review Gate**：生成审查前摘要
5. **用户插话改变约束**：标记上下文变更
6. **Session 结束**：生成完整摘要
7. **兜底**：消息数阈值（每 20 条）或时间阈值（每 10 分钟）

**原文可检索**：
- 摘要用于减少上下文，但原文保留
- 支持关键词搜索、时间范围搜索、@mention 搜索
- 前端提供"展开查看原文"功能

**战功记录（Kill-mark）维度**：
- 任务完成度（是否达成目标）
- 效率指标（耗时、token 消耗、步骤数）
- 用户满意度（显式反馈 👍/👎 + 隐式信号）
- 创新性（是否找到更优解）

**内部评估信号**（不做排行榜）：
- 评估结果仅用于 Overmind 的调度决策
- 不面向用户展示排名
- 只展示"本次为什么选它"（可解释选择）

### 2.6 强制落盘机制（解决"不看错题本"问题）

**核心问题**：传统错题本依赖人主动查阅，而虫群系统通过**基因分层注入**确保经验不可被忽略。

#### 基因库三层结构

| 层级 | 名称 | 内容 | 存储 | 注入方式 |
|------|------|------|------|----------|
| **L1** | Constitution（宪法） | 极稳定规则（安全、编码规范、审查底线） | YAML | 直灌 prompt |
| **L2** | Playbook（战术手册） | 领域经验（React/API 设计/安全规范） | YAML（版本化） | 检索后注入 |
| **L3** | Lessons（近期教训） | 最近失败/成功经验，带时效 | **SQLite 平铺** | 检索后注入，自然衰减 |

**Lessons 存储（SQLite 平铺 + 自然衰减）**：

```sql
CREATE TABLE lessons (
    id TEXT PRIMARY KEY,
    domain TEXT,              -- 分类：frontend/react/hook
    tags TEXT,                -- 标签：hook,useEffect
    content TEXT,
    created_at INTEGER,
    last_used INTEGER,        -- 最后复用时间
    frequency INTEGER         -- 复用次数
);

-- 索引加速查询
CREATE INDEX idx_domain_lastused ON lessons(domain, last_used);
```

**自然衰减**：
- 不主动归档、不物理删除
- 查询时按 `exp(-0.1 * days) * log(1 + frequency)` 计算分数
- 老的经验自然沉底，新复用的经验浮上来
- 万条数据 O(log n) 查询（索引）

#### 机制一：启动时基因加载（强制读取）

每个 Unit 启动时**必须从基因库加载经验**，不是可选的：

```python
class Unit:
    def __init__(self, unit_type: str, domain: str):
        # 强制加载基因，失败则无法启动
        self.constitution = GeneSeed.load_constitution(required=True)
        self.playbook = GeneSeed.load_playbook(
            unit_type=unit_type,
            domain=domain,
            top_k=5  # 只加载 Top-K 相关经验
        )
        self.lessons = GeneSeed.query_lessons(
            domain=domain,
            recency_days=30
        )

        # 基因注入 prompt
        self.system_prompt = self._assemble_prompt()

    def _assemble_prompt(self) -> str:
        return f"""
        你是 {self.unit_type} 领域的执行者。

        【Constitution】（必须遵循）
        {self.constitution}

        【Playbook】（检索匹配的领域经验）
        {self.playbook}

        【Lessons】（近30天相关教训）
        {self.lessons}

        如果不确定，查阅 Ledger: {self.ledger_ref}
        """
```

#### 机制二：执行时经验检查（强制应用）

Unit 在执行任务时，系统**自动检查**是否触发已知失败模式：

```python
class ExecutionGuard:
    """执行守护 —— 运行时检查"""

    def pre_check(self, task: BroodTask, unit: Unit) -> GuardReport:
        """任务执行前检查"""
        risks = []

        # 检查任务特征是否匹配已知失败模式
        for pattern in unit.playbook.failure_patterns + unit.lessons:
            if pattern.matches(task):
                risks.append({
                    "risk_id": pattern.id,
                    "description": pattern.description,
                    "source": pattern.source,
                    "suggestion": pattern.workaround
                })

        if risks:
            return GuardReport(
                status="blocked",
                risks=risks,
                require_ack=True
            )

        return GuardReport(status="pass")
```

#### 机制三：失败时即时落盘（强制写入）

任务失败后**立即**（不是事后整理）写入失败基因库：

```python
class FailureCapture:
    """失败捕获 —— 即时落盘"""

    def on_failure(self, task: BroodTask, unit: Unit, error: Error):
        """失败回调，强制落盘"""

        # 1. 立即写入 Ledger（同步写入）
        ledger_entry = {
            "timestamp": now(),
            "unit_type": unit.unit_type,
            "unit_id": unit.id,
            "task_id": task.brood_id,
            "error_type": error.classify(),
            "error_message": error.message,
            "context": task.context_snapshot(),
            "recovery_action": error.recovery_attempted
        }
        ExtinctionLedger.write(ledger_entry)

        # 2. 写入 Lessons（L3 层，即时生效）
        lesson = {
            "type": "failure",
            "domain": unit.domain,
            "pattern": self._extract_pattern(error, task),
            "created_at": now(),
            "expires_at": now() + timedelta(days=30)  # 30 天有效期
        }
        LessonsBank.add(lesson)

        # 3. 如果是全新类型的失败，考虑升级至 Playbook
        if self._is_novel_pattern(error, unit.domain):
            PlaybookPropose.queue_for_review(lesson)
```

#### 机制四：基因传播（分层生效）

| 传播方式 | 触发条件 | 接收方 | 效果 |
|----------|----------|--------|------|
| **Lessons 广播** | 新失败/成功提取 | 同 domain 活跃 Unit | 下次执行前重新加载 |
| **Playbook 热更新** | 关键安全/性能教训 | 全局 Unit | 版本号更新，新 Session 生效 |
| **版本锁定** | Session 开始时 | 当前 Session 所有 Unit | 固定使用某版本，执行中不变 |

#### 机制五：审计与惩罚（四级递进）

**失败分类**（先分类，再惩罚）：
- **环境失败**：网络、工具、权限、超时 → **不惩罚**
- **理解失败**：误解任务、漏约束 → **轻微惩罚**
- **策略失败**：路线不优 → **中等惩罚**
- **质量失败**：结果不达标 → **严重惩罚**

**四级处理流程**：

```python
class EvolutionAudit:
    """进化审计 —— 四级递进"""

    def audit_repeated_failure(self, unit: Unit, failure_id: str, error_type: str):
        """检查是否重复失败"""

        # 只关注策略失败和质量失败
        if error_type not in ["strategy", "quality"]:
            return

        # 检查：同类型 + 同模式 + 同域 + 同约束
        key = (failure_id, unit.domain, task.constraint_hash)
        unit.failure_log[key] += 1
        count = unit.failure_log[key]

        if count == 1:
            # Level 1: Observe（仅记录）
            self._log_observation(unit, key)

        elif count == 2:
            # Level 2: Warn（系统通知，标记 kill_mark）
            self._send_warning(unit, key)
            unit.kill_mark.warning_count += 1

        elif count == 3:
            # Level 3: Constrained（限制执行范围）
            unit.status = "constrained"
            unit.allowed_tasks = ["low_risk_only"]
            SynapseNet.notify(f"Unit {unit.id} 进入受限模式")

        elif count >= 4:
            # Level 4: Dormant（休眠）
            # 条件：同类型、同模式、同域、同约束下重复 4 次
            Overmind.arbitrate_demotion(
                unit=unit,
                reason=f"Repeated {error_type} failure on known pattern: {failure_id}",
                action="dormant"
            )
```

#### 机制六：Lessons 自我细化（惰性重分类）

**问题**：早期 Lessons 分类较粗（如 `frontend`），随着系统演化需要细化到 `frontend/react/hook`，但人工重新标记历史数据成本太高。

**解法**：经验被复用时，**动态细化分类**，让它以后更容易被找到。

**存储结构（SQLite 平铺）**：

```sql
CREATE TABLE lessons (
    id TEXT PRIMARY KEY,
    domain TEXT,              -- 分类：frontend/react/hook
    tags TEXT,                -- 标签：hook,useEffect
    content TEXT,
    created_at INTEGER,
    last_used INTEGER,        -- 最后复用时间（用于衰减排序）
    frequency INTEGER         -- 复用次数
);

CREATE INDEX idx_domain_lastused ON lessons(domain, last_used);
```

**查询策略（继承链 + 自然衰减）**：

```python
class LessonsBank:
    def query(self, task_domain: str, task_tags: List[str]) -> List[Lesson]:
        """查询相关 Lessons"""

        # 1. 提取 domain 继承链
        # "frontend/react/spa" -> ["frontend/react/spa", "frontend/react", "frontend"]
        domain_chain = self._get_domain_chain(task_domain)

        # 2. 按 domain 粗筛（SQLite 索引查询）
        candidates = self.db.query("""
            SELECT * FROM lessons
            WHERE domain IN ({})
        """.format(','.join('?' * len(domain_chain))), domain_chain)

        # 3. 计算综合分数（时效 + 频次 + 标签匹配）
        scored = []
        for lesson in candidates:
            score = self._calc_score(lesson, task_domain, task_tags)
            scored.append((lesson, score))

        # 4. 取 Top-5 注入 prompt
        return sorted(scored, key=lambda x: x[1], reverse=True)[:5]

    def _calc_score(self, lesson, task_domain, task_tags) -> float:
        """自然衰减公式"""
        days = (now() - lesson.last_used).days
        recency = exp(-0.1 * days)                    # 7天衰减到50%
        frequency = log(1 + lesson.frequency)         # 复用次数对数

        # 精确匹配权重更高
        domain_match = 3.0 if lesson.domain == task_domain else \
                       2.0 if task_domain.startswith(lesson.domain + "/") else 1.0

        # 标签重叠度
        lesson_tags = set(lesson.tags.split(","))
        tag_overlap = len(lesson_tags & set(task_tags))

        return recency * frequency * domain_match * (1 + tag_overlap)
```

**惰性重分类（复用时更新）**：

```python
    def on_lesson_reused(self, lesson_id: str, task: BroodTask):
        """Lesson 被复用时，动态细化分类"""

        lesson = self.db.get(lesson_id)

        # 1. 更新使用时间和频次
        lesson.last_used = now()
        lesson.frequency += 1

        # 2. 细化分类（只允许细化，不允许升粗）
        if task.domain.startswith(lesson.domain + "/"):
            # frontend -> frontend/react -> frontend/react/hook
            lesson.domain = task.domain
            lesson.tags = merge_tags(lesson.tags, task.tags)

        self.db.update(lesson)
```

**重分类规则**：

| 旧分类 | 新任务 | 是否更新 | 说明 |
|--------|--------|----------|------|
| `frontend` | `frontend/react` | ✅ 更新 | 细化 |
| `frontend/react` | `frontend/react/hook` | ✅ 更新 | 更细 |
| `frontend/react` | `frontend` | ❌ 不更新 | 不升粗 |
| `code` | `backend/api` | ✅ 更新 | 纠正大误分类 |

**关键原则**：
- **无归档目录**——永远不删，自然沉底
- **无定时任务**——查询时现算分数，复用时更新分类
- **自我进化**——常用的经验自动归类到更细的 domain
- **O(log n)**——SQLite 索引查询，万条也毫秒级

**关键原则**：
- **分层注入** —— Constitution 直灌，Playbook/Lessons 检索后注入
- **经验衰减** —— Lessons 按分数自然沉底，不主动归档
- **失败分类** —— 环境失败不惩罚，策略/质量失败才触发降级
- **四级递进** —— Observe → Warn → Constrained → Dormant，避免误杀
- **自我细化** —— Lessons 被复用时动态细化分类，无需人工维护
- **不看也得看** —— Constitution 直灌 prompt
- **不写也得写** —— 失败回调强制触发，不能跳过

---

## 3. 核心数据结构

### 3.1 BroodTask（虫巢任务）

```python
@dataclass
class BroodTask:
    brood_id: str
    thread_id: str
    goal: str
    executor_level_required: Literal["L0", "L1", "L2", "L3"]  # v2.2: 4 层
    domain: Literal["code", "research", "desktop", "memory", "review", "file", "general"]

    # 执行绑定
    hive_binding: Optional[str] = None    # 绑定的虫巢容器（资源层）
    brood_id: Optional[str] = None        # 所属虫群工作组（L1）
    depends_on: List[str] = field(default_factory=list)

    # 审查门
    review_gate: Literal["none", "light", "strict"] = "none"

    # 状态
    state: Literal["queued", "ready", "running", "blocked", "review", "done", "failed", "aborted"] = "queued"

    # 赛马相关
    trial_group_id: Optional[str] = None  # 赛马分组
    vision_ref: Optional[str] = None       # 愿景判尺引用
    race_mode: Literal["none", "control", "experiment"] = "none"
    convergence_required: bool = False
    winner_take_scope: Literal["result", "strategy", "promotion"] = "result"

    # 硬规则触发条件（v2.2 新增）
    requires_external_exec: bool = False   # 需要外部执行
    has_multiple_paths: bool = False       # 存在多可行路径
    is_high_risk: bool = False             # 高风险
    has_high_failure_rate: bool = False    # 历史失败率高
```

### 3.2 ContextPacket（上下文包）

```python
@dataclass
class ContextPacket:
    persona: PersonaContext      # 人格上下文
    vision: Optional[VisionContext] = None  # 愿景上下文（v2 强化）
    thread: Optional[ThreadContext] = None  # 线程上下文
    session: Optional[SessionContext] = None  # 会话上下文
    handoff: Optional[HandoffDigest] = None   # 交接摘要
    retrieved: List[RetrievedMemory] = field(default_factory=list)  # 检索记忆
    user_input: UserInputContext  # 用户输入

    # v2 扩展：Trial 场景
    trial_group_id: Optional[str] = None
    candidate_winners: List[str] = field(default_factory=list)
    eliminated_branches: List[str] = field(default_factory=list)
```

### 3.3 存储架构（分阶段演进）

虫群系统的存储需求复杂多样，采用**分阶段演进策略**：

| 数据类型 | Phase 1-2 | Phase 3+ |
|----------|-----------|----------|
| **消息原文** | SQLite | **PostgreSQL**（主从、分区） |
| **向量检索** | Chroma（本地） | **pgvector**（一体化）或 Pinecone |
| **战功/Ledger** | SQLite | **PostgreSQL**（时序表） |
| **基因库** | YAML（内存缓存） | **SQLite**（热数据）+ YAML（备份） |
| **基因版本** | YAML | **Git 版本控制** |

#### Phase 1-2：SQLite + Chroma（当前）

**选择理由**：
- **SQLite**：Python 原生支持，零配置，事务安全，单文件便于备份
- **Chroma**：本地嵌入向量检索，无需外部服务，API 简单

```
storage/
├── greywind.db              # SQLite 主库
│   ├── messages             # 消息表（原文 + 元数据）
│   ├── brood_logs           # Brood 协作记录
│   ├── kill_marks           # 战功记录
│   └── ledger               # 晋升/降级/赛马审计
│
├── chroma/                  # Chroma 向量库
│   ├── message_embeddings   # 消息语义向量
│   └── summary_embeddings   # 摘要向量
│
└── gene_pool/               # YAML 基因库（见 5.3 目录结构）
    └── *.yaml               # 启动加载，运行时内存缓存
```

#### Phase 3：PostgreSQL + pgvector（生产）

**迁移触发条件**：
- 消息量 > 100万条
- 并发写入 > 10 QPS
- 需要多机部署

**架构**：
```
PostgreSQL（主从）
├── 关系数据
│   ├── messages（分区表，按时间）
│   ├── broods
│   ├── units
│   └── ledger
│
└── pgvector 扩展
    └── message_embeddings（向量索引，余弦相似度）
```

**不推荐 MySQL/MongoDB 的原因**：
- **MySQL**：JSON 查询能力弱于 PG，向量需外部服务
- **MongoDB**：弱事务（晋升/降级需要强一致性），层级关系用关系型更自然

#### Phase 4：专用存储（超大规模）

```
混合架构
├── PostgreSQL（关系数据：基因、战功、配置）
├── ClickHouse（时序分析：消息趋势、进化统计）
├── Redis（热缓存：活跃 Brood、在线 Unit）
└── 专用向量库（Milvus/Pinecone：语义检索）
```

---

## 4. 系统架构

### 4.1 模块交互图

```
用户输入: "帮我写个爬虫抓取豆瓣 Top250"
           ↓
┌─────────────────────────────────────────────────────────────┐
│  Channel: Trunk（主频道）                                    │
│  [用户可见：原始输入]                                         │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Overmind（主脑 / 主宰）L3                                    │
│  "战略判断：复杂任务，触发赛马"                               │
│  → 创建 Trial Group: crawler-race-001                        │
│  → 孵化 2 个试验 Submind                                     │
└──────────────┬───────────────────────────────────────────────┘
               ↓
    ┌──────────┴──────────┐
    ↓                     ↓
┌──────────────────┐ ┌──────────────────┐
│ Submind-A (Trial)│ │ Submind-B (Trial)│
│ 方案A: requests   │ │ 方案B: playwright│
└───────┬──────────┘ └───────┬──────────┘
        ↓                     ↓
┌──────────────────┐ ┌──────────────────┐
│ Trial Channel A  │ │ Trial Channel B  │
│ [用户可见]        │ │ [用户可见]        │
│ 中间对话流显示    │ │ 中间对话流显示    │
└───────┬──────────┘ └───────┬──────────┘
        │                     │
        ↓                     ↓
   [执行过程...]         [执行过程...]
        │                     │
        ↓                     ↓
┌──────────────────┐ ┌──────────────────┐
│ 结果A            │ │ 结果B            │
│ 成功率 95%       │ │ 成功率 98%       │
│ 耗时 30s         │ │ 耗时 36s         │
└──────────────────┘ └──────────────────┘
               │
               ↓
┌─────────────────────────────────────────────────────────────┐
│  Vision Arbiter（愿景分身 / 虫巢领主）                        │
│  "比较结果：方案B成功率更高，符合愿景"                        │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Evolution Master（进化大师 / 阿巴瑟）                        │
│  "分析两条路径的基因价值，建议采纳方案B的策略基因"            │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Overmind（收敛决策）                                         │
│  "选择方案B，淘汰方案A"                                       │
│  → Submind-B 转正为常驻                                       │
│  → Submind-A 休眠                                             │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Channel: Trunk（主频道）                                    │
│  [用户可见：最终结果 + 进化简报]                              │
│  "任务完成。采用 playwright 方案，成功率 98%。                │
│   Submind-B 表现优异，已晋升常驻代码专家。"                   │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 与现有模块的交互

| 现有模块 | 交互方式 |
|----------|----------|
| **Voice Pipeline** | 用户语音 → Overmind 入口（通过 Trunk Channel），虫群执行结果 → TTS 播报 |
| **Context Runtime** | 虫巢意识网复用 thread/session 机制，所有节点通过 ContextPacket 消费上下文 |
| **Execution Provider** | Unit（前端虫/后端虫等）通过 Browser/Desktop Provider 执行具体操作，Brood 内直接协作 |
| **Memory** | 战功记录写入 SQLite，基因库存储分层（Constitution/Playbook/Lessons），消息原文存 SQLite，向量检索用 Chroma |
| **WebSocket** | Trunk 默认广播到前端，Trial/Hive/Ledger 按需订阅 |

---

## 5. 实现文件清单

### 5.1 核心模块（v2.2 层级）

| 文件 | 职责 |
|------|------|
| `src/greywind/hive/overmind.py` | 主脑（L3）：战略决策、硬规则赛马触发、收敛仲裁 |
| `src/greywind/hive/evolution_master.py` | 进化大师（L3）：基因进化设计、策略优化、试验管理，有受限独立意志 |
| `src/greywind/hive/submind.py` | 小主脑（L2）：战术调度、任务分解、Brood 协调 |
| `src/greywind/hive/submind_registry.py` | 小主脑注册表：常驻/试验/休眠三态管理 |
| `src/greywind/hive/vision_arbiter.py` | 愿景判尺：愿景边界维护、赛马比较标准 |
| `src/greywind/hive/trial_race.py` | 赛马引擎：固定 2 路 Trial、隔离环境 |
| `src/greywind/hive/convergence_engine.py` | 收敛引擎：硬门槛筛选 + 软评分比较 |
| `src/greywind/hive/hive_container.py` | 虫巢容器（资源层）：Session 环境、资源配置 |
| `src/greywind/hive/brood.py` | 虫群工作组（L1）：动态组建、内部协作、任务分配 |
| `src/greywind/hive/unit.py` | 战斗单位（L0）：前端虫/后端虫/设计虫/审核虫 + ToolAction |
| `src/greywind/hive/tool_action.py` | 原子任务封装（原 Drone）：文件/浏览器/代码操作 |
| `src/greywind/hive/evolution_engine.py` | 进化引擎：四级惩罚、战功统计（由进化大师主导） |
| `src/greywind/hive/gene_seed.py` | 基因种子：三层基因库（Constitution/Playbook/Lessons） |
| `src/greywind/hive/synapse_net.py` | 虫巢意识网：ContextPacket 分发 |
| `src/greywind/hive/kill_mark.py` | 战功记录：任务评估、用户反馈 |
| `src/greywind/hive/trunk_protocol.py` | 主干协议：领导仪表盘视角、频道路由 |
| `src/greywind/hive/execution_guard.py` | 执行守护：运行时经验检查 |
| `src/greywind/hive/failure_capture.py` | 失败捕获：即时落盘 Lessons |
| `src/greywind/hive/lessons_bank.py` | 教训库：L3 层，30 天时效管理 |

### 5.2 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/greywind/persona/voice_pipeline.py` | 集成虫群入口（用户输入 → Overmind） |
| `src/greywind/context_runtime/prompt_assembler.py` | 支持三层基因注入（Constitution/Playbook/Lessons） |
| `src/greywind/server/ws_handler.py` | 支持 Trunk 默认广播 + Trial/Hive/Ledger 按需订阅 |
| `src/greywind/server/service_context.py` | 添加 HiveSystem 实例创建 |
| `src/greywind/config/models.py` | 新增 HiveConfig、TrialConfig（硬规则阈值） |
| `conf.yaml` | 新增 hive 配置段：赛马触发规则、基因库路径、惩罚阈值 |

### 5.3 基因库目录（v2.2 层级）

```
characters/gene_pool/
├── README.md                    # 基因库说明
├── constitution/                # L1: 极稳定规则（原 L4_overmind 核心）
│   ├── security.yaml            # 安全规范
│   ├── coding_standards.yaml    # 编码规范
│   └── review_baseline.yaml     # 审查底线
│
├── playbook/                    # L2: 领域经验（可版本化）
│   ├── designer/                # 设计虫
│   │   ├── ui_design.yaml
│   │   ├── ux_research.yaml
│   │   └── design_system.yaml
│   ├── frontend/                # 前端虫
│   │   ├── react.yaml
│   │   ├── vue.yaml
│   │   ├── css_architecture.yaml
│   │   └── failure_patterns/
│   ├── backend/                 # 后端虫
│   │   ├── api_design.yaml
│   │   ├── database.yaml
│   │   └── security.yaml
│   ├── reviewer/                # 审核虫
│   │   ├── code_review.yaml
│   │   └── anti_patterns/
│   └── common/                  # 通用 Unit 技能
│       ├── scout.yaml           # 侦察/搜索
│       ├── analyzer.yaml        # 分析/审查
│       └── coordinator.yaml     # 通信/协调
│
├── lessons/                     # L3: 近期教训（SQLite 平铺 + 自然衰减）
│   ├── lessons.db               # SQLite 主库（单文件）
│   └── README.md                # 查询/更新接口说明
│
├── registry/                    # 注册表（YAML）
│   ├── submind_registry.yaml    # Submind 常驻/试验/休眠状态
│   ├── brood_templates.yaml     # 优秀 Brood 配置模板
│   └── unit_manifest.yaml       # Unit 类型清单
│
└── ledger/                      # 进化记录
    ├── promotion_log.yaml
    ├── demotion_log.yaml
    ├── trial_log.yaml
    └── audit_log.yaml
```

---

## 6. Phase 计划（瘦身版）

### Phase E0 — 接口锁定

**目标**：冻结核心接口，避免后续重构

**交付物**：
- [ ] ContextPacket 类型定义
- [ ] BroodTask 类型定义
- [ ] Unit / Brood / Submind / Overmind 抽象接口
- [ ] Hive 容器接口（仅资源管理，无决策逻辑）

### Phase E1 — 单路跑通 + 基础 Brood

**目标**：实现最简单的多 Agent 协作链路（单路，无赛马）

**核心链路**：
```
用户输入 → Trunk → Overmind → Submind → Brood (2-3 个 Unit) → Review → 结果回 Trunk
```

**交付物**：
- [ ] Trunk 频道基础（领导仪表盘视角）
- [ ] Overmind 单路决策（不做赛马判断）
- [ ] 一个常驻 Submind（通用型）
- [ ] Brood 基础：动态组建、内部协作
- [ ] 2-3 个基础 Unit（前端虫、后端虫、审核虫）
- [ ] 消息持久化（SQLite）：原文存储、基础检索
- [ ] WebSocket 单频道广播（Trunk）

**明确不做**：
- ❌ 赛马（进 E2）
- ❌ 复杂度判断（进 E2）
- ❌ 基因库分层（进 E3）
- ❌ 晋升/降级（进 E3）
- ❌ 向量检索（进 E4）

### Phase E2 — 条件赛马

**目标**：在 E1 链路基础上增加赛马能力

**交付物**：
- [ ] 硬规则复杂度判断（4 个触发条件）
- [ ] 固定 2 路赛马实现
- [ ] Trial Panel（右侧详情面板）
- [ ] 隔离环境（独立频道/状态）
- [ ] 硬门槛 + 软评分收敛逻辑
- [ ] Vision Arbiter（愿景判尺）

### Phase E3 — 基因库 + 强制落盘 + 生命周期

**目标**：经验沉淀机制和 Submind 生命周期管理

**交付物**：
- [ ] 基因库三层结构（Constitution / Playbook / Lessons）
- [ ] Lessons 时效机制（30 天衰减）
- [ ] 强制落盘：启动加载、执行检查、失败写入
- [ ] Submind 三态管理（常驻/试验/休眠）
- [ ] 四级失败惩罚（Observe → Warn → Constrained → Dormant）
- [ ] Kill-mark 战功记录（内部评估，无排行榜）

### Phase E4 — 增强记忆 + Dashboard

**目标**：向量检索和可视化面板

**交付物**：
- [ ] Chroma 向量检索集成
- [ ] 事件驱动摘要（阶段摘要、Session 摘要）
- [ ] Ledger View 完整面板
- [ ] 简单可视化 Dashboard
- [ ] PostgreSQL 迁移（消息量 > 100 万时）

---

**核心原则**：
- E1 必须**完全跑通单路链路**才能进 E2
- 赛马是**可选增强**，不是默认行为
- 进化机制（晋升/降级/基因传播）在系统稳定后再引入

---

## 7. 待讨论要点（v2.2 精简版）

### 7.1 架构层面（Q1-Q4）

| 编号 | 问题 | 选项 | 当前倾向 |
|------|------|------|----------|
| Q1 | 晋升范围：全局有效还是领域内有效？ | A. 全局<br>B. 领域本地<br>C. 混合 | **C**（领域内快，全局难） |
| Q2 | Lessons 衰减策略：30 天是否过短？ | A. 30 天<br>B. 60 天<br>C. 90 天 | **A**（先激进，后可调） |
| Q3 | Overmind 实例：一个 Thread 是否总映射一个 Overmind？ | A. 一对一<br>B. 一对多<br>C. 多对一 | **A** |
| Q4 | 四级惩罚的 Constrained 模式具体限制？ | A. 仅低风险任务<br>B. 必须人工确认<br>C. 限制工具范围 | **A** |

### 7.2 命名层面（Q5-Q6）

| 编号 | 问题 | 选项 | 备注 |
|------|------|------|------|
| Q5 | 代码命名是否全英文？ | A. 全英文（Coordinator/TaskGroup/Executor）<br>B. 保留 Tyranid 隐喻 | **A**（代码功能性命名） |
| Q6 | 产品文档是否保留虫族隐喻？ | A. 保留（Overmind/Brood/Unit）<br>B. 全功能性 | **A**（产品侧保留风格） |

### 7.3 实现层面（Q7-Q10）

| 编号 | 问题 | 选项 | 当前倾向 |
|------|------|------|----------|
| Q7 | Constitution/Playbook 存储格式 | A. YAML<br>B. JSON<br>C. SQLite | **A→C 分阶段** |
| Q8 | Lessons 存储格式 | A. JSONL（追加写）<br>B. SQLite<br>C. 内存 | **A**（高频写入） |
| Q9 | 战功评估算法权重 | 质量/成本/速度/满意度 | 40%/20%/20%/20% |
| Q10 | 与 Voice Pipeline 集成：虫群入口放哪？ | A. 替换<br>B. 作为 stage<br>C. 独立模块 | **C** |

### 7.4 v2.2 新增问题（Q11-Q15）

| 编号 | 问题 | 选项 | 当前倾向 |
|------|------|------|----------|
| Q11 | 硬规则赛马触发阈值：几项满足才触发？ | A. 1 项<br>B. 2 项<br>C. 3 项 | **B** |
| Q12 | Trial Panel 默认展开条件？ | A. 手动<br>B. 任务复杂度高<br>C. 分支数>1 | **A** |
| Q13 | Lessons 归档后是否可恢复？ | A. 可查询但不入 prompt<br>B. 完全删除<br>C. 可手动恢复 | **A** |
| Q14 | Constrained Unit 如何恢复？ | A. 完成 3 个低风险任务<br>B. 时间解锁<br>C. 人工解锁 | **A** |
| Q15 | 代码命名具体方案？ | A. Overmind→Coordinator<br>B. 保留<br>C. 混合 | **C**（核心概念保留，内部功能性） |

---

## 8. 风险与应对（v2.2）

| 风险 | 可能性 | 影响 | 应对策略 |
|------|--------|------|----------|
| Lessons 衰减过快导致经验丢失 | 中 | 中 | 先 30 天激进策略，观察后调整 |
| 硬规则赛马触发条件不准确 | 中 | 高 | 配置化阈值 + 运行后调参 |
| 频道折叠导致用户找不到详情 | 低 | 中 | UI 引导 + 首次使用教程 |
| 基因库三层边界模糊 | 中 | 中 | 严格定义：Constitution 极少更新，Playbook 版本化，Lessons 时效化 |
| SQLite Lessons 写入性能瓶颈 | 中 | 中 | Phase 1 用 JSONL 追加写，Phase 3 迁移 |
| 四级惩罚误杀高价值 Unit | 低 | 高 | 失败分类（环境失败不惩罚）+ 同域同约束匹配 |
| Trial Panel 用户体验 | 中 | 中 | 渐进式展示，简单任务默认折叠 |
| 层级压缩后职责重叠 | 中 | 高 | 硬边界定义：Hive 不参与决策，Unit 不负责调度 |

---

## 9. 最终规则集（v2.2）

1. **Trunk 默认展开，其他频道折叠** —— 领导仪表盘视角，详情面板按需展开
2. **用户可在 Trunk 参与对话** —— 可 @mention 主脑/小主脑
3. **简单任务不弹出 Trial Panel** —— 复杂任务或用户主动点开时才展开
4. **层级压缩为 4 层** —— Overmind/Submind/Brood/Unit，Drone 并入 Unit 的 ToolAction
5. **Hive 退化为资源容器** —— 不参与决策，仅提供 Session 级环境
6. **赛马固定两路 + 硬规则触发** —— 满足 2 项以上条件才允许 Trial，不允许动态分支
7. **收敛两层判据** —— 硬门槛筛选 + 软评分比较
8. **基因库分层** —— Constitution（直灌）/ Playbook（检索）/ Lessons（时效）
9. **Lessons 30 天衰减归档** —— 避免 prompt 膨胀
10. **失败四级递进** —— Observe → Warn → Constrained → Dormant，避免误杀
11. **失败分类处理** —— 环境失败不惩罚，策略/质量失败才触发降级
12. **Overmind 是线程级唯一主动权威** —— Vision Arbiter 和 Evolution Master 均不是第二主权
13. **竞争必须隔离** —— 禁止多分支污染同一状态
14. **简单任务优先单路** —— 复杂任务才触发条件赛马
15. **Submind 默认复用** —— 新增必须有明确试验理由
16. **晋升依赖内部评估** —— 不做竞技排行榜
17. **失败分支可灭绝** —— 但不应污染主干连续性
18. **进化必须可审计** —— 所有选择都有 Ledger 记录
19. **经验强制落盘** —— 不看也得看，不写也得写
20. **事件驱动摘要** —— 优先按任务节点触发，非固定消息数
21. **进化大师有受限独立意志** —— 在进化领域可自主判断，但不得绕过主脑调度或对外发言
22. **进化大师主导基因库** —— Constitution/Playbook 由进化大师维护，Lessons 自动落盘后由进化大师审查升级

---

## 10. 参考对比

| 维度 | OpenRoom | Cat Cafe | 当皇上 | **GreyWind 虫群 v2.2** |
|------|----------|----------|--------|------------------------|
| **Agent 关系** | 双 Agent 固定协作 | 三 Agent 固定协作 | 静态六部 | **4 层动态等级（精简）** |
| **任务分配** | 浏览器 Agent 判断 | @mention 路由 | 司礼监派发 | **战功驱动的晋升调度** |
| **用户可见性** | 内部隐藏 | 频道可见 | 内部隐藏 | **Trunk 领导视角 + 详情折叠** |
| **竞争机制** | 无 | 无 | 无 | **硬规则触发 + 固定 2 路赛马** |
| **记忆模型** | App 本地存储 | Session Chain | SQLite 独立 | **虫巢意识网 + 分层基因库** |
| **消息持久化** | 无 | 数据库存储 | 无 | **原文保留 + 事件驱动摘要** |
| **专家角色** | 粗粒度 | 粗粒度 | 粗粒度 | **Unit + ToolAction（原 Drone）** |
| **经验沉淀** | 无 | 无 | 无 | **三层基因 + 四级惩罚** |
| **存储架构** | 简单 JSON | 数据库 | 文件 | **SQLite→PG 分阶段演进** |
| **失败处理** | 重试 | 三层防线 | 人工介入 | **分类处理 + 四级递进** |
| **核心隐喻** | 桌面 OS | 猫咖协作 | 明朝官场 | **泰伦虫族 + 星际异虫** |
| **调度算法** | 固定流程 | 专家判断 | 层级审批 | **战功累进 + 自然选择** |

---

*文档版本：v3.0*
*修订记录：*
- *v2.1 → v2.2：压缩层级（6→4）、收紧赛马（硬规则+固定2路）、分层基因库（Constitution/Playbook/Lessons）、频道折叠（Trunk默认展开）、四级失败惩罚、Lessons SQLite平铺+自然衰减+自我细化*
- *v2.2 → v3.0：术语对齐泰伦虫族/星际争霸异虫设定（术语映射表）、新增进化大师角色（对标诺恩后虫+阿巴瑟，有受限独立意志，主导进化层）、等级体系加虫族对照列、系统架构图加入进化大师节点*
