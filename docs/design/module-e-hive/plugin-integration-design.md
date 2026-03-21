# Module E 虫巢系统 — 插件化接入设计文档

> 创建时间：2026-03-21
> 目标：让虫巢系统成为灰风后端的一个可选配插件
> 约束：保持 Persona Shell 唯一对外人格，不破坏现有语音交互流

---

## 1. 架构模式选择（组合 + 策略模式）

### 1.1 整体架构

```
VoicePipeline（保持不变）
    ↓ 委托决策
DecisionRuntime（抽象接口）
    ├─ SimpleDecisionRuntime（当前Spine模式）
    └─ HiveDecisionRuntime（虫巢模式）
        ↓ 调度
    Overmind → Submind → Brood → Unit → Execution
```

### 1.2 模式选择理由

**选择组合+策略模式：**

- **组合模式**: VoicePipeline 不直接调用 LLM，而是委托给 DecisionRuntime 接口。切换模式时 VoicePipeline 代码不变
- **策略模式**: 两种决策实现（简单/Hive）可以运行时切换，甚至 per-thread 选择不同策略
- **符合现有架构**: 与当前 browser/desktop 配置开关模式一致

**对比其他模式：**

| 模式 | 为什么不选 |
|------|-----------|
| 钩子/拦截器 | 需要侵入 VoicePipeline 内部，破坏流式逻辑 |
| 装饰器 | 层层包装会让调用栈太深，调试困难 |
| 完全替换 | 需要维护两套 VoicePipeline，代码重复 |

---

## 2. 关键接入点设计

### 2.1 新增接口层（src/greywind/decision_runtime/）

```python
# decision_runtime/interface.py
from abc import ABC, abstractmethod
from typing import Callable, AsyncIterator, Any
from dataclasses import dataclass

@dataclass
class DecisionEvent:
    """决策事件 —— 统一输出格式"""
    type: str  # "text_delta" | "tool_call" | "status_change" | "handoff_request" | "channel_update"
    payload: dict

class DecisionRuntime(ABC):
    """决策运行时抽象 —— 无论是简单LLM还是Hive，对外统一接口"""

    @abstractmethod
    async def process(
        self,
        context_packet: "ContextPacket",  # 来自 Context Runtime
        send_fn: Callable,                # 向用户发送消息
        send_audio_fn: Callable,          # 发送音频
        interrupt_flag: Callable[[], bool],  # 检查是否被中断
    ) -> AsyncIterator[DecisionEvent]:
        """
        处理用户输入，产生决策事件流
        """
        pass

    @abstractmethod
    def get_name(self) -> str:
        """返回运行时名称（用于日志和调试）"""
        pass

# 简单实现（当前Spine行为抽离）
class SimpleDecisionRuntime(DecisionRuntime):
    """原VoicePipeline._respond()的逻辑移到这里"""

    def __init__(self, ctx: "ServiceContext"):
        self.ctx = ctx
        self.llm = ctx.llm
        self.tools = self._collect_tools(ctx)

    async def process(self, context_packet, send_fn, send_audio_fn, interrupt_flag):
        """标准单轮LLM调用"""
        messages = self._build_messages(context_packet)
        system_prompt = self._extract_system_prompt(messages)

        # 流式输出
        async for chunk in self.llm.chat_completion(messages, system=system_prompt):
            if interrupt_flag():
                break

            if isinstance(chunk, str):
                yield DecisionEvent("text_delta", {"text": chunk})
            elif isinstance(chunk, list):  # Tool calls
                yield DecisionEvent("tool_call", {"calls": chunk})

    def get_name(self) -> str:
        return "simple"

# Hive实现（插件）
class HiveDecisionRuntime(DecisionRuntime):
    """虫巢系统实现"""

    def __init__(self, hive_system: "HiveSystem"):
        self.hive = hive_system
        self.overmind = hive_system.overmind

    async def process(self, context_packet, send_fn, send_audio_fn, interrupt_flag):
        """委托给Overmind处理"""
        # 将外部回调转换为Hive内部事件总线
        event_bus = HiveEventBus(
            user_sender=send_fn,
            audio_sender=send_audio_fn,
            interrupt_checker=interrupt_flag,
        )

        async for event in self.overmind.process(context_packet, event_bus):
            # 转换内部事件为标准DecisionEvent
            yield self._convert_event(event)

    def get_name(self) -> str:
        return "hive"
```

