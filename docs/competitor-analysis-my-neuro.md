# 竞品分析：my-neuro

> 分析日期：2026-03-16
> 仓库：https://github.com/morettt/my-neuro
> 版本：v6.3.5 | Stars：1072 | 语言：Python + JavaScript

## 1. 项目定位

my-neuro 是一个开源桌面 AI 角色工作台，受 Neuro-sama 启发。核心理念是"提供工具，用户自己拼装理想 AI 形象"——可训练声音、定制性格、替换 Live2D 形象。

默认角色"肥牛"（fake neuro）是一个腹黑傲娇的 AI 桌面宠物。

与灰风的根本区别：my-neuro 是**模块拼装工作台**，灰风是**人格连续性引擎**。

## 2. 技术栈对比

| 层 | GreyWind | my-neuro |
|---|---|---|
| 前端框架 | Electron 33 + 原生 JS | Electron 28 + Express 中转 |
| Live2D | pixi-live2d（renderer 内） | pixi.js 6 + pixi-live2d-display |
| 后端 | Python FastAPI（单进程） | Python Flask + 多独立进程 |
| 进程模型 | FastAPI 统一服务 | 每个引擎独立进程（.bat 分别启动） |
| LLM | OpenAI SDK（硅基流动） | OpenAI 兼容 API（闭源 + 本地开源） |
| ASR | 硅基流动 SenseVoiceSmall | FunASR 本地（WebSocket VAD + HTTP ASR） |
| TTS | 硅基流动 CosyVoice2 / edge-tts | GPT-SoVITS 本地训练 / 硅基流动 / 阿里云 CosyVoice |
| VAD | Silero VAD（onnxruntime） | FunASR 内置 VAD |
| 情感识别 | emotion_mapper（LLM 输出标签） | BERT 分类模型（独立服务 :6007） |
| 记忆 | memory.json（最小 JSON） | MemOS（Qdrant 向量 + NetworkX 图谱 + WebUI） |
| 通信 | WebSocket（FastAPI 原生） | Flask + Socket.IO |
| 构建 | electron-builder + uv | electron + PyInstaller |
| 包管理 | uv（Python）+ npm | pip + npm |

## 3. 架构差异

### GreyWind：上下文运行时驱动

灰风的核心是 Context Runtime——类型化上下文装配系统（Persona / Thread / Session / Handoff）。每轮响应前装配完整上下文包，设计目标是人格连续性。当前最小实现只装配 persona + thread_id + session_id + recent dialogue + memory.json，但接口为 handoff、长期记忆检索、任务绑定预留了扩展点。

单进程 FastAPI 架构，内聚度高，部署简单。

### my-neuro：微服务拼装

ASR（:1000）、TTS（:5000）、BERT（:6007）、RAG（:8002）、LLM 各自独立进程，通过 HTTP/WebSocket 互调。前端 Electron 是主控，Node Express 做中转层。

没有显式的上下文运行时概念，对话历史靠 `context.max_messages`（默认 18 条）截断。记忆系统（MemOS）是独立模块，有自己的 WebUI。

优点：各模块可独立替换、独立调试。
缺点：启动复杂（多个 .bat），进程间通信开销大，没有统一的上下文管理。

## 4. 功能矩阵

