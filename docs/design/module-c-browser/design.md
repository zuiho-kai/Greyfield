# Module C — 浏览器操控 设计文档

> 状态：Step 5 实现中
> 创建：2026-03-17
> 前置：Spine ✅ 完成，Module B 屏幕感知基本可用

---

## 0. 一句话定位

浏览器操控是 Execution Runtime 层的第一个执行 provider，让灰风从"能看"升级到"能动手"——通过通用接口 + 可切换后端操控浏览器完成用户指定的网页操作。

### 与中轴的关系

- 架构 v2 顶层架构中，Browser Tools 位于 **Execution Runtime** 层
- 生长路线 **Phase 2：会做**（Browser tools、风险分级、操作日志）
- Agent 权限模型对应 **L4 操控**
- spine-now 第 16 节候选 Module C

---

## 1. 竞品参考

### 1.1 my-neuro 的方案

my-neuro 通过 MCP + playwright-mcp 实现浏览器操控：

- `@playwright/mcp` 作为 MCP server，通过 stdio transport 启动子进程
- MCP Manager 自动发现 playwright-mcp 提供的工具，转换为 OpenAI Function Calling 格式
- LLM handler 有完整的 tool call 循环（最大 30 轮）
- 支持多轮工具调用、打断检测、中间过程 TTS 播报
- 截图工具有特殊处理（`_isScreenshot` 标记）

优点：playwright-mcp 微软官方维护，工具定义成熟，MCP 协议标准化
缺点：stdio JSON-RPC 开销，Node.js 子进程，灰风 Python 后端需跨语言桥接

### 1.2 CLI-Anything 的定位

CLI-Anything 给桌面软件自动生成 CLI，和浏览器操控互补：

- CLI-Anything 适合有 API/脚本接口的桌面软件（GIMP、Blender、OBS）
- 浏览器操控适合动态网页（没有预生成 CLI 的可能）
- 两者都是执行层的 provider，未来并列挂在 `execution/` 下
- 正式接入等 Phase 3 Skill 平台

### 1.3 方案选型讨论记录

在确定最终方案前，评估了三条技术路线：

| 方案 | 优点 | 缺点 |
|------|------|------|
| Playwright CDP 连接用户浏览器 | 全能力，真实浏览器指纹 | 用户必须改 Chrome 启动方式，profile 锁问题 |
| Chrome Extension + Native Messaging | 一次安装永久可用，登录态天然继承，安全 | 能力不如 CDP 完整，需开发维护扩展 |
| Playwright 启动独立 Chromium | 最简单，零配置 | 无登录态，反爬易触发，需重新登录 |

**结论：不选死一条路，做通用接口，provider 可切换。**

---

## 2. 技术架构：通用接口 + 多 Provider

### 2.1 核心设计

```
BrowserProvider（抽象接口）
    ├─ PlaywrightProvider      # 当前实现：Playwright 启动独立浏览器（最简单，用户需重新登录）
    ├─ ExtensionProvider       # 当前实现：Chrome Extension + Native Messaging（登录态继承）
    └─ CDPProvider             # 未来：CDP 连接已有 Chrome（进阶用户）
```

上层（VoicePipeline / tool call 循环）只和 `BrowserProvider` 接口交互，不关心底层用的是哪个 provider。

### 2.2 BrowserProvider 抽象接口