### 2.2 VoicePipeline 改造

```python
class VoicePipeline:
    def __init__(self, ctx, screen_sense=None, decision_runtime=None):
        # ... 现有代码 ...

        # 决策运行时改为注入，而非硬编码
        self.decision_runtime = decision_runtime or SimpleDecisionRuntime(ctx)
        logger.info(f"使用决策运行时: {self.decision_runtime.get_name()}")

    async def _respond(self, user_text, send_fn, send_audio_fn):
        """重构：委托给 DecisionRuntime"""
        self._interrupted = False
        self._responding = True

        try:
            await send_fn({"type": "status", "payload": {"state": "thinking"}})

            # 构建 Context Packet（保持不变）
            context_packet = self._build_context_packet(user_text)

            # 委托决策（不管是Simple还是Hive，接口一样）
            async for event in self.decision_runtime.process(
                context_packet, send_fn, send_audio_fn,
                lambda: self._interrupted
            ):
                await self._handle_decision_event(event, send_fn, send_audio_fn)

        except asyncio.CancelledError:
            logger.info("响应被打断")
        except Exception as e:
            logger.error(f"响应出错: {e}")
            await send_fn({"type": "error", "payload": {"message": str(e)}})
        finally:
            self._responding = False
            if not self._interrupted:
                await send_fn({"type": "status", "payload": {"state": "idle"}})

    async def _handle_decision_event(self, event: DecisionEvent, send_fn, send_audio_fn):
        """处理决策事件"""
        if event.type == "text_delta":
            # 累积并流式TTS
            await self._handle_text_stream(event.payload["text"], send_fn, send_audio_fn)
        elif event.type == "tool_call":
            # 执行工具调用
            await self._handle_tool_calls(event.payload["calls"], send_fn, send_audio_fn)
        elif event.type == "status_change":
            # 状态更新
            await send_fn({"type": "status", "payload": {"state": event.payload["state"]}})
        elif event.type == "channel_update" and event.payload.get("expose"):
            # 内部频道更新（可选暴露给用户）
            await send_fn({"type": "channel_update", "payload": event.payload})
```

### 2.3 Context Packet 扩展

```python
# context_runtime/models.py

@dataclass
class ContextPacket:
    """上下文数据包 —— 每轮决策的完整输入"""
    # 现有字段
    persona: PersonaSlot
    vision: VisionSlot | None
    thread: ThreadSlot
    session: SessionSlot
    handoff: HandoffSlot | None
    retrieved: list[RetrievedSlot]
    user_input: UserInputSlot

    # 新增：运行时状态（仅Hive模式有效）
    hive_state: HiveStateSlot | None = None  # 当前有哪些Submind在运行等

    # 元信息
    runtime_mode: str = "simple"  # "simple" | "hive" | "auto"

@dataclass
class HiveStateSlot:
    """虫巢状态槽 —— 可选注入"""
    active_subminds: list[SubmindInfo]      # 当前活跃的Submind
    active_broods: list[BroodInfo]          # 当前活跃的Brood
    trial_channels: list[TrialInfo]         # 正在进行的赛马
    overmind_status: str                    # 主脑状态
    pending_tasks: int = 0                  # 待处理任务数

    def to_prompt_text(self) -> str:
        """转换为Prompt文本片段"""
        lines = ["【虫巢状态】"]
        lines.append(f"主脑: {self.overmind_status}")
        if self.active_subminds:
            lines.append(f"活跃小主脑: {', '.join(s.name for s in self.active_subminds)}")
        if self.active_broods:
            lines.append(f"工作组: {len(self.active_broods)}个")
        return "\n".join(lines)
```

---

## 3. 配置机制

### 3.1 conf.yaml 扩展

