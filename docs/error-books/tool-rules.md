# 错题本 — 通用/工具

### 记录规则

- **条目只写核心规则**（❌/✅/一句话解释），控制在 **5 行以内**
- 详细复盘放独立 postmortem 文件，这里只放链接

### DEV-3 联调问题用双终端来回排查 `🟢`

❌ WebSocket 消息收不到，前端终端查一遍、后端终端查一遍，来回沟通
✅ 跨层问题用 Agent Team 联调（协调者 + 前端调试者 + 后端调试者）
> 简单问题单终端修，跨层问题用 Agent Team。

### DEV-8 Write 工具调用缺少 content 参数反复失败 `🔴高频×5`

❌ 长文件生成时连续发空 Write 调用（无 content），五次复犯。根因：一次性生成超长 content 导致参数被截断，模型自己感知不到截断发生
✅ ≤100 行正常 Write；>100 行先 Write 前 50 行骨架再 Edit 追加每段 ≤50 行。Write 失败 1 次 → 切 Bash `cat <<'EOF' > file`；Bash 也失败 → 继续拆小段。禁止同一方式连续失败超过 2 次
> 唯一有效对策是把单次 Write 上限压到 30 行以内，从结构上规避截断。

### DEV-12 外部进程/CLI 排查：跳过环境探针 + 串行试错 `🟡中频×2`

❌ 直接写脚本遇到 PATH/代理/认证/quota 逐个补救；一次只验证一个假设，每次撞墙等超时才换方向
✅ 集成外部 CLI 前先做环境全景扫描：① which ② HTTPS_PROXY/直连 ③ 认证配置路径 ④ 手动测一条命令。多假设并行验证不串行等超时
> 429 有 retryDelay = RPM 限制（等）；无 = 真用尽

### DEV-13 用户说"用 CLI"，仍然自行绕路直接打 REST API `🟢`

❌ 用户明确说"用 CLI"，脚本里还是用 fetch 打 REST；CLI 报错就转 API key 绕路
✅ "用 CLI"= subprocess 是唯一路径，CLI 报错 → 报给用户，不绕路
> 用户指定的工具 = 硬约束，不是"优先项"。

### DEV-16 调研任务串行搜索 `🟢`

❌ 调研任务时，把 4 个独立子主题塞进 1 个 subagent 串行搜索
✅ 搜索关键词超过 2 组时，拆成多个并行 Task agent 分头搜索，最后汇总

### DEV-31 网页搜索走 curl 而非浏览器 → SPA 页面拿不到内容 `🟢`

❌ 查文档时用 curl 抓 SPA 页面，拿到的全是空壳 HTML
✅ SPA/动态页面必须走 Playwright，curl 只适合静态页面或 API
> 判断标准：目标是文档网站 → 大概率 SPA → 直接 Playwright。

### DEV-35 session 卡死后 Stop Hook 持续循环 `🟢`

❌ 某 session 卡死 → Stop Hook 启动后台进程 → 后台进程也卡/循环
✅ 卡死时优先检查 Stop Hook 配置；必要时在 `settings.json` 禁用该插件

### DEV-36 Claude Code 插件 hook 报错定位慢 `🟢`

❌ 看到 `PreToolUse:Bash hook error` 反复试各种方案才发现是插件 hook 拦截
✅ hook error → 先 `find ~/.claude -name "hooks.json" | xargs grep -l "PreToolUse"` 找肇事插件；Windows JSON 操作用 `node` 而非 `python3`

### DEV-54 新脚本猜 API 端点不查已有脚本 `🟢`

❌ 写新脚本时猜端点，实际端点完全不同，请求全返错误
✅ 调用外部 API 前，先 grep 已有可运行脚本找到实际端点、认证方式、传输机制，不猜
> COMMON-9 变体：API 集成场景的"我以为我知道"。

### DEV-56 新脚本重写逻辑不复用已有框架 `🟢`

❌ 已有可运行脚本，新脚本用不同方式重写，漏掉 proxy、协议信封等关键细节
✅ 同类操作的新脚本，复制已有可运行的函数，不从零重写
> 已验证的集成代码：复用 > 重写。

### DEV-58 降级链跳步 — WebFetch 失败后跳过 agent-browser 直接 curl `🟡×2`

❌ CLAUDE.md 定义了降级链（WebFetch → agent-browser → Scrapling → Playwright），失败后跳过中间步骤直接用 curl
✅ 严格按降级链顺序逐步降级，不跳步。curl 不在降级链里，任何时候都不该出现
> DEV-31 变体：不只是"该用浏览器却用 curl"，而是无视已定义的降级顺序。WebFetch 失败 → 下一步必须是 agent-browser，没有例外

### DEV-59 抓取失败后编造内容 — "从 URL 推测" `🟢`

❌ 网页抓不到，凭 URL 和上下文"推测"内容并当作事实输出
✅ 抓不到 = 没有数据。如实告知用户"该页面无法抓取，没有获得内容"，不猜测、不编造
> 信息来源必须可验证。推测 ≠ 事实，输出未验证信息比不输出更有害。

### DEV-57 Bash heredoc 传大段 JS 单引号冲突连试 3 次 `🟢`

❌ 用 heredoc/inline `node -e` 传含单引号的大 JSON，shell 转义连续失败 3 次才换方案
✅ 大段 JS（>20 行或含引号）→ 直接 Write 临时 .js 文件再 `node` 执行，不走 heredoc
> 第一次 shell 转义失败就该切方案，不是第三次。
