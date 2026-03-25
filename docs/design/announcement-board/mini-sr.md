# Module E 公告栏 — Mini SR（最小规格评审）

> 创建日期：2026-03-25
> 状态：等待用户确认

## 1. 验收标准（怎样算做完）

| # | 验收项 | 验证方式 |
|---|--------|---------|
| AC-1 | 后端调用 `announcer.push("文字")` 后，前端 overlay 出现对应文字 | 手动调用 + 目测 |
| AC-2 | overlay 在 `duration_ms` 到期后自动淡出消失 | 计时目测 |
| AC-3 | 公告显示期间，语音输入 / 对话主链路不受影响 | 同时说话，观察是否卡顿 |
| AC-4 | overlay 位置不遮挡 Live2D 角色主体 | 目测布局 |
| AC-5 | WebSocket 断线期间调用 `announcer.push()` 不崩溃，重连后不补发旧公告 | 手动断网测试 |

## 2. 技术方案

### 2.1 后端

```
src/greywind/server/announcer.py
  └── push(text: str, duration_ms: int = 5000)
        → 通过 ws_handler 广播 announcement 消息
```

- 不新建任何存储，纯内存广播
- 依赖现有 `ws_handler.py` 的 broadcast 能力

### 2.2 WebSocket 消息协议（新增）

```json
{"type": "announcement", "payload": {"text": "...", "duration_ms": 5000}}
```

与现有消息类型并列，不破坏现有协议。

### 2.3 前端

```
renderer/announcement-overlay.js  ← 新增
  └── init()  挂载 DOM 元素
  └── show(text, duration_ms)  显示 + 定时淡出

renderer/socket-client.js  ← 修改
  └── 新增 announcement 消息处理分支

renderer/index.html  ← 修改
  └── 新增 <div id="announcement-container">
```

### 2.4 样式定位

- position: fixed，右上角或角色旁
- z-index 低于对话气泡，高于 Live2D 背景
- CSS transition 淡出（opacity 0→1→0）

## 3. 技术风险点

| 风险 | 等级 | 处置 |
|------|------|------|
| ws_handler 当前 broadcast 实现可能无该接口 | 中 | 实施前先 grep 确认，必要时小改 ws_handler |
| WebSocket 未连接时 push() 调用崩溃 | 中 | 加空值防御，连接不存在时静默忽略 |
| overlay z-index 与现有 chat-overlay 冲突 | 低 | 读 index.html 现有层级后确定数值 |
| Live2D 透明窗口下 overlay 渲染异常 | 低 | 与现有 chat-overlay.js 对齐实现方式 |

## 4. 平台能力边界确认

- Electron renderer 支持 fixed position overlay：✅（chat-overlay.js 已验证）
- WebSocket broadcast 已有实现：待 grep 确认
- CSS transition 在 Electron Chromium 下可用：✅

## 5. 明确不做（边界锁定）

- 不持久化公告历史
- 不支持用户交互
- 不支持队列（新公告直接替换旧公告）
- 不支持触发条件配置