```yaml
# conf.yaml 扩展 —— plugins 段

server:
  host: "127.0.0.1"
  port: 12393

# ... 现有配置 ...

# 插件配置段
plugins:
  hive:
    enabled: false              # 总开关
    mode: "auto"                # auto | simple | hive
                                # auto = 根据任务复杂度自动选择

    # 主脑配置
    overmind:
      model: "claude-sonnet-4-20250514"  # 主脑用大模型
      complexity_threshold: 0.7          # 复杂度阈值，超过则启用Hive

    # 小主脑池（常驻）
    resident_subminds:
      - name: "code-expert"
        domain: ["code", "debug"]
        model: "gpt-4o"
        system_prompt: "你是代码专家，擅长编程和调试..."
      - name: "researcher"
        domain: ["search", "analysis"]
        model: "gpt-4o-mini"
      - name: "planner"
        domain: ["plan", "design"]
        model: "claude-sonnet-4-20250514"

    # 存储配置
    storage:
      phase: "sqlite"          # sqlite | postgres
      path: "data/hive.db"

    # 频道配置
    channels:
      expose_to_user: true     # 是否向用户暴露内部频道
      max_visible: 10          # 用户最多同时看到多少频道
      default_collapsed: true  # 默认折叠内部消息

    # 进化层（Phase 3+）
    evolution:
      enabled: false           # 初始关闭，稳定后再开
      trial_threshold: 0.8     # 触发赛马的复杂度阈值
      gene_pool_path: "data/gene_pool/"

    # 工具能力（继承主系统，可覆盖）
    tools:
      inherit_from_main: true  # 继承主系统的工具
      custom_tools: []         # Hive特有工具

# 未来可扩展其他插件
# plugins:
#   task_engine:
#     enabled: false
#   memory_v2:
#     enabled: false
```

### 3.2 Pydantic 配置模型

```python
# config/models.py

from typing import Literal, Optional
from pydantic import BaseModel, Field

class OvermindConfig(BaseModel):
    """主脑配置"""
    model: str = "claude-sonnet-4-20250514"
    complexity_threshold: float = 0.7
    max_concurrent_broods: int = 5

class SubmindConfig(BaseModel):
    """小主脑配置"""
    name: str
    domain: list[str]
    model: str
    system_prompt: Optional[str] = None
    resident: bool = True  # 是否常驻内存

class HiveStorageConfig(BaseModel):
    """存储配置"""
    phase: Literal["sqlite", "postgres"] = "sqlite"
    path: str = "data/hive.db"
    postgres_url: Optional[str] = None  # phase=postgres时使用

class HiveChannelConfig(BaseModel):
    """频道配置"""
    expose_to_user: bool = True
    max_visible: int = 10
    default_collapsed: bool = True

class HiveEvolutionConfig(BaseModel):
    """进化层配置"""
    enabled: bool = False
    trial_threshold: float = 0.8
    gene_pool_path: str = "data/gene_pool/"

class HiveConfig(BaseModel):
    """虫巢系统配置"""
    enabled: bool = False
    mode: Literal["auto", "simple", "hive"] = "auto"
    overmind: OvermindConfig = Field(default_factory=OvermindConfig)
    resident_subminds: list[SubmindConfig] = Field(default_factory=list)
    storage: HiveStorageConfig = Field(default_factory=HiveStorageConfig)
    channels: HiveChannelConfig = Field(default_factory=HiveChannelConfig)
    evolution: HiveEvolutionConfig = Field(default_factory=HiveEvolutionConfig)

class PluginsConfig(BaseModel):
    """插件配置聚合"""
    hive: HiveConfig = Field(default_factory=HiveConfig)

# 添加到 AppConfig
class AppConfig(BaseModel):
    server: ServerConfig = Field(default_factory=ServerConfig)
    llm: LLMConfig = Field(default_factory=LLMConfig)
    asr: ASRConfig = Field(default_factory=ASRConfig)
    tts: TTSConfig = Field(default_factory=TTSConfig)
    memory: MemoryConfig = Field(default_factory=MemoryConfig)
    screen: ScreenConfig = Field(default_factory=ScreenConfig)
    browser: BrowserConfig = Field(default_factory=BrowserConfig)
    desktop: DesktopConfig = Field(default_factory=DesktopConfig)
    character: str = "greywind"

    # 新增：插件配置
    plugins: PluginsConfig = Field(default_factory=PluginsConfig)
```

---

