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

## 🚫 Module 开发流程（硬卡点）

启动任何新 Module（不在当前 `spine-now.md` 冻结范围内的能力）前，**必须按顺序走完以下 5 步**。跳步 = 流程违规，触发 DEV-4 计数。

```
Step 1 — Vision（愿景对齐）
  读 architecture-v2.md + context-runtime.md
  确认该 Module 在中轴里的位置和边界
  输出：一句话定位 + 与中轴的关系

Step 2 — Architecture（架构卡位）
  确认该 Module 的接口边界、数据流向、与现有模块的交互点
  输出：模块交互图（文字版即可）+ 新增/修改的文件清单

Step 3 — Spine-now（冻结范围更新）
  将该 Module 的最小可用定义写入 spine-now.md
  明确：必须有的能力 / 必须有的体验 / 明确不做的
  输出：spine-now.md 的 diff

Step 4 — Mini SR（最小规格评审）
  列出：验收标准（怎样算做完）+ 技术风险点 + 平台能力边界确认
  用户确认后才能进入实现
  输出：验收 checklist

Step 5 — Implementation（实现）
  按 Step 3 冻结的范围写代码，不超范围
```

每一步的输出必须落盘到文档或对话中，口头过不算。Step 4 用户未确认前禁止进入 Step 5。

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

## 🚫 任务入口门禁（硬卡点）

接到任何会产生 git diff 的任务后，**必须先输出入口门禁声明**，再做任何分析/读代码/写代码。不输出就动手 = DEV-4 违规。

```
--- 任务入口门禁 ---
任务：[一句话描述]
worktree：[已就绪(路径/分支名) | 需要创建 → 先执行创建命令]
退出路径：worktree 改完 → git push → 开 PR → 禁止本地 git merge 进主仓库
门禁结论：[可以开始 | 需要先完成 XXX]
--------------------
```

## 🚫 修复门禁（硬卡点）

对同一功能/链路提交第 2 次 fix commit 前，**必须先输出修复门禁声明**，再写任何代码。不输出就动手 = DEV-83 违规。

```
--- 修复门禁 ---
功能/链路：[一句话描述修的是什么]
已有 fix 次数：[git log --oneline 计数]
每次 fix 摘要：[第 N 次改了什么 → 为什么没解决]
平台验证：[已做最小复现 / 已搜 Issues / 不涉及平台 API]
门禁结论：[继续当前路径(≤2次) | 强制停下换路径(≥3次)]
--------------------
```

累计 ≥3 次时，门禁结论必须是"强制停下换路径"，禁止继续当前链路。

## Token 节省规则

- **禁止全量 Read 大文件**（DEV-60）：文件 >200 行 → 必须先 Grep 定位行号再局部 Read（带 `offset` + `limit`）
- **子 agent 精简输入**（DEV-61）：子 agent prompt 只附相关源码片段（≤150 行），不附整个模块，不传 CLAUDE.md
- **探索前先查索引**（DEV-62）：新 session 开局先读 CLAUDE.md + `docs/MAP.md`，再按需定位文件

## 🚫 硬规则加载（硬卡点）

硬规则按类别拆到 `docs/rules/` 目录。执行任务前**必须按任务类型读对应文件**，不读就动手 = 流程违规。

| 任务类型 | 必读文件 |
|----------|----------|
| 写代码 / 改文件 | `docs/rules/tool-write.md` + `docs/rules/code-quality.md` |
| 走流程 / 提问 / 等确认 | `docs/rules/flow-interact.md` |
| 修 bug / 调试 | `docs/rules/debug-fix.md` |
| git 操作 / CR / PR | `docs/rules/git-cr.md` |
| 抓网页 / 外网请求 | `docs/rules/network.md` |
| 涉及平台 API | `docs/rules/debug-fix.md` |

高频提醒（不替代读原文）：
- **所有改动必须 worktree**（DEV-4）
- **Write 强制分步**（DEV-8）：>50 行先骨架再分段填充
- **提问即交权**（DEV-53）：提问后只等回答，不执行
- **两次失败必须搜索**（COMMON-9）
- **网络代理**：所有外网请求走 `http://127.0.0.1:7890`

## 速查

| 类别 | 路径 |
|------|------|
| 文档地图 | `docs/MAP.md` |
| 文档索引 | `docs/INDEX.md` |
| 当前 Spine | `docs/spine-now.md` |
| 实施规格 | `docs/greywind-implementation-spec.md` |
| 系统架构 | `docs/architecture-v2.md` |
| 上下文运行时 | `docs/context-runtime.md` |
| 通用硬规则 | `docs/rules/`（按任务类型分文件） |
| 错题本入口 | `docs/engineering-lessons.md` |
| 错题本目录 | `docs/error-books/` |
