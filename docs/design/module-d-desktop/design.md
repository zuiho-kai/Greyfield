# Module D 桌面操控 — 设计文档

## Step 1 — Vision（愿景对齐）

一句话定位：让灰风能操作整个桌面环境——点击、拖拽、打字、截图定位元素、执行多步操作序列，作用域从浏览器扩展到任意本地应用。

与中轴的关系：
- 属于 Execution Runtime 层，和 Module C（浏览器操控）并列
- Module C 操控浏览器内页面，Module D 操控整个桌面
- 依赖 Module B（屏幕感知）提供视觉定位能力，依赖 LLM 决策层做操作规划
- 典型场景：打开软件、填表、切窗口、操作无 API 的本地应用

## Step 2 — Architecture（架构卡位）

### 模块交互图

```
用户输入（文字/语音）
    ↓
Voice Pipeline
    ├─ 准备 DESKTOP_TOOLS（工具 JSON Schema）
    ├─ 调用 LLM（带 tools 参数）
    ↓
LLM 返回 tool_call
    ↓
dispatch_desktop_tool（分发）
    ├─ 调用 DesktopProvider 对应方法
    ├─ pyautogui 执行操作
    ↓
ActionResult（截图 base64 + 文本 + 状态）
    ├─ 截图回注 LLM（看结果决定下一步）
    ↓
继续 tool call 循环 或 最终文本 → TTS → 用户
```

### 与现有模块的交互

- 复用 Module C 的 tool call 循环机制（voice_pipeline.py 已有）
- 复用 ActionResult 数据类（execution/base.py）
- 复用截图回注 LLM 的模式（截图作为 image_url 注入）
- Module B 屏幕感知可辅助定位，但 Module D 自己也截图

### 设计决策

- 和 Module C 同级放在 `execution/` 目录下
- 抽象接口沿用 Provider 模式（DesktopProvider）
- 底层用 pyautogui 做点击/拖拽/打字，用截图做视觉反馈
- 元素定位：截图 + LLM 视觉理解（不依赖 accessibility tree，覆盖任意应用）

### 新增/修改文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `src/greywind/execution/desktop_tools.py` | 桌面工具 JSON Schema 定义 + 分发函数 |
| 新增 | `src/greywind/execution/pyautogui_provider.py` | PyAutoGUI 实现 |
| 修改 | `src/greywind/execution/base.py` | 新增 DesktopProvider 抽象接口 |
| 修改 | `src/greywind/config/models.py` | 新增 DesktopConfig |
| 修改 | `src/greywind/server/service_context.py` | 桌面操控实例创建 |
| 修改 | `src/greywind/persona/voice_pipeline.py` | 集成桌面工具到 tool call 循环 |
| 修改 | `conf.yaml` | 新增 desktop 配置段 |

### 桌面工具清单

| 工具名 | 说明 |
|--------|------|
| `desktop_screenshot` | 截取全屏/指定区域 |
| `desktop_click` | 点击指定坐标 |
| `desktop_double_click` | 双击指定坐标 |
| `desktop_right_click` | 右键点击 |
| `desktop_type` | 在当前焦点输入文字 |
| `desktop_hotkey` | 按组合键（如 Ctrl+C） |
| `desktop_drag` | 从 A 拖拽到 B |
| `desktop_scroll` | 滚动鼠标滚轮 |
| `desktop_move` | 移动鼠标到指定位置 |
| `desktop_find_window` | 查找/列出窗口 |
| `desktop_focus_window` | 激活指定窗口 |

## Step 3 — 开源调研

### 主流方案对比

| 项目 | 底层库 | 元素定位 | 截图策略 | 坐标方案 | 中文输入 |
|------|--------|----------|----------|----------|----------|
| Anthropic Computer Use | xdotool (Linux) | 纯坐标 | 全屏缩放到 1280x800 | 绝对像素（缩放空间双向映射） | xdotool 有限 |
| Open Interpreter | pyautogui | 纯坐标 | 全屏缩放（同 Anthropic） | 绝对像素（缩放空间） | 不支持 |
| UFO（微软） | pywinauto + UIA | Accessibility Tree + 坐标 | 控件级/窗口级/桌面级三级回退 | 控件引用 + 归一化 0-1 | pywinauto set_text 支持 |
| OmniParser（微软） | 不操控，只解析 | YOLO 检测 + SOM 编号标注 | 全屏 | 归一化 0-1 | PaddleOCR |
| CUA (trycua) | VM 沙箱 | 多种 | 视频流 | 多种 | — |

### 关键借鉴点

1. 分辨率缩放（Anthropic）— 截图缩到固定宽度给 LLM 看，坐标双向映射，省 token 又保持精度
2. 操作后自动截图 + 2 秒延迟等待 UI 稳定（Anthropic）— action→observe 闭环
3. zoom/区域放大（Anthropic v3）— LLM 可请求放大某区域看细节，解决小图标识别问题
4. 中文输入用剪贴板粘贴 — pyautogui.write 不支持中文是所有项目的共识
5. UFO 的 Accessibility Tree 在 Windows 上精度最高，但实现复杂度高，作为后续增强方向

### 对 GreyWind Phase 1 的设计调整

基于调研，Phase 1 方案调整：
- 截图缩放：截图缩到配置宽度（默认 1280），坐标在缩放空间和实际空间之间双向映射
- 操作后延迟：每次操作后等待 UI 稳定再截图（可配置，默认 1 秒）
- 中文输入：确认用 pyperclip + Ctrl+V 粘贴方案
- 后续增强方向：Accessibility Tree（pywinauto UIA）、SOM 标注、区域放大

## Step 4 — Mini SR（最小规格评审）

### 验收标准

1. `desktop_screenshot` — 能截取全屏，返回 base64 图片，LLM 能看到
2. `desktop_click` / `desktop_double_click` / `desktop_right_click` — 能点击指定坐标，操作后自动截图确认
3. `desktop_type` — 能在当前焦点输入中文和英文
4. `desktop_hotkey` — 能执行组合键（如 Ctrl+C、Alt+Tab）
5. `desktop_drag` — 能从坐标 A 拖拽到坐标 B
6. `desktop_scroll` — 能上下滚动
7. `desktop_move` — 能移动鼠标到指定位置
8. `desktop_find_window` / `desktop_focus_window` — 能列出窗口、激活指定窗口
9. tool call 循环正常工作 — LLM 能看截图、连续调用多个桌面工具完成多步操作
10. 用户语音打断能中止操作序列
11. 配置 `desktop.enabled: false` 时完全不加载

### 技术风险点

| 风险 | 说明 | 应对 |
|------|------|------|
| pyautogui 坐标精度 | LLM 从截图判断坐标可能有偏差 | 每次操作后截图确认，LLM 可自行修正 |
| 中文输入 | pyautogui.write() 不支持中文 | 用 pyperclip + hotkey('ctrl','v') 粘贴方案 |
| UAC / 权限弹窗 | 部分操作需要管理员权限 | 文档说明，不做自动提权 |
| 截图分辨率与 LLM token 消耗 | 全屏截图可能很大 | 压缩 JPEG + 限制宽度（复用 Module C 的策略） |
| pyautogui failsafe | 鼠标移到左上角触发 FailSafe | 保留安全机制 |

### 平台能力边界确认

- pyautogui 支持 Windows/macOS/Linux，当前主要目标 Windows
- 窗口查找/激活：Windows 上用 pygetwindow，跨平台兼容性后续再处理
- 截图：pyautogui.screenshot() 返回 PIL Image，可直接转 base64