## 4. 数据流对比

### 4.1 当前 Spine 模式（SimpleDecisionRuntime）

```
用户输入
    ↓
VoicePipeline._respond()
    ↓
ContextPacket 装配
    ├─ Persona
    ├─ Memory
    ├─ Thread + Session
    └─ Recent Dialogue
    ↓
LLM.chat_completion()  ← 直接调用，单轮决策
    ↓
[可能触发 Tool Calls]
    ↓
直接回复用户（流式TTS）
```

**特点**: 单轮决策，直接回复，无任务状态管理

### 4.2 Hive 模式（HiveDecisionRuntime）

```
用户输入
    ↓
VoicePipeline._respond()  （不变，仍流式）
    ↓
ContextPacket 装配（增加 HiveStateSlot）
    ↓
HiveDecisionRuntime.process()
    ↓
Overmind.analyze() —— 战略判断
    ├─ 复杂度 < 阈值 → 直接调度 SimpleUnit 执行（类似当前）
    └─ 复杂度 ≥ 阈值 → 进入Hive流程
        ↓
    Submind 选择/创建（领域匹配）
        ↓
    Submind 分解任务 → 创建 Brood (工作组)
        ├─ Brood A: 方案1
        └─ Brood B: 方案2（条件赛马）
        ↓
    并行/串行调度 Units
        ├─ Unit (刀虫/执行者): 写代码
        ├─ Unit (枪虫/侦察者): 搜索
        └─ Unit (脑虫/分析者): 审查
        ↓
    每个 Unit 触发 Tool Calls（复用现有工具）
        ↓
    结果汇总 → Submind 评估 → Overmind 收敛
        ↓
    通过 DecisionEvent 流式输出到用户
        ├─ text_delta: 灰风说话
        ├─ channel_update: 频道状态（可选暴露）
        └─ status_change: 状态变更
    ↓
    更新 HiveState（战功记录等）
```

**特点**:
- 分层决策，Overmind 只做战略判断
- Submind 负责任务分解和战术调度
- Units 执行具体动作（复用现有 Browser/Desktop 工具）
- 全程流式输出（用户不会感到"卡"）
- 内部频道状态可选择性暴露给用户

---

## 5. 生命周期管理

### 5.1 ServiceContext 扩展

```python
# server/service_context.py

class ServiceContext:
    def __init__(self, config: AppConfig, character: CharacterConfig):
        self.config = config
        self.character = character

        # 现有组件
        self.session = SessionManager()
        self.thread = ThreadResolver()
        self.assembler = PromptAssembler()
        self.memory = JSONMemoryStore()
        self.llm = self._create_llm()
        self.tts = self._create_tts()
        # ... 其他引擎 ...

        # Hive 插件生命周期
        self.hive_system: Optional[HiveSystem] = None
        self.decision_runtime: DecisionRuntime = SimpleDecisionRuntime(self)

        # 初始化插件
        if config.plugins.hive.enabled:
            self._init_hive_plugin()

    def _init_hive_plugin(self):
        """初始化虫巢插件"""
        try:
            # 延迟导入，确保插件可选
            from greywind.plugins.hive import HiveSystem
            from greywind.plugins.hive.runtime import HiveDecisionRuntime
            from greywind.plugins.hive.auto import AutoDecisionRuntime

            logger.info("正在加载 Hive 插件...")

            # 创建 Hive 系统
            self.hive_system = HiveSystem(
                config=self.config.plugins.hive,
                llm=self.llm,  # 主脑用大模型
                tools=self._get_available_tools(),
                storage_path=self.config.plugins.hive.storage.path,
            )

            # 根据配置选择 DecisionRuntime
            mode = self.config.plugins.hive.mode
            if mode == "hive":
                self.decision_runtime = HiveDecisionRuntime(self.hive_system)
                logger.info("Hive 模式：完全接管决策")
            elif mode == "auto":
                self.decision_runtime = AutoDecisionRuntime(
                    simple=SimpleDecisionRuntime(self),
                    hive=HiveDecisionRuntime(self.hive_system),
                    threshold=self.config.plugins.hive.overmind.complexity_threshold,
                )
                logger.info("Auto 模式：根据复杂度自动选择")
            else:
                logger.info("Simple 模式：使用标准决策（Hive已加载但未启用）")

            logger.info("Hive 插件加载成功")

        except ImportError as e:
            logger.warning(f"Hive 插件未安装: {e}")
            logger.info("回退到 SimpleDecisionRuntime")
        except Exception as e:
            logger.error(f"Hive 插件加载失败: {e}")
            logger.info("回退到 SimpleDecisionRuntime")

    def _get_available_tools(self) -> list[Tool]:
        """收集当前可用的工具"""
        tools = []
        if self.browser:
            tools.extend(self.browser.get_tools())
        if self.desktop:
            tools.extend(self.desktop.get_tools())
        return tools

    def create_voice_pipeline(self, screen_sense=None):
        """创建 VoicePipeline 时注入 DecisionRuntime"""
        return VoicePipeline(
            ctx=self,
            screen_sense=screen_sense,
            decision_runtime=self.decision_runtime,  # 注入决策运行时
        )
```

