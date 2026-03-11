System Architecture Document
1. 项目概述

GrayWind 是一个 灰风式个人 AI 助手系统。

系统目标：

桌面常驻 AI 助手（Live2D 皮套）

语音交互 + 屏幕理解

可操作电脑与浏览器

后台任务蜂巢执行

Web 控制中心管理任务与记忆

多 Agent 协作执行任务

核心理念来自三个方向：

来源	吸收理念
Neuro	桌面 AI + 多模态 + Live2D
Cat Cafe	任务频道化
Autoresearch	Agent 行为协议
OpenClaw	Gateway control plane
2. 系统核心理念

系统采用 灰风模型（GrayWind Model）：

皮套 Agent（对外人格）
        │
        ▼
主控 Agent（Conductor）
        │
        ▼
蜂巢 Agent Pool（Specialists）

比喻：

层	类比
皮套	灰风实体
主控	纳米机器人指挥核心
工蜂	纳米机器人群
频道	工作群
3. 系统总体架构
┌─────────────────────────────────────────────┐
│           GrayWind Assistant OS              │
└─────────────────────────────────────────────┘

   用户界面层
┌───────────────────┐     ┌─────────────────────┐
│ Desktop Persona   │     │ Web Control Center  │
│                   │     │                     │
│ Live2D 皮套       │     │ 任务看板             │
│ 语音交互          │     │ 任务频道             │
│ 屏幕感知          │     │ 设置管理             │
│ 状态播报          │     │ 记忆浏览             │
└──────────┬────────┘     └──────────┬──────────┘
           │                         │
           └─────────────┬───────────┘
                         ▼

               ┌───────────────────┐
               │ Gateway / Spine   │
               │                   │
               │ Session Router    │
               │ Event Bus         │
               │ Prompt Builder    │
               │ Memory Resolver   │
               │ Tool Dispatcher   │
               │ Task Projection   │
               └─────────┬─────────┘
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼

┌─────────────────────┐        ┌─────────────────────┐
│ Conductor Agent     │        │ Task Channel System │
│                     │        │                     │
│ 目标理解            │        │ 任务状态             │
│ 任务拆解            │        │ timeline            │
│ Agent调度           │        │ artifacts           │
│ 预算控制            │        │ worklog             │
└──────────┬──────────┘        └──────────┬──────────┘
           │                              │
           ▼                              ▼

┌───────────────────────────────────────────┐
│            Specialist Agent Hive           │
│                                           │
│ Operator     桌面操作                     │
│ Researcher   信息检索                     │
│ Planner      任务规划                     │
│ Reviewer     结果验证                     │
│ Reporter     状态汇报                     │
└──────────────┬────────────────────────────┘
               │
               ▼

┌────────────────────────────────────────────┐
│                Tool Layer                  │
│                                            │
│ STT / TTS                                  │
│ Screen Capture                             │
│ Vision API                                 │
│ Browser Automation                         │
│ Desktop Control                            │
│ File / Shell                               │
│ Scheduler                                  │
└───────────────┬────────────────────────────┘
                │
                ▼

┌────────────────────────────────────────────┐
│              Memory System                 │
│                                            │
│ Persona Memory                             │
│ Relationship Memory                        │
│ Task Memory                                │
│ Procedural Memory                          │
│ Archive Memory                             │
└────────────────────────────────────────────┘
4. 系统核心组件
4.1 Desktop Persona（桌面皮套）

桌面端是 对用户唯一暴露的人格界面。

功能：

Live2D 角色展示

语音输入输出

屏幕理解

状态播报

桌面提醒

主要模块：

desktop-shell
 ├─ live2d renderer
 ├─ microphone capture
 ├─ speaker output
 ├─ screen capture
 ├─ desktop actions
 └─ gateway connection
4.2 Web Control Center

Web 控制中心用于任务管理。

主要页面：

Dashboard

当前任务

系统状态

Agent运行状态

Task Board

Kanban 看板：

Inbox
Planned
Running
Blocked
Review
Done
Task Channel

任务频道类似 工作群。

结构：

task-channel
 ├─ timeline
 ├─ worklog
 ├─ artifacts
 ├─ decisions
 ├─ lessons
 └─ research
Settings

配置：

模型

