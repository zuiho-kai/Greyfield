下面是我按**“生长型软件项目设计”**重写的一版规格书骨架。
定位是：保留远景，但只冻结 Spine。
它可以直接作为你现在规格书的替代首页，或者命名成：

docs/growth-spec.md

内容基于你现有规格书的结构和原则重组而来。

greywind-spec-final (1)

灰风（GreyWind）— 生长式系统规格书
0. 文档定位

本文档不是“最终系统一次性设计图”，而是生长式设计文档。

目标：

先让系统活起来

再按真实痛点长出模块

保持脊椎稳定

延迟对复杂架构的承诺

本文档分为两部分：

Spine：当前必须实现的最小系统

Growth Modules：未来可能长出的能力模块

除 Spine 外，其余模块、目录、Agent、记忆层、任务系统均视为扩展位，不代表首期必须实现。这个原则与当前规格书里的 Minimal Spine → Module 渐进演化 一致。

greywind-spec-final (1)

1. 产品定义

一句话：

灰风是一个带人格外壳的个人 AI 助手。

对外，它表现为一个桌面常驻的 Live2D 角色。
对内，它未来可以长成一个具备任务调度、记忆系统、工具执行和多 Agent 协作能力的个人 Agent OS。

greywind-spec-final (1)

2. 设计原则
2.1 先活，再强

任何新模块都必须回答：

没有它，系统还能运行吗？

不能 → Spine

能 → Module

2.2 只冻结脊椎

只有这些东西应当尽量稳定：

单一人格出口：灰风

桌面端负责感知与执行

后端负责决策、任务、记忆

WebSocket 协议尽量只增不改

皮套通过“记忆注入”调用 LLM

引擎层优先搬运而不是魔改 

greywind-spec-final (1)

2.3 模块延迟承诺

任何模块都不提前保证：

必然实现

具体顺序

最终形态

是否长出，由真实使用痛点决定。

2.4 可拆优先于完美

模块失败时，应尽量可以：

删除

替换

降级

而不破坏 Spine。

3. 当前系统边界

当前阶段，灰风不是完整 Agent OS。
当前阶段，灰风只是一个活着的皮套助手。

它应该先做到：

能听你说话

能用你的角色设定回复

能发出语音

能驱动 Live2D 表现

能保留最小记忆

能为后续视觉/动作/任务系统预留接口

4. Spine 定义
4.1 Spine 的目标

Spine 的唯一目标是：

让灰风活起来。

验收方式不是架构完整，而是用户体验成立：

你说话

灰风理解

灰风回复

灰风发声

灰风嘴巴动

灰风知道自己是谁

4.2 Spine 组成

Spine 仅包含以下能力：

Live2D 展示

麦克风输入

VAD

ASR

LLM 调用

TTS

最近对话上下文

memory.json 角色与最小记忆注入

WebSocket 通信

桌面文字输入备选

这和当前规格书中的 Spine 目标一致：
单进程服务，皮套 Agent 直接调 LLM，没有独立主控，也没有蜂巢。

greywind-spec-final (1)

4.3 Spine 不包含

以下内容不属于 Spine：

独立 Conductor

Hive / 多 Agent

任务频道

SQLite 记忆

向量检索

浏览器自动化

桌面自动化

Web 管理后台

Cross-debate / Cross-review

复杂任务状态机

这些都属于未来增长方向。

5. Spine 架构
用户
  │
  ├─ 语音输入 / 文字输入
  │
  ▼
灰风皮套（Persona Runtime）
  ├─ VAD
  ├─ ASR
  ├─ Prompt Assembler
  ├─ LLM
  ├─ TTS
  ├─ Live2D 表情 / 口型
  └─ 最近对话上下文

旁路：
  ├─ memory.json
  └─ character.yaml
5.1 当前真实数据流
你说话
→ 麦克风
→ VAD
→ ASR
→ 组装 prompt
   = 角色设定
   + memory.json
   + 最近对话
   + 你的输入
→ LLM
→ 回复文本
→ TTS
→ 音频播放
→ Live2D 表情 / 口型
5.2 当前系统真相

当前阶段：

Persona = Gateway

Persona = 临时 Conductor

没有独立任务系统

没有蜂巢

也就是说，Spine 阶段灰风本人就是系统的大脑。

6. 当前目录约束

以下目录属于 Spine：

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

桌面端属于 Spine：

frontend/desktop/

配置与数据属于 Spine：

conf.yaml
characters/greywind.yaml
data/memory.json
start.bat
7. 当前消息协议原则

WebSocket 协议从第一天开始就按“只增不改”设计。

当前 Spine 只要求这些基础消息：

客户端 → 服务端：

{ "type": "audio_chunk", "payload": { "audio_base64": "..." } }
{ "type": "text_input", "payload": { "text": "..." } }
{ "type": "interrupt" }

服务端 → 客户端：