### 5.2 自动模式（AutoDecisionRuntime）

```python
# plugins/hive/auto.py

class AutoDecisionRuntime(DecisionRuntime):
    """自动选择：简单任务用 Simple，复杂任务用 Hive"""

    def __init__(self, simple: SimpleDecisionRuntime, hive: HiveDecisionRuntime, threshold: float):
        self.simple = simple
        self.hive = hive
        self.threshold = threshold
        self._complexity_cache: dict[str, float] = {}

    async def process(self, context_packet, send_fn, send_audio_fn, interrupt_flag):
        """自动判断复杂度并选择运行时"""
        # 计算任务复杂度
        complexity = self._estimate_complexity(context_packet)

        if complexity < self.threshold:
            logger.info(f"任务复杂度 {complexity:.2f} < {self.threshold}，使用 Simple 模式")
            async for event in self.simple.process(context_packet, send_fn, send_audio_fn, interrupt_flag):
                yield event
        else:
            logger.info(f"任务复杂度 {complexity:.2f} >= {self.threshold}，使用 Hive 模式")
            async for event in self.hive.process(context_packet, send_fn, send_audio_fn, interrupt_flag):
                yield event

    def _estimate_complexity(self, context_packet: ContextPacket) -> float:
        """估算任务复杂度（0-1）"""
        user_input = context_packet.user_input.raw_text.lower()

        # 简单规则（后续可用LLM判断）
        simple_keywords = ["你好", "谢谢", "再见", "在吗", "简单", "帮我"]
        complex_keywords = ["研究", "分析", "对比", "优化", "设计", "实现", "爬虫", "自动化"]

        if any(k in user_input for k in simple_keywords):
            return 0.3
        if any(k in user_input for k in complex_keywords):
            return 0.9

        # 默认中等
        return 0.5

    def get_name(self) -> str:
        return "auto"
```

---

## 6. 与现有系统的集成边界

### 6.1 层级职责划分

| 层级 | 现有组件 | Hive 集成方式 | 数据交换 |
|------|---------|--------------|---------|
| **Persona Shell** | VoicePipeline | 委托 DecisionRuntime | ContextPacket → DecisionEvent |
| **Context Runtime** | PromptAssembler | 扩展 HiveStateSlot | Hive 状态注入 Prompt |
| **Decision Runtime** | （新增）Simple/Hive/Auto | 通过接口隔离 | DecisionEvent 流 |
| **Execution Runtime** | Browser/Desktop Tools | Units 复用现有工具 | Tool Call 标准格式 |
| **Persistence** | JSONMemoryStore | Hive 自建存储 | 通过接口查询记忆 |
| **Server** | ws_handler.py | 增加 Hive 状态消息 | task_update / channel_update |
| **Frontend** | Electron 壳 | 新增频道面板（可选） | WebSocket 新消息类型 |

### 6.2 适配器模式（与独立仓库集成）

