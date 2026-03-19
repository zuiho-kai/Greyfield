# Good First Issues 模板

直接复制到 GitHub Issues 创建即可。创建时记得加 `good first issue` 标签。

---

## Issue 1: README 英文翻译校对

**标题**: 📖 README 英文翻译校对

**内容**:

```
现在有一份 README_EN.md，但内容可能和最新的中文 README 不同步。

**要做的事**：
- 对照最新的 README.md，把 README_EN.md 更新到一致
- 翻译新增的内容（架构图、调用链路等）
- 校对已有翻译的自然度

**做完长什么样**：
- README_EN.md 和 README.md 结构一致
- 英文表达自然，不是机翻味

**从哪开始看**：
- `README.md`（中文原版）
- `README_EN.md`（当前英文版）

**难度**: ⭐ 不需要懂代码
```

**标签**: `good first issue`, `documentation`

---

## Issue 2: 补一份 Linux / macOS 安装指南

**标题**: 📖 补充 Linux / macOS 安装指南

**内容**:

```
当前安装文档主要面向 Windows 用户（一键安装.bat、build.bat 等）。
需要补充 Linux 和 macOS 下的安装和启动说明。

**要做的事**：
- 在 Linux 或 macOS 上跑一遍安装流程
- 记录遇到的问题和解决方法
- 在 README.md 的"快速开始"部分补充对应平台的说明
- 或者单独写一份 docs/install-linux.md / docs/install-macos.md

**做完长什么样**：
- 其他平台的用户能按文档顺利跑起来

**从哪开始看**：
- `README.md` 的"快速开始"部分
- `conf.example.yaml`（配置模板）

**难度**: ⭐ 需要有对应平台的环境
```

**标签**: `good first issue`, `documentation`

---

## Issue 3: Live2D 模型兼容性测试

**标题**: 🎨 Live2D 模型兼容性测试

**内容**:

```
灰风默认使用 Hiyori Momose 示例模型，但理论上支持任何 Cubism 4 模型。
需要有人用自己的 Live2D 模型测试一下兼容性。

**要做的事**：
- 把你自己的 Live2D 模型放到 models/ 目录
- 在设置窗口导入并切换到该模型
- 记录：能否正常显示、口型同步是否工作、表情是否正常、有无报错
- 把结果写成 Issue 回复或单独的测试报告

**做完长什么样**：
- 我们知道哪些模型能用、哪些有问题
- 如果有问题，有具体的报错信息方便排查

**从哪开始看**：
- `frontend/desktop/renderer/live2d-renderer.js`（模型加载逻辑）
- `models/` 目录（模型存放位置）

**难度**: ⭐ 不需要改代码，有 Live2D 模型就行
```

**标签**: `good first issue`, `testing`

---

## Issue 4: 整理 edge-tts 可用音色列表

**标题**: 🗣️ 整理 edge-tts 备用音色列表

**内容**:

```
灰风的备用 TTS 引擎是 edge-tts，支持很多中文/英文/日文音色，
但目前没有一份整理好的推荐列表。

**要做的事**：
- 运行 `edge-tts --list-voices` 查看所有可用音色
- 挑出中文（zh-CN / zh-TW）和日文（ja-JP）里听感较好的音色
- 整理成一份表格：音色 ID、语言、性别、听感评价
- 放到 docs/edge-tts-voices.md

**做完长什么样**：
- 用户想换音色时，有一份推荐列表可以参考
- 表格里有每个音色的简短评价

**从哪开始看**：
- `src/greywind/engines/tts/`（TTS 引擎目录）
- `conf.example.yaml` 里的 tts 配置部分

**难度**: ⭐ 不需要改代码，听一听选一选就行
```

**标签**: `good first issue`, `documentation`

---

## Issue 5: 添加聊天历史清空按钮

**标题**: 🧹 添加聊天历史清空按钮

**内容**:

```
目前没有办法在 UI 上清空聊天历史，需要手动删文件。
Roadmap 里已经列了这个需求。

**要做的事**：
- 在前端 UI 添加一个清空聊天历史的按钮（可以放在设置菜单或聊天区域）
- 点击后通过 WebSocket 发送清空请求给后端
- 后端清空 session_manager 里的对话历史
- 前端同步清空聊天气泡

**做完长什么样**：
- 用户点一下就能清空当前对话，重新开始
- 清空后 Live2D 角色还在，不需要重启

**从哪开始看**：
- `frontend/desktop/renderer/chat-overlay.js`（聊天气泡 UI）
- `frontend/desktop/renderer/socket-client.js`（WebSocket 客户端）
- `src/greywind/server/ws_handler.py`（WebSocket 消息路由）
- `src/greywind/context_runtime/session_manager.py`（对话历史管理）

**难度**: ⭐⭐ 需要改前后端各一点
```

**标签**: `good first issue`, `enhancement`