```python
class BrowserProvider(ABC):
    """浏览器操控通用接口"""

    @abstractmethod
    async def connect(self) -> bool:
        """连接/启动浏览器，返回是否成功"""

    @abstractmethod
    async def disconnect(self):
        """断开连接"""

    @abstractmethod
    async def goto(self, url: str) -> ActionResult:
        """导航到 URL"""

    @abstractmethod
    async def click(self, selector: str) -> ActionResult:
        """点击元素"""

    @abstractmethod
    async def type_text(self, selector: str, text: str) -> ActionResult:
        """输入文本"""

    @abstractmethod
    async def screenshot(self) -> ActionResult:
        """截取当前页面"""

    @abstractmethod
    async def read_text(self, selector: str | None = None) -> ActionResult:
        """读取页面文本"""

    @abstractmethod
    async def scroll(self, direction: str, amount: int | None = None) -> ActionResult:
        """滚动页面"""

    @abstractmethod
    async def back(self) -> ActionResult:
        """后退"""

    @abstractmethod
    async def wait(self, selector: str | None = None, timeout: int | None = None) -> ActionResult:
        """等待"""

    @property
    @abstractmethod
    def is_connected(self) -> bool:
        """是否已连接"""
```

```python
@dataclass
class ActionResult:
    success: bool
    screenshot_b64: str | None = None   # JPEG base64
    text: str | None = None             # 文本内容
    title: str | None = None            # 页面标题
    url: str | None = None              # 当前 URL
    error: str | None = None            # 错误信息
```

### 2.3 两个 Provider 的对比

| 维度 | PlaywrightProvider | ExtensionProvider |
|------|-------------------|-------------------|
| 实现复杂度 | 低（纯 Python） | 中（Python + JS 扩展 + Native Messaging） |
| 登录态 | 无，需重新登录 | 继承用户浏览器 |
| 反爬 | 容易被检测 | 真实浏览器指纹 |
| 用户配置 | 零配置 | 安装一次 Chrome 扩展 |
| 能力完整度 | 高（Playwright 全能力） | 中（chrome API 覆盖主要场景） |
| 安全性 | 隔离环境 | Native Messaging，无端口暴露 |
| 适用场景 | 不需要登录的网页操作 | 需要登录态的网页操作 |

### 2.4 模块交互图

```
用户语音/文字输入
    ↓
Voice Pipeline / ws_handler
    ↓
Prompt Assembler（注入浏览器工具定义）
    ↓
LLM（已支持 tool calling）
    ↓ yield ToolCallObject
Voice Pipeline 拦截 tool call
    ↓
browser_tools.py（工具分发）
    ↓
BrowserProvider（通用接口）
    ├─ PlaywrightProvider
    └─ ExtensionProvider
    ↓
ActionResult（截图 base64 / 文本 / 状态）
    ↓
结果回注 messages → LLM 继续推理（多轮 tool call loop）
    ↓
最终文本回复 → TTS → 用户
```

### 2.5 新增/修改文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `src/greywind/execution/__init__.py` | 执行层包 |
| 新增 | `src/greywind/execution/base.py` | BrowserProvider 抽象接口 + ActionResult |
| 新增 | `src/greywind/execution/playwright_provider.py` | Playwright 独立浏览器 provider |
| 新增 | `src/greywind/execution/extension_provider.py` | Chrome Extension + Native Messaging provider |
| 新增 | `src/greywind/execution/browser_tools.py` | 工具定义（JSON Schema）+ 工具分发 |
| 新增 | `frontend/extension/` | Chrome 扩展（manifest.json + background.js + native messaging host） |
| 修改 | `src/greywind/config/models.py` | 新增 `BrowserConfig` |
| 修改 | `src/greywind/server/service_context.py` | 注册 BrowserProvider |
| 修改 | `src/greywind/persona/voice_pipeline.py` | 增加 tool call 执行循环 |
| 修改 | `conf.yaml` | 新增 `browser:` 配置段 |

### 2.6 执行层目录结构

```
src/greywind/execution/
├── __init__.py
├── base.py                    # BrowserProvider 接口 + ActionResult
├── playwright_provider.py     # Provider 1：Playwright 独立浏览器
├── extension_provider.py      # Provider 2：Chrome Extension + Native Messaging
├── browser_tools.py           # 工具定义 + 分发
└── (未来)
    ├── cdp_provider.py        # Provider 3：CDP 连接用户 Chrome
    ├── cli_harness.py         # CLI-Anything harness 接入
    └── desktop.py             # 桌面操控

frontend/extension/
├── manifest.json              # Chrome 扩展清单（Manifest V3）
├── background.js              # Service Worker：接收 Native Messaging，调用 chrome API
├── native-messaging-host.py   # Python 端：stdin/stdout 双向通信
└── native-messaging-host.json # Native Messaging Host 注册清单
```

