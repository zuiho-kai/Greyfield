灰风（GreyWind）— Spine Now
0. 文档目的

本文件不是远景架构文档。
本文件只定义：

当前这一阶段真正要实现的最小系统。

目标不是：

完整 Agent OS

完整任务系统

多 Agent 协作

长期记忆体系

完整网页后台

目标只有一个：

让灰风活起来，并具备最小连续性。

1. 当前阶段的唯一目标

当前阶段，灰风必须做到：

显示 Live2D 角色

接收语音或文字输入

理解输入并回复

语音播报回复

驱动口型和基础表情

保持最近对话连续性

知道自己是谁

具备最小 thread/session 意识

如果这些没成立，其他一切都不做。

2. 当前版本一句话定义

当前版本的灰风 = 一个具备最小人格、最小上下文装配、最小连续性的桌面 AI 皮套。

当前版本不是：

任务调度系统

蜂巢系统

多 Agent 平台

完整桌面自动化系统

这些都属于后续 Module。

3. 当前冻结的 Spine

以下内容在当前阶段视为 Spine，优先实现且尽量不折腾。

3.1 必须有的能力

Live2D 展示

麦克风输入

文字输入

VAD

ASR

LLM 调用

TTS

音频播放

口型同步

最近对话上下文

memory.json 角色注入

基础 thread_id

基础 session_id

最小 Context Assembler

WebSocket 通信

3.2 必须有的体验

启动就能看到灰风

说一句，它能接住

它说话时嘴巴会动

你打断它时，它能停下

它不会完全忘记刚刚说过的话

它知道自己叫灰风

4. 当前明确不做

以下内容当前阶段明确不做：

独立 Conductor

Hive / 多 Agent

Task Store

Task Channel

Web Dashboard

SQLite 记忆

向量检索

持续高频视觉

Reporter / 主动播报

Cross-Debate

Cross-Review

审批点 UI

多用户 / 多租户

复杂权限系统

这些不是“不需要”，而是“现在不做”。

5. 当前系统形态
5.1 当前角色关系

当前阶段：

Persona = Gateway = 临时 Conductor

也就是说：

灰风皮套本身就是当前唯一决策体

还没有主控分离

还没有蜂巢

还没有任务编排

5.2 当前上下文模型

当前每轮响应只装配：

Persona
+ 基础 thread/session 信息
+ 最近对话
+ memory.json
+ 用户当前输入

不做：

handoff

retrieved long-term memory

SOP 检索

task vision 注入

但接口命名要为未来预留。

6. 当前代码范围

当前只允许创建和实现这些核心部分。

6.1 后端（Python）
src/greywind/
├── engines/
│   ├── asr/
│   ├── tts/
│   ├── vad/
│   ├── llm/
│   └── live2d/
│
├── persona/
│   ├── persona_agent.py
│   ├── voice_pipeline.py
│   ├── lip_sync.py
│   └── emotion_mapper.py
│
├── context_runtime/
│   ├── thread_resolver.py
│   ├── session_manager.py
│   └── prompt_assembler.py
│
├── memory/
│   ├── interface.py
│   └── store_json.py
│
├── server/
│   ├── app.py
│   ├── ws_handler.py
│   └── service_context.py
│
├── config/
│   ├── models.py
│   └── loader.py
│
└── run.py
6.2 前端（桌面端）
frontend/desktop/
├── main.js
├── preload.js
└── renderer/
    ├── index.html
    ├── live2d-renderer.js
    ├── voice-ui.js
    ├── chat-overlay.js
    └── socket-client.js
6.3 配置与数据
conf.yaml
characters/greywind.yaml
data/memory.json
start.bat
7. 当前不创建的目录

当前阶段不要提前建空目录装未来。
以下目录先不创建，或者只保留注释说明，不落实现：

conductor/
hive/
tasks/
database/
frontend/web/
memory/store_sqlite.py
memory/store_vector.py
tools/browser_control.py
tools/desktop_control.py
tools/mcp_manager/
tools/tool_manager/

原因：

防止项目假装自己已经有这些系统

防止注意力被未来结构分散

防止“先搭架子后填内容”的设计幻觉

8. 当前数据流
8.1 主链路
用户说话 / 输入文字
→ VAD / 输入处理
→ ASR（如为语音）
→ Context Assembler
   = character.yaml
   + memory.json
   + thread_id
   + session_id
   + recent dialogue
   + user input
→ LLM
→ 回复文本
→ TTS
→ 音频播放
→ Live2D 嘴型 / 表情
补充理解：

realtime voice 不会改变这条四层主链路。

它改变的是执行方式：

- 音频按 chunk 输入
- ASR 输出 partial transcript
- LLM 输出 token stream
- TTS 输出 audio stream
- 用户可在任意时点打断