Agent

权限

记忆

5. Gateway（系统脊椎）

Gateway 是系统核心。

职责：

API

WebSocket

Prompt组装

Agent调度

Tool调用

Memory查询

任务事件

gateway
 ├─ session manager
 ├─ prompt builder
 ├─ memory resolver
 ├─ tool dispatcher
 ├─ event bus
 └─ conductor runtime
6. Conductor Agent

主控 Agent。

职责：

理解用户目标

拆分任务

调度 Agent

汇总结果

管理任务状态

流程：

User Input
    │
    ▼
Goal Understanding
    │
    ▼
Task Decomposition
    │
    ▼
Agent Assignment
    │
    ▼
Result Aggregation
7. Specialist Hive

蜂巢 Agent 池。

Agent	职责
Operator	浏览器 / 桌面操作
Researcher	信息收集
Planner	任务拆解
Reviewer	结果验证
Reporter	状态播报
8. Tool Layer

系统能力层。

tools
 ├─ speech
 │   ├─ STT
 │   └─ TTS
 │
 ├─ vision
 │   ├─ screenshot
 │   └─ OCR
 │
 ├─ browser
 │   └─ automation
 │
 ├─ desktop
 │   └─ mouse/keyboard
 │
 ├─ file
 │   └─ filesystem
 │
 └─ schedule
     └─ cron
9. Memory System

记忆系统分层。

memory
 ├─ persona_memory
 │   角色设定
 │
 ├─ relationship_memory
 │   用户关系
 │
 ├─ task_memory
 │   任务历史
 │
 ├─ procedural_memory
 │   SOP / 技能
 │
 └─ archive_memory
     长期知识
10. Persona Packet

皮套不直接访问数据库。

而是通过 Memory Resolver 获取：

PersonaPacket
{
 identity
 relation
 style
 current_focus
 unread_events
 relevant_memories
}

LLM Prompt：

system prompt
+ persona packet
+ recent dialogue
+ screen context
+ user input
11. Spine 渐进架构

系统通过 Spine 方法逐步成长。

Phase 0
Live2D
STT
TTS
Single LLM
Phase 1
+ Screen Understanding
Phase 2
+ Browser Automation
Phase 3
+ Task Persistence
+ Web Console
Phase 4
Skin Agent
↓
Conductor Agent
Phase 5
Specialist Agents
12. 系统事件流
语音交互
User Speech
   │
STT
   │
Prompt Builder
   │
LLM
   │
TTS
   │
Live2D Animation
任务执行
User Request
    │
Skin Agent
    │
Conductor
    │
Operator Agent
    │
Tool Execution
    │
Worklog
    │
Reporter
    │
Skin Agent Feedback
13. 代码目录结构
graywind/
├─ apps/
│  ├─ desktop-shell
│  ├─ web-console
│  └─ gateway
│
├─ core/
│  ├─ conductor
│  ├─ agents
│  ├─ memory
│  ├─ tasks
│  └─ channels
│
├─ adapters/
│  ├─ stt
│  ├─ tts
│  ├─ vision
│  ├─ browser
│  ├─ desktop
│  └─ llm
│
├─ workspace/
│  ├─ agent-profiles
│  ├─ skills
│  └─ program
│
└─ data/
   ├─ db.sqlite
   ├─ artifacts
   └─ indexes
14. 关键设计原则
1️⃣ 皮套不是系统

皮套只是 UI。

任务与记忆都在后端。

2️⃣ Gateway 是唯一脊椎

所有组件通过 Gateway 通信。

3️⃣ 任务频道是真实工作空间

频道保存：

worklog

artifacts

knowledge

4️⃣ Agent 行为外置

行为定义：

workspace/program/*.md
15. MVP 定义

MVP 能力：

Live2D 桌宠

语音对话

屏幕理解

浏览器自动流程

简单任务记录

16. 最终目标

构建一个：

灰风式 AI 助手操作系统

特征：

单人格接口

蜂巢执行

持续记忆

多任务协作

桌面常驻

如果你愿意，我可以继续帮你把这份文档升级成 完整 repo 设计包，包括：

PRD.md

MVP roadmap

Agent spec

Prompt spec

Task schema

Memory schema

这样基本就可以直接开项目开发了。