```python
# plugins/hive/adapter.py

class HivePluginAdapter:
    """适配器：将独立仓库的 HiveSystem 接入主仓库"""

    def __init__(self, config: HiveConfig, ctx: ServiceContext):
        from greyfield_hive import HiveSystem, HiveConfig as ExternalHiveConfig

        # 转换配置
        external_config = ExternalHiveConfig(
            enabled=config.enabled,
            mode=config.mode,
            overmind_model=config.overmind.model,
            subminds=[s.dict() for s in config.resident_subminds],
            storage=config.storage.dict(),
        )

        # 创建外部 Hive 系统
        self.hive = HiveSystem(
            config=external_config,
            llm_adapter=LLMAdapter(ctx.llm),
            tool_adapter=ToolAdapter(ctx),
            event_sink=EventSink(ctx),
        )

    def create_decision_runtime(self) -> DecisionRuntime:
        """返回 DecisionRuntime 实现"""
        return HiveDecisionRuntime(self.hive)

class LLMAdapter:
    """适配主仓库的LLM引擎到Hive接口"""
    def __init__(self, llm):
        self.llm = llm

    async def chat_completion(self, messages, **kwargs):
        # 转换消息格式并调用主仓库LLM
        return self.llm.chat_completion(messages, **kwargs)

class ToolAdapter:
    """适配主仓库的工具到Hive接口"""
    def __init__(self, ctx: ServiceContext):
        self.ctx = ctx

    async def execute(self, tool_name: str, args: dict) -> dict:
        # 调用主仓库的工具执行
        if self.ctx.browser and tool_name.startswith("browser"):
            return await self.ctx.browser.execute(tool_name, args)
        if self.ctx.desktop and tool_name.startswith("desktop"):
            return await self.ctx.desktop.execute(tool_name, args)
        return {"error": f"未知工具: {tool_name}"}
```

---

## 7. 前端/UI 影响

### 7.1 新增 WebSocket 消息类型

```typescript
// 消息类型扩展（仅 Hive 启用时发送）

// 频道状态更新（用户可见内部频道）
interface ChannelUpdateMessage {
  type: "channel_update";
  payload: {
    channel_id: string;
    channel_type: "trunk" | "trial" | "hive" | "submind" | "brood";
    name: string;
    status: "queued" | "running" | "review" | "completed" | "failed";
    participants: Array<{
      id: string;
      name: string;
      level: "L4" | "L3" | "L2" | "L1.5" | "L1" | "L0";
      status: "idle" | "working" | "waiting";
    }>;
    progress: number;  // 0-1
    last_message: string;
    created_at: string;
    updated_at: string;
    parent_channel?: string;  // 父频道ID（用于层级）
  };
}

// 战功/Ledger 更新
interface LedgerUpdateMessage {
  type: "ledger_update";
  payload: {
    type: "kill_mark" | "promotion" | "demotion" | "trial_result";
    timestamp: string;
    unit?: {
      id: string;
      name: string;
      level: string;
      type: "刀虫" | "枪虫" | "脑虫" | "翼虫" | "地虫";
    };
    event: string;
    details: {
      earned?: number;
      total?: number;
      promotion_from?: string;
      promotion_to?: string;
      trial_group?: string;
      winner?: boolean;
    };
  };
}

// 用户可发送的指令（@mention 内部Agent）
interface MentionMessage {
  type: "mention";
  payload: {
    target: string;  // "@刀虫_01" | "submind_code" | "brood_task_001"
    text: string;
    channel_id?: string;
  };
}

// 虫巢系统状态
interface HiveStatusMessage {
  type: "hive_status";
  payload: {
    enabled: boolean;
    overmind_status: "idle" | "thinking" | "scheduling";
    active_subminds: number;
    active_broods: number;
    pending_tasks: number;
    load: number;  // 0-1
  };
}
```

### 7.2 UI 层可选实现