---

## 3. 配置设计

```yaml
browser:
  enabled: false              # 默认关闭
  provider: "playwright"      # playwright | extension
  screenshot_quality: 50      # JPEG 压缩质量
  screenshot_width: 1280      # 截图宽度
  idle_timeout: 60            # 无名标签页空闲超时（秒）
  named_tab_timeout: 0        # 命名标签页不自动关闭（0 = 永不）
  max_tabs: 10                # 最大并行标签页数
  max_tool_rounds: 30         # tool call 最大循环轮次
```

---

## 4. 动作集设计

参考 playwright-mcp 的工具定义，灰风最小动作集（两个 provider 统一实现）：

| 动作 | 说明 | 参数 | 返回 |
|------|------|------|------|
| `browser_goto` | 导航到 URL | `url: str, tab_id: str?` | 截图 + 页面标题 |
| `browser_click` | 点击元素 | `selector: str, tab_id: str?` | 截图 + 状态 |
| `browser_type` | 输入文本 | `selector: str, text: str, tab_id: str?` | 截图 + 状态 |
| `browser_screenshot` | 截取当前页面 | `tab_id: str?` | 截图 |
| `browser_read_text` | 读取页面文本 | `selector: str?, tab_id: str?` | 文本内容 |
| `browser_scroll` | 滚动页面 | `direction: up/down, amount: int?, tab_id: str?` | 截图 |
| `browser_wait` | 等待元素/时间 | `selector: str? / timeout: int?, tab_id: str?` | 状态 |
| `browser_back` | 后退 | `tab_id: str?` | 截图 + 页面标题 |
| `browser_new_tab` | 新开标签页 | `name: str?`（可选命名） | tab_id |
| `browser_switch_tab` | 切换到指定标签页 | `tab_id: str` | 截图 + 页面标题 |
| `browser_close_tab` | 关闭标签页 | `tab_id: str` | 状态 |
| `browser_list_tabs` | 列出所有标签页 | 无 | tab_id + 标题 + URL 列表 |
| `browser_ask_ai` | 让网页版 AI 帮忙搜索/推理 | `platform: str, prompt: str` | AI 回答文本 |

`browser_ask_ai` 说明：
- `platform` 支持：`chatgpt` / `claude` / `doubao`（豆包）/ `perplexity` / `gemini`（Google）
- 内部编排：自动 goto 对应平台 → 找到输入框 → type prompt → wait 回答完成 → read_text 抓取结果
- 前提：Extension provider 下用户已登录对应平台
- 好处：白嫖网页版免费额度，搜索质量高（平台自带联网），省自己的 API token

设计原则：
- 每次动作后默认自动截图回传 LLM
- 截图 JPEG 压缩 + 降分辨率（1280x720），控制 token 消耗
- selector 支持 CSS 选择器和文本内容匹配
- 所有页面操作动作支持可选 `tab_id` 参数，不传则操作当前活跃标签页

### 多标签页与 Session 管理

- 支持最多 10 个并行标签页（`max_tabs: 10`）
- 标签页可命名（如"价格监控"），命名标签页不自动关闭
- 无名标签页 idle_timeout 秒无操作自动回收
- LLM 可以并行操作多个标签页（开 3 个页面分别查询，汇总结果）

典型场景：
- "帮我比较三个网站的价格" → 开 3 个标签页，分别导航，读取价格，汇总
- "帮我盯着这个页面，有更新告诉我" → 命名标签页，长期保持
- "先查 A，等会儿再回来看" → 命名标签页，随时切回

---

## 5. Tool Call 循环设计

参考 my-neuro 的 LLM handler，在 VoicePipeline 中新增 tool call 循环：

