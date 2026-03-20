# 设计文档：Live2D 模型 Ctrl+滚轮缩放

> 日期：2026-03-20
> 状态：待确认

## 功能描述

用户可通过 `Ctrl + 鼠标滚轮` 在桌面上对 Live2D 模型进行缩放，缩放以鼠标为中心点，设置持久化，支持重置。

## 验收标准

1. Ctrl+向上滚轮 → 模型放大，缩放中心为当前鼠标位置
2. Ctrl+向下滚轮 → 模型缩小，缩放中心为当前鼠标位置
3. 普通滚轮（无 Ctrl）→ 不触发缩放（忽略）
4. 缩放范围：`userScale` 限制在 [0.3, 3.0]，超出范围停止缩放
5. 拖拽和缩放互不干扰
6. 缩放倍率 (`userScale`) 和位置偏移 (`userOffsetX/Y`) 持久化到 `render-settings.json`
7. 重启后自动恢复上次缩放/位置
8. 设置页新增"重置位置和大小"按钮，点击恢复 `fitModel()` 默认值并清除持久化偏移

## 技术方案

### 核心数据结构

`render-settings.json` 新增三个字段：
```json
{
  "hiDpi": false,
  "bubbleBlur": true,
  "userScale": 1.0,
  "userOffsetX": 0,
  "userOffsetY": 0
}
```

- `userScale`：用户缩放倍率（相对于 `fitModel()` 计算的基准 scale，乘积为最终 scale）
- `userOffsetX/Y`：相对于 `fitModel()` 计算的基准位置的像素偏移

这样设计的好处：分辨率无关，`fitModel()` 先算出 baseScale/baseX/baseY，再叠加用户偏好。

### 缩放以鼠标为中心的数学

```
设鼠标位置为 (mx, my)，当前模型位置为 (x, y)，当前 scale 为 s，新 scale 为 s'

// 鼠标在模型坐标系中的偏移
offsetX = mx - x
offsetY = my - y

// 缩放后调整位置，使鼠标指向模型的同一点
x' = mx - offsetX * (s' / s)
y' = my - offsetY * (s' / s)
```

### 改动文件清单

| 文件 | 改动内容 |
|------|---------|
| `frontend/desktop/renderer/live2d-renderer.js` | ① 加载时读取 `userScale/Offset` 并在 `fitModel()` 后应用<br>② 在 `drag-overlay` 上注册 `wheel` 事件，Ctrl+滚轮执行缩放<br>③ 缩放后防抖写入 `render-settings` |
| `frontend/desktop/main.js` | 新增 `render-settings:reset-model-transform` IPC handler，清除 `userScale/Offset` 并通知主窗口 |
| `frontend/desktop/preload.js` | 新增 `updateRenderSettings`（`render-settings:update`）和 `resetModelTransform`（`render-settings:reset-model-transform`） |
| `frontend/desktop/preload-settings.js` | 新增 `resetModelTransform: () => ipcRenderer.invoke("render-settings:reset-model-transform")` |
| `frontend/desktop/renderer/settings.html` | 在渲染设置区域新增"重置位置和大小"按钮及对应 JS |

### 持久化策略

- 防抖 500ms 写入，避免高频滚动引发频繁磁盘写
- 写入通过已有的 `render-settings:update` IPC 通道（主进程持有文件句柄）
- 重置时写入 `{userScale: 1.0, userOffsetX: 0, userOffsetY: 0}` 并向主窗口发送 `render-settings-changed` 事件

### 穿透兼容性

- 鼠标在模型有效像素上时 `setIgnoreMouseEvents(false)` 已生效 → `wheel` 事件正常触发
- 无 Ctrl 时不缩放，但 Electron 仍然捕获该滚轮事件（架构限制，可接受）
- 不新增 IPC 通道用于实时写（防抖后用已有 `render-settings:update`）

## 风险点

| 风险 | 处置 |
|------|------|
| 模型加载前滚动（`live2dModel = null`）| wheel handler 开头检查 `if (!live2dModel) return` |
| 防抖期间关闭应用 | 主进程 `before-quit` 已有 `saveHistoryToDisk`，同理需在关闭前 flush 缓存的 transform；或简化：滚动时同步写入（量不大） |
| preload.js 未暴露 `resetModelTransform` | 需检查 preload.js 是否已有 `saveRenderSettings`，按现有 pattern 补充 |
