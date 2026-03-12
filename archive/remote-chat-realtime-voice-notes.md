# GreyWind 远程聊天归档：Realtime Voice 与本地 Qwen 接入

## 0. 文档定位

本文档归档一次远程聊天里关于 `realtime voice`、`webai-example-realtime-voice-chat`、`AIRI` 与本地 `Qwen` 语音模型接入的判断。

它是参考判断，不是当前开发规格。

当前冻结范围仍以 `spine-now.md` 为准；系统中轴仍以 `architecture-v2.md` 和 `context-runtime.md` 为准。

---

## 1. 一句话结论

`webai-example-realtime-voice-chat` 不是某个模型专用项目，而是一个流式语音架构示例。

本地部署的 Qwen 语音模型能不能接，不取决于“它是不是 Qwen”，而取决于：

1. 它属于哪一类模型
2. 它能不能被封装成统一接口
3. 它是否支持真正的流式输入、流式输出和中断

---

## 2. 先判断模型类型

“Qwen 语音 1.3B”这种说法不够精确。接入前先判断它到底是下面哪一类。

| 类型 | 本质 | 替换哪一层 | 典型接法 |
|------|------|------------|----------|
| TTS 模型 | 文本转语音 | 第 4 层 | `Mic -> VAD -> STT -> LLM -> 本地 TTS -> 播放` |
| Audio / Speech Understanding 模型 | 音频输入、文本输出 | 第 2 层，部分情况下连第 3 层一起承担 | `Mic -> VAD -> 本地 Audio Model -> 文本 -> LLM -> TTS` |
| 端到端语音对话模型 | 音频输入、语音/文本输出 | 第 2、3、4 层 | `Mic -> 端到端语音模型 -> 音频/文本流 -> 播放` |

### 2.1 如果它是 TTS 模型

那它只替换语音输出层，不替换整套 realtime voice。

这是最容易落地的接法，也最适合作为 GreyWind 的第一步本地化尝试。

### 2.2 如果它是 Audio / Speech Understanding 模型

那它更像本地 ASR 或音频理解层。

工程上最关键的问题不是“能不能识别”，而是：

- 能不能分块输入
- 能不能给 partial transcript
- 延迟够不够低

如果只能整段上传、整段返回，就能接，但更像“本地语音服务”，不是强 realtime。

### 2.3 如果它是端到端语音对话模型

这是最理想也最难的一类。

只有同时具备下面几项，才值得直接当统一语音 agent 接入：

- 流式音频输入
- 流式文本或语音输出
- 打断取消
- 低延迟首包

否则它只是“看上去更一体化”，不一定比分层管线更适合当前 GreyWind。

---

## 3. Realtime Voice 仍然是四层

关键判断：

`realtime voice` 不是新架构，而是同一套语音链路的流式执行。

### 3.1 非流式

```text
Mic
-> ASR
-> LLM
-> TTS
-> Audio
```

执行方式是串行阻塞：

```text
说完
-> 完整 ASR
-> 完整 LLM
-> 完整 TTS
-> 开始播放
```

### 3.2 流式

结构仍然是：

```text
Mic
-> ASR
-> LLM
-> TTS
-> Audio
```

只是数据单位从“整段”变成了“流”：

```text
audio chunk
-> partial transcript
-> token stream
-> audio stream
-> 播放
```

### 3.3 关键变化

变化不在层数，而在执行方式：

- ASR 要尽快吐 partial text
- LLM 要尽快吐 token
- TTS 要尽快把第一句变成音频
- 系统要支持 interrupt

所以大多数 realtime voice 工程系统，本质仍然是：

`VAD / ASR -> LLM -> TTS`

只是整条链都变成了 streaming pipeline。

---

## 4. 接入看的不是模型名，而是接口

适配层应该尽量抽象成统一能力接口：

```python
transcribe(audio_chunk) -> partial_or_final_text
generate_reply(text_or_history) -> streaming_text
speak(text) -> audio_chunk_stream
```

如果本地服务能提供这类接口，就能挂进 `webai-example-realtime-voice-chat` 一类项目。

### 4.1 最常见的三种接法

1. 把本地 Qwen 当 TTS 服务
2. 把本地 Qwen 当 STT / Audio Understanding 服务
3. 把本地 Qwen 当统一语音 agent

### 4.2 最低可接受服务形态

作为 TTS：

```text
POST /tts
input: text
output: wav/pcm 或音频分块
```

作为 STT：

```text
POST /stt
input: audio
output: text
```

作为 realtime：

```text
WebSocket /ws
input: audio chunks
output: transcript chunks / text chunks / audio chunks / interrupt ack
```

如果只有一个本地推理脚本、没有服务化接口，也能接，但工程形态会比较笨。

---

## 5. 对 GreyWind 当前最现实的建议

不要把这件事理解成“换方案”。

更准确的理解是：

- GreyWind 当前方案负责 `Spine`
- `architecture-v2.md` 负责中轴
- `webai-example-realtime-voice-chat` 负责语音子系统的 realtime 工程参考

### 5.1 当前最稳的接法

先只替换一层，不要一上来做“端到端本地 realtime 全替换”。

优先顺序：

1. 想先提升说话质感：先接本地 TTS
2. 想先试音频理解：再接本地 STT / Audio Understanding
3. 只有模型天然支持流式输入/输出和打断时，再考虑统一语音 agent

### 5.2 为什么不建议一步到位

因为 GreyWind 当前 Spine 更需要先稳定这些东西：

- VAD
- ASR
- LLM
- TTS
- interrupt
- recent dialogue continuity
- thread_id / session_id
- minimal Context Assembler

先把“能活起来”做稳，比先追求“整套本地 realtime 很先进”更重要。

---

## 6. 和现有文档的关系

这次远程聊天的判断，最终落到三条原则：

1. `realtime voice` 不改变 GreyWind 的四层语音骨架，只改变执行方式
2. Qwen 能否接入，优先看它属于 TTS、Audio Understanding 还是端到端语音模型
3. 当前阶段应该把 `webai-example-realtime-voice-chat` 当作语音事件流与中断机制参考，而不是当总架构模板

对应主文档：

- `spine-now.md`：当前冻结的 VAD / ASR / LLM / TTS Spine
- `architecture-v2.md`：真正的系统中轴是 Context Runtime，而不是语音壳
- `context-runtime.md`：人格连续性来自上下文运行时，而不是语音链路本身