```
LLM 流式响应
    ↓
检测到 ToolCallObject?
    ├─ 否 → 正常文本 → TTS 播报
    └─ 是 → 进入 tool call 循环
              ↓
         执行工具（BrowserProvider）
              ↓
         结果回注 messages
              ↓
         再次调用 LLM
              ↓
         检测到 ToolCallObject?
              ├─ 是 → 继续循环（最大 10 轮）
              └─ 否 → 最终文本 → TTS 播报
```

关键设计点：
- 最大循环轮次：30（资料搜索、多页面比较等深度场景需要足够轮次）
- 每轮循环前检查打断状态（用户随时可以喊停）
- 中间过程 LLM 文本可选 TTS 播报
- 截图 base64 只在当前轮注入，下一轮清理（节省 token）

---

## 6. 浏览器生命周期

### PlaywrightProvider

- 懒启动：首次 tool call 时 `playwright.chromium.launch()`
- 超时关闭：idle_timeout 秒无操作关闭浏览器
- 异常恢复：操作失败时重启浏览器

### ExtensionProvider

- 懒连接：首次 tool call 时通过 Native Messaging 连接扩展
- 新标签页隔离：每次任务在新标签页操作
- 超时关闭标签页：idle_timeout 秒无操作关闭灰风打开的标签页（不关闭用户浏览器）
- 断连恢复：检测到扩展断连后提示用户

---

## 7. 风险分级

当前阶段简化处理：
- R0（只读）：screenshot、read_text → 自动执行
- R1（交互）：goto、click、type、scroll、back、wait → 自动执行 + 日志记录
- 不做用户确认弹窗（信任 LLM 判断 + 日志审计）
- 不做 R2/R3（支付、删除等高危操作当前不在动作集内）

---

## 8. 验收标准

1. `conf.yaml` 中 `browser.enabled: true` + `provider: playwright` 后，Playwright 可懒加载
2. 对灰风说"打开 baidu.com"，浏览器导航成功，截图回传 LLM，灰风语音描述页面内容
3. 对灰风说"搜索 xxx"，灰风能在页面输入框输入并点击搜索
4. 多轮 tool call 循环正常工作（LLM 看截图 → 决定下一步 → 执行 → 再看）
5. 操作日志可在终端 loguru 中查看
6. `browser.enabled: false`（默认）时，不加载任何浏览器依赖，不影响现有功能
7. 标签页 idle_timeout 秒无操作自动关闭
8. 切换 `provider: extension` 后，通过 Chrome 扩展操控用户真实浏览器，登录态继承

---

## 9. 技术风险

| 风险 | 应对 |
|------|------|
| Playwright 独立浏览器无登录态 | 文档说明，推荐需要登录态时切换 extension provider |
| Extension Native Messaging 通信稳定性 | 心跳检测 + 断连重试 |
| tool call 多轮循环死循环 | 最大 10 轮限制 |
| 截图 base64 体积大，token 消耗高 | JPEG 压缩 + 1280x720 + `detail: low` |
| 当前 LLM tool calling 能力弱 | 建议浏览器场景切换到强模型 |
| Chrome 扩展审核周期 | 先本地加载开发版，稳定后再上 Web Store |

---

## 10. 实现优先级

1. **Phase 1**：PlaywrightProvider + tool call 循环 + 工具定义（先跑起来）
2. **Phase 2**：ExtensionProvider + Native Messaging（登录态场景）
3. **未来**：CDPProvider / CLI-Anything / MCP / 桌面操控

---

## 11. 未来扩展方向

- CDP Provider（进阶用户，连接已有 Chrome）
- CLI-Anything harness 接入（桌面软件操控）
- MCP 协议支持
- 多标签页管理
- Cookie/登录态持久化
- 前端浏览器画面实时投屏
- Skill 平台集成
- Chrome Web Store 发布扩展
- 更多 AI 平台支持（Gemini、Kimi、通义千问等）
