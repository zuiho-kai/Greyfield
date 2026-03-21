# 错题本速查索引

> **加载规则**：每次必读本文件 + `flow-rules.md`（索引页），再根据任务类型读对应子文件。

| 编号 | 一句话 | 标签 | 频率 | 文件 |
|------|--------|------|------|------|
| DEV-4 | 跳过流程门控直接编码 | 门控/流程 | 🔴×21 | flow-gate.md |
| DEV-5 | 实施不遵循设计文档 | 门控/流程 | 🟢 | flow-gate.md |
| DEV-42 | 对话开头环境指令未执行就动手 | git/CR | 🟢 | git-worktree.md |
| DEV-53 | 问了用户但不等回答就自己执行 | 门控/流程 | 🟢 | flow-gate.md |
| DEV-61 | 交付前不做开发自验证 | 门控/流程 | 🟢 | flow-gate.md |
| DEV-80 | 实现前未横向对比同类项目方案 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-81 | 在错误链路上叠补丁不回退找根因（补丁螺旋）| 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-82 | 平台 API 问题未做最小复现就动手修 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-83 | 同一功能/链路连续 3 次 fix commit 未强制停下 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-84 | 平台能力边界未确认就写应用层代码 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-85 | 修复结论无证据，滥用"根治/彻底修复" | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-6 | 改代码不 grep 引用/不复用 pattern | 代码习惯 | 🟡×3 | flow-code-habit.md |
| DEV-24 | 更新文档只改局部不扫全文 | 代码习惯 | 🟡×4 | flow-code-habit.md |
| DEV-29 | P0/P1 修复列表漏项+执行碎片化 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-47 | 批量/seed 幂等设计未考虑"部分成功" | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-63 | Review 评论不贴合现状时未做等价落地 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-69 | 文档中硬编码环境相关值（分支名、路径格式） | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-77 | 文档引用外部链接未验证有效性 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-78 | 流程文档 shell 命令未标注执行目录 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-86 | 重数据经渲染进程中转导致 UI 卡顿 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-102 | 为了改动小而选择脏方案 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-88 | 未验证第三方库底层实现就采用 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-103 | 副作用时序：先扣费/计数后调用外部服务 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-71 | 流式状态机边界条件遗漏 | 流式/运行时 | 🟡×3 | streaming-runtime.md |
| DEV-72 | 新功能前端无条件启动，未与后端配置协商 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-67 | worktree 操作前未确认当前分支 | git/CR | 🟢 | git-worktree.md |
| DEV-74 | 主仓库里 checkout 切分支污染工作区 | git/CR | 🟢 | git-worktree.md |
| DEV-68 | CR 处理未完成闭环 | git/CR | 🟢 | git-worktree.md |
| DEV-79 | 操作 PR 前未确认 head branch | git/CR | 🟢 | git-worktree.md |
| DEV-76 | worktree 改完直接本地 merge 跳过 PR | git/CR | 🟢 | git-worktree.md |
| DEV-64 | 构建脚本数据源与运行时环境不一致 | 构建/打包 | 🟡×3 | build-packaging.md |
| DEV-65 | 跨平台路径拼接用了宿主机 path API | 构建/打包 | 🟢 | build-packaging.md |
| DEV-75 | 跨平台 API 降级只做初始化不做运行时兜底 | 构建/打包 | 🟢 | build-packaging.md |
| DEV-108 | CI cache post-step 在实际 step 被跳过时找不到路径报错 | 构建/打包 | 🟢 | build-packaging.md |
| DEV-60 | 隔离对象但共享有状态引用 | 流式/运行时 | 🟢 | streaming-runtime.md |
| DEV-66 | 实时通道断线缓冲未区分消息时效性 | 流式/运行时 | 🟢 | streaming-runtime.md |
| DEV-70 | 流式清洗逻辑未处理标签跨 chunk 拆分 | 流式/运行时 | 🟡×2 | streaming-runtime.md |
| DEV-73 | 有状态组件放全局单例，跨连接共享脏状态 | 流式/运行时 | 🟢 | streaming-runtime.md |
| DEV-3 | 联调问题用双终端来回排查 | 通用/工具 | 🟢 | tool-rules.md |
| DEV-8 | Write 工具调用反复失败 | 通用/工具 | 🔴×5 | tool-rules.md |
| DEV-12 | 外部 CLI 跳过环境探针+串行试错 | 通用/工具 | 🟡×2 | tool-rules.md |
| DEV-13 | 用户说"用 CLI"仍绕路打 REST API | 通用/工具 | 🟢 | tool-rules.md |
| DEV-16 | 调研任务串行搜索 | 通用/工具 | 🟢 | tool-rules.md |
| DEV-31 | 网页搜索走 curl 而非浏览器 | 通用/工具 | 🟢 | tool-rules.md |
| DEV-35 | Stop Hook 持续循环 | 通用/工具 | 🟢 | tool-rules.md |
| DEV-36 | 插件 hook 报错定位慢 | 通用/工具 | 🟢 | tool-rules.md |
| DEV-54 | 新脚本猜 API 端点不查已有脚本 | 通用/工具 | 🟢 | tool-rules.md |
| DEV-56 | 新脚本重写逻辑不复用已有框架 | 通用/工具 | 🟢 | tool-rules.md |
| DEV-57 | Bash heredoc 大段 JS 单引号冲突 | 通用/工具 | 🟢 | tool-rules.md |
| DEV-58 | 降级链跳步，跳过中间步骤 | 通用/工具 | 🟡×2 | tool-rules.md |
| DEV-59 | 抓取失败后编造内容 | 通用/工具 | 🟢 | tool-rules.md |
| DEV-1 | 后端终端改了前端文件 | 通用/接口 | 🟢 | interface-rules.md |
| DEV-2 | 改接口没更新契约文档 | 通用/接口 | 🟢 | interface-rules.md |
| DEV-11c | 前端凭记忆写后端接口信息 | 前端/接口 | 🟡×2 | interface-rules.md |
| DEV-38 | 编码前跳过架构风险分析 | 通用/设计 | 🟢 | flow-design.md |
| DEV-40 | 功能设计脱离基础设施现实 | 通用/设计 | 🟢 | flow-design.md |
| DEV-44 | 设计文档与代码签名不同步 | 通用/设计 | 🟢 | flow-design.md |
| DEV-76 | 口头承诺不落盘 | 门控/流程 | 🟢 | flow-gate.md |
| DEV-90 | 语法检查/读代码冒充真实验证 | 门控/流程 | 🟡×2 | flow-gate.md |
| DEV-96 | 搬运/迁移时批量操作关闭逐条审查 | 门控/流程 | 🟢 | flow-gate.md |
| DEV-33 | pytest/语法检查冒充 ST | 门控/流程 | 🟢 | flow-gate.md |
| COMMON-15 | 实现完成后跳过 CR 直接进入下一步 | 通用 | 🟢 | common-mistakes.md |
| COMMON-18 | CR 修复后跳过重新 Review | 通用 | 🟢 | common-mistakes.md |
| COMMON-19 | 向用户提交决策时违反呈现三原则 | 通用 | 🟢 | common-mistakes.md |
| DEV-91 | 终端应用套用库的 optional deps 模式 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-92 | 默认值/fallback 覆盖用户显式配置 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-93 | 配置变更+副作用失败不回滚，状态分裂 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-97 | 修 bug 缺边界分析，修复引入新问题 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-98 | 外部 client/资源未用 context manager + 返回值盲信 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-99 | 大量 UI/前端改动一口气写完不分步检查 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-100 | 多问题批量修复不分类并行 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-101 | API 边界防御缺失 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-104 | 代码搬迁只验功能可用，未检查隐式依赖 | 代码习惯 | 🟢 | flow-code-habit.md |
| DEV-107 | E2E 测试未隔离被测 App 的自启动后端，mock server 被杀死 | 代码习惯 | 🟢 | flow-code-habit.md |
| REC-1~6 | 记录员典型错误（讨论没落盘等） | 通用/记录 | 🟢 | error-book-recorder.md |
| DEV-94 | README 完成状态与实际启用条件/实现方案不一致 | 代码习惯 | 🟢 | flow-code-habit.md |
