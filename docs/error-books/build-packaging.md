# 错题本 — 构建 / 打包

> 适用场景：改构建脚本、electron-builder 打包、跨平台产物

### 记录规则

- **条目结构**：❌ 错误做法 + ✅ 正确做法，整条控制在 **5 行以内**
- **❌/✅ 写法**：只写核心规则，禁止多层加粗嵌套（加粗最多一层）
- **`>` 注释**：只放归因和 postmortem 链接，禁止复述场景
- **复犯**：只追加频率标记（🟡×N / 🔴×N）
- **归属**：条目只写本范围内容，跨范围写到对应文件

### DEV-64 构建脚本数据源与运行时环境不一致 `🟡×3`

❌ 打包脚本用 `platform.python_version()`（运行脚本的系统 Python）决定下载哪个嵌入式 runtime，但 site-packages 拷贝自 `.venv`，两者版本可能不同导致 ABI 不兼容
✅ 构建脚本中凡是影响产物兼容性的元数据，必须从产物实际来源获取。拷谁的包就问谁的版本：调用 `.venv` 的解释器获取版本号
> 归因：想当然认为"跑脚本的 Python = 项目的 Python"，没追数据源一致性

### DEV-65 跨平台路径拼接用了宿主机 path API `🟢`

❌ 函数按参数 `platform` 判断目标是 win32，但用宿主机的 `path.join` 拼路径。在 Linux CI 上构建 Windows 路径会产生混合分隔符（`C:\x\resources/backend/python`）
✅ 路径拼接涉及目标平台时，用 `path.win32.join` / `path.posix.join` 显式选择，不依赖宿主机默认的 `path.join`。检查点：函数参数里有 `platform` → 路径 API 必须跟着走
> 归因：`path.join` 的行为取决于 Node 运行的 OS 而非业务逻辑的目标 OS，混淆了"构建环境"与"目标环境"

### DEV-108 CI cache post-step 在实际 step 被跳过时仍执行，找不到缓存路径报错 `🟢`

❌ GitHub Actions 中 `setup-uv` 配置 `enable-cache: true`，但当 `.venv` 缓存命中时 `uv sync` 被跳过，uv 从未下载任何包，缓存目录不存在，post-step 自动保存缓存时报错 → 整个 job 标记为 failure
✅ 若某 job 内的"真实执行步骤"可能被条件跳过（如 `if: cache-hit != 'true'`），则该步骤依赖的缓存动作必须设 `enable-cache: false` 或加 `if` 守卫，避免 post-step 找不到目录
> 归因 C：新场景。CI 报错只出现在 post-step，与主流程失败现象混淆，排查成本高。PR #68

### DEV-75 跨平台 API 降级只做初始化不做运行时兜底 `🟢`

❌ 初始化时按平台降级（`setIgnoreMouseEvents(false)`），但运行时 IPC 仍无条件调用平台不支持的选项（`forward: true`），降级形同虚设
✅ 平台降级必须覆盖运行时路径：IPC handler 中按 `process.platform` 守卫，不支持的平台直接丢弃请求，不能只守初始化
> 归因 C：新场景。PR #24 CR 发现
