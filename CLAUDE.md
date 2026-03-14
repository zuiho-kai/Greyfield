# GreyWind（灰风）— 桌面 AI 伴侣

> 自动加载：本文件 | 详细文档按需读取：`docs/`

## 语言

全中文输出：所有对话、文档、注释、commit message 一律使用中文。

## 开发模式：愿景生长

本项目采用愿景生长模式（Vision-First + Minimal Spine），不使用自上而下的里程碑门控。

核心原则：
- 长期愿景由 `docs/architecture-v2.md` 和 `docs/context-runtime.md` 锁定
- 当前实现边界由 `docs/spine-now.md` 冻结
- Spine 先活起来，Module 再逐步长出来
- 不在 `spine-now.md` 里的能力，默认不提前做
- **守护生长模式**：如果用户提出的想法不符合愿景生长模式（如跳步、提前做未冻结能力、自上而下规划），必须立即指出并说明原因，不能默默执行

## 名字由来

灰风（GreyWind）的名字来自群星（Stellaris）的**灰蛊风暴（Grey Tempest）**，不是权力的游戏的冰原狼。

## 错题本

错题本在 `docs/error-books/`，从 bot_civ 项目复用通用条目。

加载策略：
1. 每次必读 `_index.md`（速查索引）+ `flow-rules.md`（子文件索引）
2. 根据任务类型读对应子文件：
   - 走流程 → `flow-gate.md`
   - 改代码 → `flow-code-habit.md`
   - 写设计 → `flow-design.md`
   - 改前后端对接 → `interface-rules.md`
   - 用工具踩坑 → `tool-rules.md`
3. 通用错误 → `common-mistakes.md`
4. 不相关的文件不读

遇到新错误按格式追加到对应文件，同时更新 `_index.md`。

**出错自动落盘**：满足以下任一条件时，无需用户提醒，自动执行 `docs/error-books/checklist-error-landing.md` 流程：
- CR 发现 P0 / 测试失败 / 同一错误连续 2 次 / 用户指出流程违规 / 实现与设计不一致
- 流程核心：归因分析（A/B/C/D 四条路径）→ 读记录规则 → 落盘 → 复盘

**CR 修复闭环门禁**：见通用硬规则 DEV-68。未完成全部步骤就总结收工 = 流程违规，触发 DEV-4 计数。

## Token 节省规则

- **禁止全量 Read 大文件**（DEV-60）：文件 >200 行 → 必须先 Grep 定位行号再局部 Read（带 `offset` + `limit`），禁止全量 Read
- **子 agent 精简输入**（DEV-61）：子 agent prompt 只附相关源码片段（≤150 行），不附整个模块，不传 CLAUDE.md
- **探索前先查索引**（DEV-62）：新 session 开局先读 CLAUDE.md + `docs/MAP.md`，再按需定位文件，禁止上来就 `Glob **/*` 全量探索
- **能 Edit 不 Write**（DEV-63）：能用 Edit 局部修改就不用 Write 重写整个文件

## 通用硬规则

- **Write 强制分步**（DEV-8）：≤50 行可一次 Write；>50 行先 Write 骨架再 Edit 分段填充，每段 ≤50 行。Write 失败 1 次 → 切 Bash heredoc。禁止同一方式连续失败超过 2 次
- **工具熔断**：同一工具连续失败 2 次同一错误 → 停下换思路，禁止第 3 次盲重试
- **提问即交权**（DEV-53）：同一轮消息禁止"提问 + 执行"并存。提问后唯一允许的动作是等用户回答
- **LLM 输出防御**（DEV-BUG-16）：接收 LLM 输出的 Pydantic model 必须加 validator/coerce/strip
- **分支矩阵全覆盖**（DEV-BUG-17）：含分支逻辑必须列矩阵逐格实现和测试
- **流式状态机边界检查**（DEV-71）：写/改流式处理逻辑时，必须逐项验证：①操作顺序（过滤在拆分前还是后）②标签/定界符被 chunk 边界拆开 ③流结束时缓冲区 flush ④空 chunk / 单字符 chunk ⑤过滤后数据的所有下游（输出、持久化、日志）都用过滤后版本。缺任一项 = 未完成
- **防丢失**：对话是临时的，文件是持久的（COMMON-1）
- **不做口头承诺**：教训/流程改进发现当下直接写入文件（COMMON-12）
- **两次失败必须搜索**：连续猜方案失败两次后停下搜索根因（COMMON-9）
- **CR 修复必须 worktree**：PR 收到 code review 反馈后，所有修复工作必须在独立 worktree 中进行（`git worktree add ../Greyfield-cr-<PR号> -b fix/pr<PR号>-cr <当前分支>`），修完合回原分支再推送。流程见 `docs/worktree-workflow.md`
- **CR 闭环**（DEV-68）：CR 处理必须依次完成以下步骤才算闭环，缺一不可：①修复+推送 ②回复 PR review comment ③执行出错自动落盘流程 ④输出"CR 闭环完成"标记
- **worktree 合回前确认分支**（DEV-67）：worktree 修复合回主仓库前，必须 `git branch` 确认当前分支是目标分支，禁止盲 merge
- **构建元数据必须取自产物来源**（DEV-64）：构建脚本中影响产物兼容性的元数据（版本号、架构、平台），必须从产物实际来源获取（如 `.venv` 解释器），禁止用宿主机环境推断
- **所有改动必须 worktree**（DEV-4）：任何会产生 git diff 的工作（功能代码、规则文件、文档、错题本）都必须在独立 worktree 中进行。禁止直接在主仓库目录修改任何文件。唯一例外：worktree 创建命令本身
- **改前 grep**：改代码前 grep 全量引用 + grep 同类 pattern 复用（DEV-6）
- **网络代理**：所有外网请求走 `http://127.0.0.1:7890`
- **禁止脑补**：所有操作（写内容、做愿景、搜索、设计等）必须基于已确认的信息。抓取/搜索失败时不要用猜测的内容代替，必须先确认再写
- **网页抓取降级链**：需要抓取网页内容时，按以下顺序尝试，前一步失败再进下一步：
  1. WebFetch（最快，优先用）
  2. agent-browser（无头浏览器，能处理 SPA）
  3. Bash 调用 Scrapling（`python -m scrapling fetch <url>`）
  4. Bash 调用 Playwright 连接用户本地浏览器（`playwright open <url>`，最后手段）
  - **禁止链外工具**（DEV-58）：curl/wget/requests 等不在降级链里，任何时候都不得用于抓取网页内容
  - **禁止编造**（DEV-59）：全链路失败 = 没有数据。如实告知用户，不得从 URL、标题或上下文"推测"页面内容

## 速查

| 类别 | 路径 |
|------|------|
| 文档地图 | `docs/MAP.md` |
| 文档索引 | `docs/INDEX.md` |
| 当前 Spine | `docs/spine-now.md` |
| 实施规格 | `docs/greywind-implementation-spec.md` |
| 系统架构 | `docs/architecture-v2.md` |
| 上下文运行时 | `docs/context-runtime.md` |
| 错题本入口 | `docs/engineering-lessons.md` |
| 错题本目录 | `docs/error-books/` |