也就是说，GreyWind 后续如果升级 realtime，仍然是同一条 `VAD / ASR -> LLM -> TTS` 语音骨架，只是整条链路流式化。

相关归档见：`archive/remote-chat-realtime-voice-notes.md`

8.2 打断链路
检测到新语音输入
→ 立即停止当前 TTS 播放
→ 立即停止当前 LLM 生成（若支持）
→ 更新 session recent state
→ 开始新一轮处理
9. 当前必须实现的 4 个小内核
9.1 Voice Pipeline

职责：

音频输入

VAD

ASR

LLM 调用

TTS

播放控制

打断控制

要求：

尽量流式

不允许“LLM 全吐完再 TTS”

第一段文本能合成就应尽快播报

9.2 Persona Injection

职责：

读取 characters/greywind.yaml

读取 memory.json

形成系统 persona prompt

要求：

简洁稳定

不要把角色设定写死在代码里

配置变化后无需改代码

9.3 Minimal Session Manager

职责：

生成 session_id

保存 recent dialogue

记录当前轮状态

支持最小中断恢复

当前不要求：

handoff

session chain

archive 检索

但字段命名应给未来留路。

9.4 Minimal Thread Resolver

职责：

给当前对话分配 thread_id

当前策略可以极简：

默认一个主 thread

或按手动切换 / 页面上下文分 thread

当前不要求：

复杂语义归并

thread merge / split

历史 thread 检索

但必须先承认：

thread 和 session 不是一回事。

10. 当前配置原则
10.1 配置最小化

conf.yaml 只放你当前真的会改的内容。
这点和现有规格书一致。

greywind-implementation-spec.md

建议保留：

server:
  host: "127.0.0.1"
  port: 12393

llm:
  provider: "openai"
  model: "gpt-4o-mini"
  api_key: "${OPENAI_API_KEY}"

asr:
  engine: "whisper_api"
  model: "whisper-1"

tts:
  engine: "edge_tts"
  voice: "zh-CN-XiaoxiaoNeural"

character: "greywind"

当前先不要放：

browser settings

task settings

vector settings

agent registry settings

11. 当前消息协议

当前只实现最小消息集。

客户端 → 服务端
{ "type": "audio_chunk", "payload": { "audio_base64": "..." } }
{ "type": "text_input", "payload": { "text": "..." } }
{ "type": "interrupt" }
服务端 → 客户端
{ "type": "transcript", "payload": { "text": "...", "is_final": true } }
{ "type": "reply_text", "payload": { "text": "...", "emotion": "neutral" } }
{ "type": "reply_audio", "payload": { "audio_base64": "...", "duration_ms": 1200 } }
{ "type": "status", "payload": { "state": "idle|thinking|speaking" } }
{ "type": "error", "payload": { "message": "..." } }

当前不实现：

task_update

confirm_request

channel_message

approval events

12. 当前验收标准

只有以下全部成立，Spine 才算完成。

12.1 启动

start.bat 可一键启动

桌面窗口可打开

Live2D 模型正常显示

12.2 交互

可输入文字

可输入语音

语音能识别成文本

LLM 能回复

TTS 能播报

Live2D 能嘴动

12.3 连续性

最近 10 轮对话可保留

memory.json 能影响回复

每轮上下文装配中带有 thread_id 和 session_id

12.4 体验

新语音输入可打断当前播报

首句回复延迟可接受

不出现“说一句等很久才开始播”的明显卡顿

13. 当前开发顺序

状态标记：⏳ 进行中 | ✅ 完成 | — 未开始

Step 1：搬运引擎 ✅

只搬：

ASR

TTS

VAD

LLM

Live2D 相关核心

原则：

只改 import

不改引擎逻辑

先验证能实例化

这与你原规格书的搬运策略一致。

greywind-implementation-spec.md

Step 2：配置系统 ✅

实现：

conf.yaml

characters/greywind.yaml

环境变量替换

Pydantic 校验

Step 3：JSON 记忆 ✅

实现：

加载 memory.json

返回 persona 注入文本

保存少量稳定设定

当前不要做自动抽取长期记忆。

Step 4：最小 Context Runtime ✅

实现：

thread_id

session_id

recent dialogue

prompt assembly

当前不要做：

handoff

retrieval

vision

task binding

Step 5：Voice Pipeline ✅

实现：

语音输入

ASR

prompt assembly

LLM

TTS

播放

打断

Step 6：Electron 壳 ✅

实现：

Live2D 渲染

WebSocket 连接

文字输入框

音频播放

简单状态显示

14. 当前不要优化的东西

这些问题当前阶段不要提前投入太多时间：

完美的表情系统

