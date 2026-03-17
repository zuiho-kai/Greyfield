# Module C — 浏览器操控 Mini SR

> 日期：2026-03-17
> 前置文档：`design.md`（同目录）
> 状态：待确认

---

## 1. 一句话目标

灰风通过通用浏览器接口（BrowserProvider）操控浏览器，完成导航、点击、填表、截图、读取内容、AI 代理搜索等网页操作。

---

## 2. 边界：做什么 / 不做什么

### 做

- BrowserProvider 抽象接口
- PlaywrightProvider（独立浏览器，零配置，用户需重新登录）
- ExtensionProvider（Chrome Extension + Native Messaging，登录态继承）
- 13 个动作（goto / click / type / screenshot / read_text / scroll / wait / back / new_tab / switch_tab / close_tab / list_tabs / ask_ai）
- 多标签页（最多 10 个），命名标签页长期保持
- tool call 循环（最大 30 轮）
- browser_ask_ai 支持 ChatGPT / Claude / 豆包 / Perplexity / Gemini
- 操作日志（loguru）

### 不做

- CDP Provider（未来）
- CLI-Anything 接入（Phase 3）
- 桌面操控（未来）
- R2/R3 高危操作确认弹窗
- 多浏览器实例（当前只支持一个浏览器连接）
- Cookie 导出/导入
- 前端浏览器画面投屏

---

## 3. 验收标准

| # | 场景 | 预期结果 | Provider |
|---|------|----------|----------|
| 1 | `browser.enabled: true, provider: playwright`，说"打开 baidu.com" | 浏览器导航成功，截图回传 LLM，灰风语音描述页面 | Playwright |
| 2 | 说"搜索 灰风 AI 助手" | 输入框输入 + 点击搜索 + 截图回传 | Playwright |
| 3 | 说"帮我比较这三个网站的价格" | 开 3 个标签页，分别导航读取，汇总结果 | 两者 |
| 4 | 说"帮我用 ChatGPT 搜一下 xxx" | 打开 ChatGPT 网页版，输入问题，等回答，抓取结果返回 | Extension |
| 5 | 多轮 tool call 循环（>10 轮的资料搜索） | 正常完成，不死循环，打断可用 | 两者 |
| 6 | `browser.enabled: false` | 不加载任何浏览器依赖，现有功能不受影响 | — |
| 7 | 无名标签页 60s 无操作 | 自动关闭 | 两者 |
| 8 | 命名标签页 | 不自动关闭，可随时切回 | 两者 |
| 9 | Extension provider 操作已登录网站 | 登录态继承，无需重新登录 | Extension |

---

## 4. 技术风险 & 应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| Playwright 独立浏览器无登录态 | 确定 | 中 | 文档说明，推荐 Extension provider |
| Extension Native Messaging 通信不稳定 | 低 | 高 | 心跳检测 + 断连重试 + 错误提示 |
| browser_ask_ai 平台 DOM 结构变化 | 中 | 中 | 每个平台的选择器配置化，易于更新 |
| tool call 30 轮死循环 | 低 | 中 | 轮次上限 + 打断检测 + 用户可喊停 |
| 截图 token 消耗高 | 确定 | 中 | JPEG 压缩 + 1280x720 + detail:low + 上一轮截图清理 |
| LLM tool calling 能力不足 | 中 | 高 | 浏览器场景建议切换强模型 |

---

## 5. 实现优先级

| Phase | 内容 | 依赖 |
|-------|------|------|
| P1 | BrowserProvider 接口 + PlaywrightProvider + tool call 循环 + 基础动作集 | 无 |
| P2 | 多标签页管理 + 命名标签页 | P1 |
| P3 | ExtensionProvider + Native Messaging | P1 |
| P4 | browser_ask_ai（各平台适配） | P3（需要登录态） |

---

## 6. 文件变更清单

| 操作 | 文件 |
|------|------|
| 新增 | `src/greywind/execution/__init__.py` |
| 新增 | `src/greywind/execution/base.py` |
| 新增 | `src/greywind/execution/playwright_provider.py` |
| 新增 | `src/greywind/execution/extension_provider.py` |
| 新增 | `src/greywind/execution/browser_tools.py` |
| 新增 | `frontend/extension/manifest.json` |
| 新增 | `frontend/extension/background.js` |
| 新增 | `frontend/extension/native-messaging-host.py` |
| 新增 | `frontend/extension/native-messaging-host.json` |
| 修改 | `src/greywind/config/models.py` |
| 修改 | `src/greywind/server/service_context.py` |
| 修改 | `src/greywind/persona/voice_pipeline.py` |
| 修改 | `conf.yaml` |

---

## 7. 确认项

- [ ] 验收标准无遗漏
- [ ] 边界清晰，不做的不做
- [ ] 技术风险可接受
- [ ] 实现优先级合理（P1 先跑通基础，P3 再做 Extension）
