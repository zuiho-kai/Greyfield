# Live2D 模型切换 — 方案确认

## 验收标准

1. 设置窗口有"Live2D 模型"区块，列出 `cache/live2d/` 下所有可用模型
2. 用户可点击"导入模型"按钮，选择文件夹（含 `.model3.json`），自动复制到 `cache/live2d/`
3. 一键切换模型，前端热替换（不重启应用）
4. 当前选中模型持久化（下次启动记住）
5. 可删除已导入的模型

## 技术方案

- 持久化：`cache/live2d/.current` 文件存当前模型目录名
- 导入：选择文件夹 → 校验有 `.model3.json` → 复制到 `cache/live2d/{name}/`
- 切换：更新 `.current` → IPC 事件 `live2d:model-changed` 通知渲染进程 → 销毁旧模型加载新模型
- 改动文件：`main.js`、`preload-settings.js`、`settings.html`、`preload.js`、`live2d-renderer.js`（共 5 个文件）

## 风险点

- PIXI 热替换需正确销毁旧模型释放 GPU 资源
- 导入文件夹结构不规范时需校验并提示用户
