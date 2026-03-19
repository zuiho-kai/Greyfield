# 参与贡献

灰风现在是早期，正是参与的最好时机。无论你是写代码、做翻译、画角色、还是提建议，都欢迎。

## 快速上手

```bash
# 1. Fork 仓库，然后克隆你的 fork
git clone https://github.com/<你的用户名>/Greyfield.git
cd Greyfield

# 2. 创建开发分支
git checkout -b feat/your-feature

# 3. 安装依赖
uv sync                          # Python 后端
cd frontend/desktop && npm install && cd ../..  # Electron 前端

# 4. 配置
cp conf.example.yaml conf.yaml
# 编辑 conf.yaml，填入硅基流动 API Key（三处）

# 5. 启动开发
# 终端 1：后端
uv run python -m greywind.run
# 终端 2：前端
cd frontend/desktop && npm start
```

## 提交 PR

1. 确保你的改动能正常运行
2. commit message 用中文，简明扼要说清楚改了什么
3. 推送到你的 fork，然后在 GitHub 上开 Pull Request
4. PR 描述里写清楚：改了什么、为什么改、怎么验证

## 不知道从哪开始？

- 看 [Issues](https://github.com/zuiho-kai/Greyfield/issues) 里带 `good first issue` 标签的
- 看 [spine-now.md](./docs/spine-now.md) 了解当前阶段在做什么
- 看 [DevLog](./docs/devlog/devlog-001.md) 了解最近在做什么
- 直接开 [Discussion](https://github.com/zuiho-kai/Greyfield/discussions) 聊你的想法

## 可以贡献的方向

| 方向 | 说明 | 不需要懂全部代码 |
|------|------|:---:|
| 📖 文档 / 翻译 | README 英文化、教程、安装指南 | ✅ |
| 🎨 Live2D 模型 | 测试自己的模型兼容性、报告问题 | ✅ |
| 🗣️ 音色 | 整理可用音色列表、测试 TTS 效果 | ✅ |
| 🐛 Bug 反馈 | 用了之后发现问题，开 Issue 描述复现步骤 | ✅ |
| 🖱️ 桌面操控 | pyautogui 截图定位、操作序列 | |
| 📺 Live2D 直播 | OBS 推流、弹幕互动 | |
| 🔌 Skill 系统 | 设计插件机制 | |

## 代码风格

- Python：遵循项目现有风格，用 Pydantic 做配置校验
- JavaScript：Electron 前端，vanilla JS，不用框架
- commit message：中文，动词开头（如"修复 TTS 断句问题"、"添加音色管理 UI"）

## 有问题？

直接开 [Issue](https://github.com/zuiho-kai/Greyfield/issues) 或 [Discussion](https://github.com/zuiho-kai/Greyfield/discussions)，不用客气。
