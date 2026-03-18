# 硬规则 — Git / Worktree / CR

- **所有改动必须 worktree**（DEV-4）：任何会产生 git diff 的工作都必须在独立 worktree 中进行。唯一例外：worktree 创建命令本身
- **主仓库禁止切分支**（DEV-74）：主仓库目录禁止 `git checkout <branch>` / `git switch`
- **worktree 合回前确认分支**（DEV-67）：合回前必须 `git branch` 确认当前分支是目标分支
- **PR/CR 链接直入 worktree**：用户给 PR 链接要求修时，第一动作必须是门禁声明 + 创建独立 CR worktree
- **CR 修复必须 worktree**：所有 CR 修复在独立 worktree 中进行，流程见 `worktree-workflow.md`
- **CR 闭环**（DEV-68）：①修复+推送 ②回复 PR review comment ③执行出错自动落盘流程 ④输出"CR 闭环完成"标记
- **构建元数据必须取自产物来源**（DEV-64）：禁止用宿主机环境推断
- **提交前自验证**（DEV-89）：提交 commit / 开 PR 前必须完成：①实际运行验证（导入链路、核心功能端到端调用）②对每个新增/修改文件做 code review（检查遗漏、错误、与现有代码的一致性）③CR 发现问题修复后必须再跑一轮验证，P0/P1/P2 全部归零才能提交（第一轮发现 → 修复 → 第二轮确认归零）。未完成就提交 = 流程违规
- **README 完成状态核实**（DEV-94）：改动涉及 README 功能完成状态（✅/标记）时，提交前必须核实：①默认安装路径能否直接使用（检查 pyproject.toml extras / conf 默认值）②文案技术描述与当前代码实现一致（grep 确认）。有前提条件的必须在括号里注明
- **禁止语法检查冒充真实验证**（DEV-90）：`ast.parse` / `python -c "import ast"` / `node -e "new Function(...)"` 等纯语法检查不算"实际运行验证"。必须用项目要求的 Python 版本（≥3.10）在真实环境中导入模块、验证端点注册、调用核心函数。本地 Python 版本不符时，用 `py -3.13` 或创建临时 venv，不能降级验证标准
- **默认值/fallback 不得覆盖用户显式配置**（DEV-92）：写 `max()`/`min()`/`or default` 时必须推演"用户显式配了极端值"的场景。兜底值只在无有效配置时生效，禁止与用户显式值取 max/min 导致配置失效
- **配置变更+副作用必须原子化**（DEV-93）：先改 config 再执行副作用（创建对象、连接服务等）时，副作用失败必须回滚 config 并返回错误。禁止 config 已改但副作用失败后静默吞掉，导致前后端状态分裂