| 功能 | GreyWind | my-neuro | 备注 |
|---|:---:|:---:|---|
| Live2D 展示 | ✅ | ✅ | 都用 pixi-live2d |
| 语音输入（ASR） | ✅ | ✅ | 灰风云端，my-neuro 本地 FunASR |
| 语音输出（TTS） | ✅ | ✅ | 灰风云端流式，my-neuro 支持本地训练 |
| 语音打断 | ✅ | ✅ | |
| 口型同步 | ✅ | ✅ | |
| 表情联动 | ✅ LLM 标签 | ✅ BERT 分类 | my-neuro 更快更稳 |
| 上下文连续性 | ✅ Thread/Session | ⚠️ 截断窗口 | 灰风架构优势 |
| 人格注入 | ✅ character.yaml | ✅ config.json system_prompt | |
| 长期记忆 | ⚠️ memory.json | ✅ MemOS 向量+图谱 | my-neuro 更成熟 |
| RAG 知识库 | ❌ 预留 | ✅ sentence-transformers | |
| 视觉/截屏 | ✅ | ✅ | 都用 screenshot-desktop |
| TTS 声音训练 | ❌ 计划中 | ✅ GPT-SoVITS | |
| 桌面控制 | ❌ 计划中 | ✅ pyautogui | |
| MCP 工具 | ❌ | ✅ @modelcontextprotocol/sdk | |
| 游戏联动 | ❌ | ✅ Minecraft/galgame | |
| B站直播 | ❌ | ✅ 弹幕互动 | |
| 主动对话 | ❌ | ✅ V1 | |
| 插件系统 | ❌ | ✅ plugins 目录 | |
| 手机 App | ❌ | ✅ 安卓 | |
| AI 唱歌 | ❌ | ✅ | |
| 本地 LLM | ❌ | ✅ LLM-studio | |

## 5. 可借鉴点

### 5.1 短期（符合 spine-now 下一阶段）

**TTS 音色克隆路径**
- my-neuro 用 GPT-SoVITS，社区成熟，有完整训练流程（`Voice_Model_Factory`）
- 灰风已有 CosyVoice 方案（`docs/plan-cosyvoice-local-tts.md`）
- 建议：两条路径对比评估，GPT-SoVITS 开源可控，CosyVoice 云端集成方便

**BERT 情感分类**
- my-neuro 的 `omni_bert_api.py` 用独立 BERT 服务做情感分类，结果驱动 Live2D 表情/动作
- 比灰风当前的 LLM 输出标签方案延迟更低、更稳定
- 建议：可作为 emotion_mapper 的升级路径参考

### 5.2 中期（Module 阶段）

**记忆系统分层（MemOS）**
- 向量数据库（Qdrant）+ 轻量图数据库（NetworkX）双引擎
- 有独立 WebUI 管理界面
- 灰风 architecture-v2 已预留 store_vector / store_sqlite 接口，可参考其分层设计

**RAG 知识注入**
- sentence-transformers 本地嵌入 + 检索
- 灰风 context-runtime 已预留 retrieved memory 槽位，实现时可参考

**插件系统设计**
- my-neuro 的 plugins 目录 + 热加载机制
- 灰风 Phase 3 有 Skill/插件平台计划，可参考其接口设计

### 5.3 不建议借鉴

- **微服务拆分方式**：每个引擎独立进程 + .bat 启动，部署复杂，灰风单进程 FastAPI 更干净
- **对话历史管理**：纯截断窗口，没有 thread/session 概念，灰风的 Context Runtime 设计更优
- **游戏联动/直播**：灰风 spine-now 明确列为"当前不做"
- **桌面控制**：同上，当前阶段不做

## 6. 关键文件索引

供后续深入参考时快速定位：

| 文件/目录 | 内容 |
|---|---|
| `live-2d/config.json` | 全局配置（LLM/ASR/TTS/BERT/RAG/视觉/游戏/UI） |
| `live-2d/main.js` | Electron 主进程 |
| `live-2d/app.js` | Flask 后端主入口 |
| `live-2d/start.py` | 启动脚本（Flask + npm start） |
| `live-2d/plugins/` | 插件目录 |
| `live-2d/mcp/` | MCP 工具配置 |
| `full-hub/asr_api.py` | ASR 服务（FunASR） |
| `full-hub/omni_bert_api.py` | BERT 情感分类服务 |
| `full-hub/tts-hub/` | TTS 引擎（GPT-SoVITS） |
| `full-hub/rag-hub/` | RAG 知识检索 |
| `memos_system/` | MemOS 记忆系统（向量+图谱+WebUI） |
| `requirements.txt` | Python 依赖清单 |

## 7. 一句话总结

my-neuro 是功能丰富但架构松散的"AI 角色工作台"，灰风是架构严谨但功能精简的"AI 人格引擎"。灰风可从 my-neuro 借鉴 TTS 训练链路、BERT 情感分类、记忆系统分层三块已验证的实现经验，但不需要照搬其微服务拼装架构。