```
┌─────────────────────────────────────────────────────────────┐
│  Electron 桌面窗口                                          │
├──────────┬──────────────────────────────┬───────────────────┤
│          │                              │                   │
│ 频道列表  │    主对话流（灰风）          │   状态面板        │
│ (可选)   │                              │   (可选)          │
│          │  ┌──────────────────────┐   │                   │
│ • 主干   │  │ 用户: 帮我写个爬虫     │   │  • 主脑状态      │
│ • 爬虫   │  │ 灰风: 好的，我来...    │   │  • Submind列表  │
│   任务   │  └──────────────────────┘   │  • Brood进度     │
│   BroodA │                              │  • 战功排行      │
│   BroodB │  [展开/折叠: 内部频道]      │  • 基因库        │
│          │                              │                   │
│          │  ┌──────────────────────┐   │                   │
│          │  │ [刀虫] 正在解析DOM...  │   │                   │
│          │  │ [脑虫] 建议用XPath    │   │                   │
│          │  └──────────────────────┘   │                   │
│          │                              │                   │
│          │  ┌──────────────────────┐   │                   │
│          │  │ [赛马] 方案A vs 方案B  │   │                   │
│          │  │ 实时进度: [████░░░░░░] │   │                   │
│          │  └──────────────────────┘   │                   │
│          │                              │                   │
│          │  用户: @刀虫_01 改用requests │                   │
│          │                              │                   │
│          │                              │                   │
├──────────┴──────────────────────────────┴───────────────────┤
│  输入框 [发送]                                                │
└─────────────────────────────────────────────────────────────┘
```

**UI 实现策略：**
- **Phase 1-2**: 只使用日志输出内部状态，前端不变化
- **Phase 3**: 前端增加可选的"开发模式"面板，显示内部频道
- **Phase 4+**: 完整的三栏布局（频道列表、对话流、状态面板）

---

## 8. 实现阶段划分

### Phase E0 — 接口锁定（当前阶段）

**目标**: 建立插件架构基础，不实现Hive逻辑

**任务清单**:
- [ ] 创建 `decision_runtime/interface.py`（DecisionRuntime 抽象接口）
- [ ] 重构 `VoicePipeline._respond()` 委托给 DecisionRuntime
- [ ] 实现 `SimpleDecisionRuntime`（把现有逻辑抽离）
- [ ] 扩展 `ContextPacket` 支持 `HiveStateSlot`
- [ ] 添加 `config/models.py` HiveConfig 配置项
- [ ] 扩展 `ServiceContext` 支持插件生命周期

**验收标准**:
- 不启用Hive时，系统行为与现在完全一致
- SimpleDecisionRuntime 可以通过单元测试
- 配置文件支持 `plugins.hive.enabled` 开关

### Phase E1 — 基础 Hive

**目标**: Hive 接管任务，但内部单路径执行

**任务清单**:
- [ ] 独立仓库 `greyfield-hive` 创建
- [ ] 实现 `Overmind` 基础版（只做复杂度判断和任务路由）
- [ ] 实现 1 个常驻 `Submind`（如 code-expert）
- [ ] 实现 `Brood` 层级（工作组概念）
- [ ] 实现 `Unit` 基础版（复用现有工具执行）
- [ ] 主仓库实现 `HiveDecisionRuntime` 和 `AutoDecisionRuntime`

**验收标准**:
- 说"帮我写个简单脚本" → 灰风能完成（可能走Simple）
- 说"帮我研究并写个爬虫" → 走Hive，能看到任务开始/结束
- 流式输出保持顺畅，无明显卡顿

### Phase E2 — 多 Brood & 工具链

**目标**: 任务分解为多个 Units 协作

**任务清单**:
- [ ] 实现多 `Unit` 类型（刀虫、枪虫、脑虫）
- [ ] 实现 `Brood` 内部协作（并行/串行执行）
- [ ] 扩展工具链（Units 可以使用 Browser/Desktop 工具）
- [ ] 实现 Submind 的任务分解逻辑
- [ ] 持久化 Brood 执行记录

**验收标准**:
- "帮我研究Python爬虫框架并写个示例" → 能看到枪虫搜索、脑虫分析、刀虫写代码的协作过程
- 任务失败时能定位到具体 Unit

### Phase E3 — 条件赛马

**目标**: 复杂任务自动多路赛马，用户可见过程

**任务清单**:
- [ ] 实现复杂度判断算法（LLM-based）
- [ ] 实现 `TrialChannel`（赛马频道）
- [ ] 实现多 Brood 并行执行（A/B测试）
- [ ] 实现 `Vision Arbiter`（愿景分身）做裁判
- [ ] 实现收敛逻辑（选择胜者，合并结果）
- [ ] 前端支持显示赛马实时进度

