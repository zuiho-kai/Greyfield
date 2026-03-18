# 硬规则 — Git / Worktree / CR

- **所有改动必须 worktree**（DEV-4）：任何会产生 git diff 的工作都必须在独立 worktree 中进行。唯一例外：worktree 创建命令本身
- **主仓库禁止切分支**（DEV-74）：主仓库目录禁止 `git checkout <branch>` / `git switch`
- **worktree 合回前确认分支**（DEV-67）：合回前必须 `git branch` 确认当前分支是目标分支
- **PR/CR 链接直入 worktree**：用户给 PR 链接要求修时，第一动作必须是门禁声明 + 创建独立 CR worktree
- **CR 修复必须 worktree**：所有 CR 修复在独立 worktree 中进行，流程见 `worktree-workflow.md`
- **CR 闭环**（DEV-68）：①修复+推送 ②回复 PR review comment ③执行出错自动落盘流程 ④输出"CR 闭环完成"标记
- **构建元数据必须取自产物来源**（DEV-64）：禁止用宿主机环境推断
- **提交前自验证**（DEV-89）：提交 commit / 开 PR 前必须完成：①实际运行验证（导入链路、核心功能端到端调用）②对每个新增/修改文件做 code review（检查遗漏、错误、与现有代码的一致性）③CR 发现问题修复后必须再跑一轮验证，P0/P1/P2 全部归零才能提交（第一轮发现 → 修复 → 第二轮确认归零）。未完成就提交 = 流程违规
