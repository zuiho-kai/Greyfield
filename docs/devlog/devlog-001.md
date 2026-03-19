# DevLog #1 — 灰风活了

> 2026-03-19 · 第一篇开发日志

## 灰风是什么

灰风（GreyWind）是一个桌面 AI 伴侣。她一直在你桌面上，能看你的屏幕，能听你说话，关掉再打开，她还是同一个人。

不是网页标签，不是终端，是桌面上的一个 Live2D 角色。

名字来自《群星》的灰蛊风暴——一个由纳米蜂巢构成的、强而有力的、会一直陪在你身边的个体。

GitHub: https://github.com/zuiho-kai/Greyfield

## 现在做到了什么

从第一行代码到现在，灰风已经跑通了完整的桌面 AI 伴侣闭环：

**Phase 1 — 先活起来** ✅
- 语音链路全通：麦克风 → VAD → ASR → LLM → 流式 TTS → Live2D 口型同步
- 说到一半可以打断她
- 跨会话上下文延续，不是每次从零开始
- Electron 桌面壳：透明窗口、鼠标穿透、拖拽、高 DPI、系统托盘
- 一键打包成 exe

**Phase 2 — 能看能做** 进行中
- ✅ 屏幕感知：截图 + Vision API + 差异检测，她知道你在看什么
- ✅ 自定义音色克隆：上传音频 → 克隆音色 → 试听 → 管理
- ✅ 浏览器操控：Playwright + function calling，能帮你搜东西、操作网页
- ✅ Live2D 模型切换：设置窗口支持导入/切换/删除模型
- ✅ 桌面操控：pyautogui 截图定位 + 操作序列，能帮你操作电脑
- ⏳ Live2D 直播（OBS 推流 · 弹幕互动）

技术栈：Python + FastAPI + Electron + pixi.js + Live2D Cubism 4，LLM/ASR/TTS 走硅基流动 API。

## 接下来两周要做什么

1. **社区基础设施**：开 Discord / QQ 群，发第一批 good first issue
2. **发第一个 Release**：打包 v0.1.0 exe，让不会搭环境的人也能试
3. **录一个 30 秒演示视频**：启动 → 对话 → 屏幕感知 → 打断，放到 README 顶部
4. **Live2D 直播模块**：OBS 推流 + 弹幕互动，让灰风能自己开直播

## 现在最缺什么人

| 方向 | 说明 | 难度 |
|------|------|:----:|
| 📖 文档 / 翻译 | README 英文化、安装教程、Linux/macOS 指南 | ⭐ |
| 🎨 Live2D 模型 | 用自己的模型测试兼容性，报告问题 | ⭐ |
| 🗣️ 音色整理 | 整理 edge-tts 可用音色推荐列表 | ⭐ |
| 📺 Live2D 直播 | OBS 推流 · 弹幕互动 · 自主直播 | ⭐⭐ |
| 🔌 Skill 系统 | 设计插件机制，让社区能贡献能力而不碰核心 | ⭐⭐ |

不需要懂全部代码。文档、翻译、模型测试、音色整理都能直接上手。

## 怎么参与

- **Star** 仓库：https://github.com/zuiho-kai/Greyfield
- **看 Issues**：带 `good first issue` 标签的适合第一次贡献
- **开 Discussion**：有想法直接聊，不用客气
- **提 PR**：改完提 PR 即可，流程见 [CONTRIBUTING.md](https://github.com/zuiho-kai/Greyfield/blob/master/CONTRIBUTING.md)

## 一句话

大多数 AI 每次对话都是一个新的人。灰风不是。

如果你觉得这个方向有意思，来一起做。