**验收标准**:
- "帮我设计一个API" → 触发赛马，看到两个Submind并行工作
- 用户能在TrialChannel中干预（如终止某个分支）
- 灰风最终给出一个收敛后的方案

### Phase E4 — 进化层

**目标**: Units 晋升/降级，基因优化

**任务清单**:
- [ ] 实现 `EvolutionEngine`
- [ ] 实现战功系统（KillMark）
- [ ] 实现基因库（Gene Pool）
- [ ] 实现晋升/降级机制
- [ ] 实现负向学习（失败经验写入基因）
- [ ] 实现基因强制落盘机制

**验收标准**:
- 同一 Unit 多次成功后战功上升
- 失败自动降级或休眠
- 新 Session 能加载优化后的基因模板

---

## 9. 风险与应对

| 风险 | 可能性 | 影响 | 应对策略 |
|------|--------|------|----------|
| Hive 引入后延迟增加 | 中 | 中 | 流式输出保持响应感；Simple模式保留用于快速问答；Auto模式自动选择 |
| 内部频道消息过多 | 低 | 中 | 可配置 `expose_to_user`；前端默认折叠内部消息；提供"安静模式" |
| 插件加载失败导致系统崩溃 | 低 | 高 | 加载失败自动回退到 SimpleDecisionRuntime；try-except包裹初始化 |
| Hive 状态与 Context Runtime 耦合 | 中 | 中 | HiveStateSlot 只是"提示信息"，不改变 Context Runtime 核心逻辑；通过接口隔离 |
| 独立仓库版本不一致 | 中 | 中 | 主仓库 requirements.txt 锁定插件版本；CI/CD 集成测试 |
| 多线程并发问题 | 中 | 高 | 使用 asyncio 单线程模型；Hive 内部队列管理并发；避免共享状态 |
| 战功算法不公平 | 低 | 中 | 结合显式反馈+隐式信号；提供可解释性报告；允许人工调整 |

---

## 10. 与独立仓库的集成

### 10.1 仓库关系

```
greyfield/                    # 主仓库（当前）
├── src/greywind/
│   ├── plugins/              # 插件适配层
│   │   └── hive/             # Hive插件包装器
│   │       ├── __init__.py
│   │       ├── adapter.py    # 适配器实现
│   │       └── runtime.py    # HiveDecisionRuntime
│   └── ...
└── requirements.txt          # 包含 greyfield-hive==x.x.x

greyfield-hive/               # 独立仓库（新）
├── src/greyfield_hive/
│   ├── core/                 # 核心Hive系统
│   │   ├── overmind.py
│   │   ├── submind.py
│   │   ├── brood.py
│   │   └── unit.py
│   ├── evolution/            # 进化层
│   ├── storage/              # 存储层
│   └── interfaces/           # 对外接口
├── tests/
├── docs/
└── pyproject.toml
```

### 10.2 版本管理

| 主仓库版本 | Hive插件版本 | 兼容性 |
|-----------|-------------|--------|
| 0.1.x | 0.1.x | Phase E0-E1 |
| 0.2.x | 0.2.x | Phase E2 |
| 0.3.x | 0.3.x | Phase E3 |
| 1.0.x | 1.0.x | Phase E4+ |

### 10.3 发布流程

1. **Hive仓库**: 独立开发测试 → 打 tag → 发布到 PyPI
2. **主仓库**: 更新 `requirements.txt` → 运行集成测试 → 发布新版本

---

## 11. 下一步行动

1. **确认设计**: 用户审阅并确认此设计文档
2. **创建独立仓库**:
   - 创建 `greyfield-hive` 仓库
   - 设置基础结构（pyproject.toml, src/, tests/）
   - 定义对外接口（主仓库调用的入口）
3. **Phase E0 实现**:
   - 在主仓库实现 DecisionRuntime 接口
   - 抽离 SimpleDecisionRuntime
   - 验证插件架构工作正常
4. **并行开发**:
   - Hive仓库：实现核心Overmind/Submind/Brood/Unit
   - 主仓库：实现适配器和UI扩展

---

*文档版本: v1.0*
*关联文档: `design-v2.md` (虫巢详细设计), `spine-now.md` (当前冻结范围)*