高级 Live2D 动作

复杂 UI 美化

完整日志面板

通用插件机制

复杂权限管理

多模型路由策略

长期记忆自动提炼

多线程并发任务

Web 端页面

原则：

当前不追求“像一个完整产品”，只追求“形成真实闭环”。

15. 当前阶段的成功标志

如果当前阶段成功，你应该能做到：

1. 启动灰风
2. 对它说话
3. 它接住上下文并回复
4. 它发出声音
5. 它嘴巴会动
6. 你能感觉到“它活着”

如果还没达到这个感觉，就不要进入下一阶段。

16. 下一阶段入口条件

只有当前满足以下条件，才允许进入下一个 Module：

语音链路稳定

Persona 成立

最近上下文连续

打断可用

配置切换可用

日常使用 1 到 2 天没有明显崩点

满足后，再从真实痛点里选下一个 Module：

想让它更像灰风 → A 音色克隆 ✅

想让它知道你在看什么 → B 屏幕感知 ✅

想让它帮你动手 → C 浏览器操控 ✅

想让它帮你操作桌面 → D 桌面操控 ⏳

当前状态：A/B/C 三个 Module 均已实现，D 桌面操控进入开发流程。

17. Module D 桌面操控 — 冻结范围

17.1 一句话定位

让灰风能操作整个桌面：点击、拖拽、打字、截图定位、组合键、窗口管理，覆盖任意本地应用。

17.2 必须有的能力

- 截取全屏/指定区域截图
- 点击指定坐标（单击/双击/右键）
- 在当前焦点输入文字
- 按组合键（Ctrl+C、Alt+Tab 等）
- 拖拽（从 A 到 B）
- 滚动鼠标滚轮
- 查找/列出窗口、激活指定窗口
- 截图回注 LLM，LLM 看截图决定下一步（复用 Module C 的 tool call 循环）

17.3 必须有的体验

- 用户说"帮我打开记事本写点东西"，灰风能找到并打开记事本、输入文字
- 用户说"帮我把这个文件拖到那个文件夹"，灰风能执行拖拽
- 操作过程中灰风能截图确认结果，出错能自行调整
- 操作可被用户语音打断

17.4 明确不做

- 无障碍树（Accessibility Tree）解析 — 用截图 + LLM 视觉理解覆盖
- OCR 文字识别引擎 — LLM 多模态直接看截图
- 录屏/录制宏/回放
- 跨机器远程桌面操控
- 复杂工作流编排引擎

17.5 技术方案

- 底层：pyautogui（点击/拖拽/打字/截图/组合键）
- 元素定位：截图 + LLM 视觉理解（坐标由 LLM 从截图中判断）
- 架构：复用 execution/ 目录，Provider 模式，与 Module C 同级
- 集成：复用 voice_pipeline.py 的 tool call 循环机制

18. 当前进展快照（2026-03-18）

18.1 Spine 阶段：✅ 全部完成

Step 1-6 全部落地，验收标准基本达成：

- 配置系统、JSON 记忆、Context Runtime（thread/session/prompt 装配）均已实现
- Voice Pipeline 完整流式链路：VAD→ASR→LLM→TTS，含打断、think block 流式过滤
- Electron 桌面壳：Live2D 渲染、WebSocket、语音 UI、聊天覆盖层、系统托盘、高 DPI、鼠标穿透
- 已有 dist 构建产物（greywind-desktop-0.1.0-x64.nsis.7z），打包流程跑通

18.2 Module B 屏幕感知：⏳ 基本可用，打磨稳定性中

已完成：

- screen_sense.py：截图缓冲区、像素差异检测（RMSE）、主动触发判断、冷却机制
- 前端截屏链路经历三轮迭代：desktopCapturer → screenshot-desktop → koffi Win32 API 纯内存截屏
- 截屏移至主进程（遵守 DEV-86 重数据不经渲染进程）
- 截屏默认关闭，前端可控开关
- prompt_assembler 已支持 screen_image_b64 注入

已解决的关键问题：

- 截屏导致 Live2D 闪烁 → 用 koffi 原生 Win32 API 根治，无子进程、无 DWM 刷新
- 前台窗口标题过滤 + 多屏独立差异检测，避免动态壁纸等误触发

18.3 下一步方向

按 spine-now 第 16 节入口条件，Spine 已具备毕业条件。后续从真实痛点选 Module：

- A 音色克隆 — 让灰风更像灰风
- B 屏幕感知 — 继续深化（当前已基本可用）
- C 浏览器操控 — 让灰风能帮你动手

19. 一句话总结

Spine Now 不是在实现灰风的全部。
Spine Now 只是在制造一个真正能开口、能连续、能活下来的灰风雏形。
