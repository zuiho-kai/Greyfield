# 错题本 — Git / Worktree / CR 流程

> 适用场景：CR 处理、worktree 操作、分支管理

### 记录规则

- **条目结构**：❌ 错误做法 + ✅ 正确做法，整条控制在 **5 行以内**
- **❌/✅ 写法**：只写核心规则，禁止多层加粗嵌套（加粗最多一层）
- **`>` 注释**：只放归因和 postmortem 链接，禁止复述场景
- **复犯**：只追加频率标记（🟡×N / 🔴×N）
- **归属**：条目只写本范围内容，跨范围写到对应文件

### DEV-42 对话开头环境指令未执行就动手 `🟢`

❌ 用户开头说"用 worktree/切分支"，后续遗忘直接在 main 上改
✅ 第一次 Edit/Write/Bash(git) 前回溯对话开头确认工作环境，指定了就先执行，未就绪不动手

### DEV-67 worktree 操作前未确认当前分支 `🟢`

❌ 创建 worktree 后直接在主仓库目录 `git merge`，没确认当前分支，导致合到了错误分支，需要 reset + cherry-pick 补救
✅ worktree 修复合回前，先 `git branch` 确认当前分支是目标分支，再执行 merge/cherry-pick
> 归因：假设"当前分支 = 会话开头的分支"，没考虑工作目录可能已切换过分支

### DEV-74 主仓库里 checkout 切分支污染工作区 `🟢`

❌ 为了"确认代码状态"在主仓库 `git checkout` 到目标分支，读完代码后忘记切回，主仓库分支被污染
✅ 主仓库禁止 `git checkout <branch>` / `git switch`。需要读其他分支的代码 → 创建 worktree 或在已有 worktree 里读
> 归因：把 checkout 当成"只读操作"，没意识到它改变了主仓库的分支指针

### DEV-68 CR 处理未完成闭环 `🟢`

❌ 修复并推送后漏掉回复 review comment / 落盘 / 输出标记中的任一步，导致闭环不完整
✅ CR 闭环四步缺一不可：①修复+推送 ②回复 PR review comment ③执行出错自动落盘 ④输出"CR 闭环完成"标记
> 归因：把"代码推上去"当成任务完成，忽略了后续沟通和落盘步骤

### DEV-79 操作 PR 前未确认 head branch `🟢`

❌ 拿到 PR 链接后凭编号猜对应分支，操作了错误分支，白跑多轮
✅ 操作任何 PR 前必须先抓取 PR 页面（WebFetch）确认 head branch，再找对应 worktree
> 归因 C：现有"改前 grep"规则只覆盖代码，未覆盖 PR 元数据确认场景

### DEV-76 worktree 改完直接本地 merge，跳过 PR `🟢`

❌ worktree 分支改完后在主仓库执行 `git merge <branch>`，直接合入，绕过 PR review
✅ worktree 改完 → `git push` 推远端 → GitHub 开 PR → 合并。主仓库禁止执行 `git merge` 合入功能分支

