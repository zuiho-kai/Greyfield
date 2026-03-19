# Live2D 前端能力移植评估：airi → GreyWind

> 日期：2026-03-19
> 状态：评估阶段，待用户决策

## 1. 背景

GreyWind 当前 Live2D 前端基于原生 JS + pixi.js + pixi-live2d-display + cubism4，功能可用但动画表现力有限。airi（moeru-ai/airi，34.6k stars，MIT）的 Live2D 模块做了大量高质量动画工作，值得借鉴。

本文档评估从 airi 移植 Live2D 能力的可行性、工作量和推荐路径。

## 2. 双方技术栈对比

| 维度 | GreyWind | airi |
|------|----------|------|
| 框架 | 原生 JS（无框架） | Vue 3 + Pinia + VueUse |
| 构建 | 无构建，直接引 min.js | Vite + pnpm monorepo |
| 桌面壳 | Electron | Tauri（Live2D 部分是纯 Web） |
| 渲染库 | pixi.js + pixi-live2d-display + cubism4 | 同（pixi v6 + pixi-live2d-display 0.4） |
| 状态管理 | 全局变量 | Pinia store |
| 唇形同步 | AudioContext 频率分析 → ParamMouthOpenY | wlipsync AudioWorklet → 元音权重映射 |
| 情绪 | 2 状态（thinking/idle） | 9 种情绪 → 动作组映射 |

**关键共同点**：底层渲染库完全一致（pixi + pixi-live2d-display + cubism4），移植的核心障碍在上层框架差异，不在渲染层。

## 3. airi Live2D 模块能力清单

### 3.1 已实现功能

| 功能 | 文件位置 | 复杂度 | GreyWind 现状 |
|------|----------|--------|---------------|
| 自动眨眼状态机 | composables/live2d/motion-manager.ts | 低 | ❌ 未实现 |
| 眼球 saccade 模拟 | composables/live2d/animation.ts | 低 | ❌ 未实现 |
| 9 种情绪映射 | constants/emotions.ts | 低 | ⚠️ 后端有 emotion 字段但前端未接入 |
| wlipsync 元音唇形 | model-driver-lipsync/ | 中 | ⚠️ 有唇形但精度低 |
| 插件化动作管理器 | composables/live2d/motion-manager.ts | 中 | ❌ 未实现 |
| 音乐节拍同步 | composables/live2d/beat-sync.ts | 高 | ❌ 未实现 |
| ZIP 模型加载 + OPFS 缓存 | utils/live2d-zip-loader.ts | 中 | ❌ 未实现（当前用文件系统） |
| 模型预览图生成 | utils/live2d-preview.ts | 低 | ❌ 未实现 |
| VRM 支持 | stage-ui-three/ | 高 | ❌ 未实现 |

### 3.2 架构特点

- **模块化好**：`@proj-airi/stage-ui-live2d` 仅依赖 `stage-shared` 和 `ui` 两个内部包
- **不依赖业务逻辑**：纯渲染/动画层，与 AI/LLM/音频管线无耦合
- **插件化动作系统**：pre/post update hooks，可扩展

## 4. 移植路径分析

### 路径 A：全量移植（引入 Vue 全家桶）

**做法**：Electron renderer 改用 Vue 3 + Vite，整体迁移 airi 的 Live2D 组件。

**优点**：
- 可直接复用 airi 组件，后续跟进上游更新容易
- Vue 生态对 UI 开发效率有明显提升（响应式、组件化、DevTools）
- 为未来更复杂的设置界面、聊天界面打基础

**缺点**：
- 需要重写整个 renderer 层（index.html → Vue SPA）
- 引入构建步骤（Vite），开发流程变复杂
- Electron + Vue 集成有额外的坑（preload、CSP、HMR）
- 工作量：3-5 天密集开发

**适合场景**：计划长期维护，且愿意投入前端架构升级。

### 路径 B：Cherry-pick 核心逻辑（保持原生 JS）

**做法**：从 airi 源码中提取纯逻辑部分，翻译为原生 JS，集成到现有架构。

**优点**：
- 改动范围小，风险低
- 不引入新依赖和构建步骤
- 可按优先级分批实施

**缺点**：
- 需要手动剥离 Vue 响应式逻辑（ref/computed → 普通变量）
- 后续跟进 airi 上游更新需要手动同步
- 部分功能（如 Pinia store 的跨组件状态同步）翻译后会丢失优雅性

**适合场景**：精力有限，先快速提升角色表现力。

### 路径 C：混合方案（渐进式引入 Vue）

**做法**：保持 Electron 壳不变，renderer 中用 `createApp` 挂载 Vue 到 Live2D canvas 区域，其余 UI 暂时保持原生 JS。

**优点**：
- Live2D 部分可直接用 airi 组件
- 不需要一次性重写全部前端
- 渐进式迁移，风险可控

**缺点**：
- 两套体系并存，维护成本高
- Vue 和原生 JS 之间的通信需要额外桥接
- 工作量：2-3 天

**适合场景**：想用 Vue 但不想一步到位。

## 5. 推荐方案

### 当前推荐：路径 B（Cherry-pick），分三批实施

考虑到当前精力有限 + 项目处于 Spine 阶段，优先用最小成本提升角色表现力。

#### 第一批（P0）：半天工作量，体感提升最大

| 功能 | 来源 | 移植方式 |
|------|------|----------|
| 自动眨眼 | airi motion-manager.ts 的 eyeBlink 插件 | 提取状态机逻辑，写成独立 JS 函数 |
| 眼球 saccade | airi animation.ts | 提取概率分布 + 定时器逻辑 |
| 9 种情绪映射 | airi emotions.ts | 建立 emotion → Cubism4 参数映射表，接入后端 emotion 字段 |

#### 第二批（P1）：再加半天，唇形质量提升

| 功能 | 来源 | 移植方式 |
|------|------|----------|
| wlipsync 替换频率分析 | airi model-driver-lipsync | 引入 wlipsync npm 包，替换现有 AudioContext 分析逻辑 |

#### 第三批（P2）：1-2 天，架构升级

| 功能 | 来源 | 移植方式 |
|------|------|----------|
| 插件化动作管理器 | airi motion-manager.ts | 抽象 update loop，支持 pre/post hooks |
| 呼吸动画 | Cubism4 原生支持 | 启用 ParamBreath 参数 |

### 未来考虑：路径 A（全量迁移到 Vue）

当以下条件满足时，可以考虑全面迁移：
- 需要复杂设置界面（模型管理、参数调节面板）
- 需要 VRM 支持
- 决定长期跟进 airi 上游

## 6. 风险点

1. **Cubism4 参数名因模型而异**：不同 Live2D 模型的参数 ID 可能不同，需要做参数名映射或 fallback
2. **wlipsync 的 AudioWorklet 在 Electron 中的兼容性**：需要实测，Electron 的 CSP 可能需要调整
3. **airi 的 pixi-live2d-display 版本（0.4）与 GreyWind 当前版本是否一致**：需要确认，版本不一致可能导致 API 差异

## 7. 决策点（需用户确认）

1. 选择哪条路径？（A/B/C）
2. 如果选 B，是否按推荐的三批优先级实施？
3. 是否考虑未来迁移到 Vue？（影响当前代码组织方式）