{ "type": "transcript", "payload": { "text": "...", "is_final": true } }
{ "type": "reply_text", "payload": { "text": "...", "emotion": "neutral" } }
{ "type": "reply_audio", "payload": { "audio_base64": "...", "duration_ms": 1500 } }
{ "type": "status", "payload": { "state": "thinking|speaking|idle" } }
{ "type": "error", "payload": { "message": "..." } }

未来任务系统和工具执行，只在此基础上扩展字段与消息类型。这个设计和你原规格书保持一致。

greywind-spec-final (1)

8. 当前记忆设计
8.1 当前目标

Spine 阶段不做复杂记忆，只做最小记忆感。

8.2 当前实现

只使用：

最近 N 轮对话

characters/greywind.yaml

data/memory.json

8.3 当前作用

让灰风具备：

知道自己叫灰风

知道基本角色设定

知道你的少量偏好

具备连续对话能力

8.4 当前约束

此阶段不实现：

记忆分类

记忆权重

SQLite

向量检索

任务级记忆隔离

9. 当前验收标准

Spine 完成的标准不是代码结构完整，而是以下体验成立：

start.bat 能一键启动

Live2D 正常显示

麦克风输入后可识别语音

灰风可以回复

TTS 能正常播报

口型可以跟随音频

支持文字输入

最近 10 轮对话有效

memory.json 中的人设能影响回复

更换 LLM 仅需修改配置文件

这与现有规格书里的 Spine 验收标准一致。

greywind-spec-final (1)

10. Growth Modules

以下内容属于未来生长方向，不属于 Spine。

Module A：音色克隆

目标：

接入参考音频

生成更像灰风的声音

触发条件：

当前默认 TTS 声音不可接受

Module B：屏幕感知

目标：

灰风能回答“我现在在看什么”

支持事件触发截图

支持当前窗口识别与屏幕摘要

说明：

不做持续高频全量视觉

优先做事件触发和局部理解

这与规格书后来修订的方向一致。

greywind-spec-final (1)

Module C：浏览器操控

目标：

灰风可执行固定浏览器流程

引入风险分级与确认机制

Module D：桌面操控

目标：

打开应用

输入文字

基础鼠标键盘操作

Module E：任务持久化

目标：

任务有记录

有最小状态机

支持 SQLite

Module F：Web 最小版

目标：

可以查看任务

可以改配置

可以看基础状态

Module G：主控分离

目标：

Persona 不再直接承担全部决策

独立长出 Conductor

这是一个能力压力触发模块：
只有当 Persona 同时承担对话、工具调度、任务推进开始失控时，才应拆出 Conductor。原规格书把主控分离放在 G，这个顺序是合理的。

greywind-spec-final (1)

Module H：任务频道

目标：

一个任务 = 一个频道

频道中同时保留决策流、执行流、产物流

Module I：蜂巢

目标：

多 Agent 协作

交叉审核

子任务拆分与并行

注意：
蜂巢不是远景口号，而是单主控开始吃不消时才需要长出的器官。

Module J：SQLite 记忆

目标：

按类型、重要度、时间筛选记忆

重启后保留长期偏好

Module K：向量记忆

目标：

语义检索相关记忆

支持更长时间跨度的经验回忆

Module L：表情联动

目标：

让文本情绪映射到 Live2D 表情

Module M：悬浮球 / 托盘

目标：

让灰风更像桌面常驻助手

Module N：主动播报

目标：

后台任务完成、失败、卡住时主动提醒用户

11. 增长顺序原则

Module 不按预设路线强行推进。
选择顺序只由真实使用痛点决定。

判断方法：

不做它，当前体验最痛的地方是什么？

这个痛点是否被用户真实频繁遇到？

这个模块是否会破坏 Spine？

这个模块失败后能否整体拆掉？

如果答案不明确，就不做。

12. 远景保留，但不冻结

未来，灰风可以生长成：

桌面人格体

主控 Agent

专家蜂巢

任务频道系统

长期记忆系统

工具执行网络

但这些都只是生长方向，不是首期承诺。

当前项目只承诺：

先把一个活着的灰风做出来。

13. 当前开发指令
当前只做三件事
第一步：搬运引擎

按现有规格书的方式搬运 OLV 引擎模块，保持内部逻辑不改，只改 import 路径。

greywind-spec-final (1)

第二步：实现 Spine

实现：

配置加载

JSON 记忆

语音管线

FastAPI + WebSocket

Electron 桌面壳

Live2D 播报与口型同步

第三步：体验验证

只验证：

灰风能否自然存活

语音链路是否顺

人设是否成立

延迟是否可接受

在此之前，不启动：

多 Agent

Hive

SQLite

Web 端

浏览器操作

长任务系统

14. 最终原则

一句话总结：

灰风不是先被设计完整，再去实现；
而是先活成一个最小人格体，再按真实使用痛点长出器官。

如果你要，我下一步可以继续把这份文档直接整理成两份可落地文件：

docs/spine.md

docs/growth-modules.md

这样你就能直接放进项目里用了。