"""Voice Pipeline — VAD->ASR->LLM->TTS 流式语音管线"""

import asyncio
import re
from pathlib import Path

import numpy as np
from loguru import logger

SENTENCE_DELIMITERS = re.compile(r"(?<=[。！？.!?\n])")
_LLM_TAG_RE = re.compile(r"^(think|text|thought)\s*[:：]\s*", re.IGNORECASE)
_THINK_BLOCK_RE = re.compile(r"<think>[\s\S]*?</think>")
_STRAY_TAG_RE = re.compile(r"</?(think|text|thought)>", re.IGNORECASE)
_CONTROL_TOKEN_RE = re.compile(r"<\|[^|]*\|>")


def _strip_think_streaming(
    text: str, inside: bool, pending: str = ""
) -> tuple[str, bool, str]:
    """流式过滤 think block，返回 (过滤后文本, 是否仍在 think block 内, 待定缓冲)。

    逐 chunk 调用，正确处理标签被 chunk 边界拆开的情况（如 ``</thi`` + ``nk>``）。
    ``pending`` 保存上次 chunk 末尾可能是不完整标签的部分，下次调用时拼接继续解析。
    """
    text = pending + text
    result: list[str] = []
    i = 0
    while i < len(text):
        if inside:
            end = text.find("</think>", i)
            if end == -1:
                # 检查末尾是否有 </think> 的不完整前缀
                for k in range(min(len("</think>") - 1, len(text) - i), 0, -1):
                    if "</think>"[:k] == text[-k:]:
                        return "".join(result), True, text[-k:]
                break  # 整个 chunk 都在 think block 内，全部丢弃
            i = end + len("</think>")
            inside = False
        else:
            start = text.find("<think>", i)
            if start == -1:
                # 检查末尾是否有 <think> 的不完整前缀
                for k in range(min(len("<think>") - 1, len(text) - i), 0, -1):
                    if "<think>"[:k] == text[-k:]:
                        result.append(text[i:-k])
                        return "".join(result), False, text[-k:]
                result.append(text[i:])
                break
            result.append(text[i:start])
            i = start + len("<think>")
            inside = True
    return "".join(result), inside, ""


def _sanitize_llm_text(text: str) -> str:
    """清洗 LLM 输出中的协议噪音，输出侧和持久化侧共用。"""
    text = _THINK_BLOCK_RE.sub("", text)
    text = _STRAY_TAG_RE.sub("", text)
    text = _CONTROL_TOKEN_RE.sub("", text)
    text = _LLM_TAG_RE.sub("", text).strip()
    return text


class VoicePipeline:
    def __init__(self, ctx, screen_sense=None):
        # 无状态引擎：共享
        self.asr = ctx.asr
        self.tts = ctx.tts
        self.llm = ctx.llm
        self.assembler = ctx.assembler
        self.memory = ctx.memory
        self.character = ctx.character
        self.screen_sense = screen_sense  # 每连接独立，由 ws_handler 传入
        self._screen_detail = getattr(ctx.config.screen, "detail", "low") if ctx.config.screen else "low"
        # 有状态组件：每连接独立
        from greywind.context_runtime.session_manager import SessionManager
        from greywind.context_runtime.thread_resolver import ThreadResolver
        self.session = SessionManager()
        self.thread = ThreadResolver()
        self.vad = self._clone_vad(ctx.vad)
        self._interrupted = False
        self._responding = False
        self._response_task: asyncio.Task | None = None

    @staticmethod
    def _clone_vad(vad):
        """为当前连接创建独立的 VAD 实例，避免状态串台"""
        if vad is None:
            return None
        try:
            from greywind.engines.vad.silero import VADEngine
            return VADEngine()
        except Exception:
            return None

    async def feed_audio(self, audio_floats, send_fn, send_audio_fn):
        """音频 -> VAD -> ASR -> 响应"""
        if not self.vad or not self.asr:
            return
        for result in self.vad.detect_speech(audio_floats):
            if result == b"<|PAUSE|>":
                await self.interrupt()
                await send_fn({"type": "status", "payload": {"state": "listening"}})
                continue
            if result == b"<|RESUME|>":
                continue
            audio_np = (
                np.frombuffer(result, dtype=np.int16).astype(np.float32) / 32768.0
            )
            text = await self.asr.async_transcribe_np(audio_np)
            if text and text.strip():
                await send_fn(
                    {"type": "transcript", "payload": {"text": text, "is_final": True}}
                )
                self._start_response(text, send_fn, send_audio_fn)

    async def handle_text(self, text: str, send_fn, send_audio_fn):
        """文字 -> 响应"""
        await self.interrupt()
        self._start_response(text, send_fn, send_audio_fn)

    def _start_response(self, text, send_fn, send_audio_fn):
        if self._response_task and not self._response_task.done():
            self._response_task.cancel()
        self._response_task = asyncio.create_task(
            self._respond(text, send_fn, send_audio_fn)
        )

    async def interrupt(self):
        self._interrupted = True
        if self._response_task and not self._response_task.done():
            self._response_task.cancel()
            try:
                await self._response_task
            except asyncio.CancelledError:
                pass
        self._interrupted = False

    async def _respond(self, user_text, send_fn, send_audio_fn):
        self._interrupted = False
        self._responding = True
        try:
            await send_fn({"type": "status", "payload": {"state": "thinking"}})
            # 被动模式：用户说话时附上最近截图
            screen_b64 = None
            if self.screen_sense:
                screen_b64 = self.screen_sense.get_latest_frame()
            messages = self.assembler.assemble(
                character=self.character,
                memory_prompt=self.memory.get_system_prompt(),
                thread_id=self.thread.resolve(),
                session_id=self.session.session_id,
                recent_dialogue=self.session.get_recent_dialogue(),
                user_input=user_text,
                screen_image_b64=screen_b64,
                screen_detail=self._screen_detail,
            )
            self.session.add_turn("user", user_text)

            # 分离 system prompt（Claude API 需要单独传递）
            system_prompt = None
            chat_messages = []
            for m in messages:
                if m["role"] == "system":
                    system_prompt = m["content"]
                else:
                    chat_messages.append(m)

            clean_response = ""  # 过滤后的文本，用于写入对话历史
            sentence_buffer = ""
            in_think_block = False  # 流式 think block 过滤状态
            think_pending = ""  # 跨 chunk 不完整标签缓冲
            await send_fn({"type": "status", "payload": {"state": "speaking"}})

            async for chunk in self.llm.chat_completion(
                chat_messages, system=system_prompt
            ):
                if self._interrupted:
                    break
                # 兼容 OpenAI (str) 和 Claude (dict with text_delta)
                if isinstance(chunk, str):
                    text = chunk
                elif isinstance(chunk, dict) and chunk.get("type") == "text_delta":
                    text = chunk.get("text", "")
                else:
                    continue
                if not text:
                    continue
                # 流式过滤 think block：在句子拆分前剥离，防止跨片段泄漏
                filtered_text, in_think_block, think_pending = _strip_think_streaming(
                    text, in_think_block, think_pending
                )
                if not filtered_text:
                    continue
                clean_response += filtered_text
                sentence_buffer += filtered_text
                sentences = SENTENCE_DELIMITERS.split(sentence_buffer)
                if len(sentences) > 1:
                    for s in sentences[:-1]:
                        if s.strip():
                            await self._speak(s.strip(), send_fn, send_audio_fn)
                    sentence_buffer = sentences[-1]

            # 流结束：flush pending 中可能残留的非标签文本
            if think_pending and not in_think_block:
                sentence_buffer += think_pending
                clean_response += think_pending
            if sentence_buffer.strip() and not self._interrupted:
                await self._speak(sentence_buffer.strip(), send_fn, send_audio_fn)
            if clean_response and not self._interrupted:
                self.session.add_turn("assistant", _sanitize_llm_text(clean_response))
        except asyncio.CancelledError:
            logger.info("响应被打断")
        except Exception as e:
            logger.error(f"响应出错: {e}")
            await send_fn({"type": "error", "payload": {"message": str(e)}})
        finally:
            self._responding = False
            if not self._interrupted:
                await send_fn({"type": "status", "payload": {"state": "idle"}})

    async def _speak(self, text, send_fn, send_audio_fn):
        text = _sanitize_llm_text(text)
        if not text:
            return
        await send_fn(
            {"type": "reply_text", "payload": {"text": text, "emotion": "neutral"}}
        )
        audio_path = None
        try:
            audio_path = await self.tts.async_generate_audio(text)
            if audio_path and not self._interrupted:
                audio_bytes = self._read_audio_bytes(audio_path)
                duration_ms = self._estimate_duration(audio_path)
                fmt = Path(audio_path).suffix.lstrip(".")  # mp3, wav, etc.
                await send_audio_fn(
                    audio_bytes,
                    {
                        "format": fmt,
                        "duration_ms": duration_ms,
                    },
                )
        except Exception as e:
            logger.error(f"TTS 出错: {e}")
        finally:
            if audio_path:
                self.tts.remove_file(audio_path)

    @staticmethod
    def _read_audio_bytes(path: str) -> bytes:
        with open(path, "rb") as f:
            return f.read()

    @staticmethod
    def _estimate_duration(path: str) -> int:
        """粗估音频时长（ms）。按文件大小 / 16 估算，不同格式/码率下不准确，仅用于前端占位。"""
        try:
            return max(int(Path(path).stat().st_size / 16), 500)
        except Exception:
            return 1000

    # ── 主动说话循环 ──

    _PROACTIVE_SYSTEM_HINT = (
        "你正在观看用户的屏幕。根据画面内容自然地反应——"
        "如果画面有趣就评论，如果用户在工作就给建议，"
        "如果没什么值得说的就回复空字符串。"
        "保持简短自然，像朋友在旁边看一样。"
    )

    async def proactive_loop(self, send_fn, send_audio_fn):
        """主动说话异步循环，由 ws_handler 启动"""
        logger.info("主动说话循环已启动")
        try:
            while True:
                await asyncio.sleep(3.0)
                if not self.screen_sense or not self.screen_sense.enabled:
                    continue
                if self._responding:
                    continue
                if not self.screen_sense.should_trigger():
                    continue

                frames = self.screen_sense.get_recent_frames(5)
                if not frames:
                    continue

                try:
                    text = await self._proactive_judge(frames)
                    if text and text.strip():
                        self.screen_sense.mark_spoken()
                        self._responding = True
                        self._interrupted = False
                        try:
                            await send_fn({
                                "type": "proactive_speak",
                                "payload": {"text": text.strip(), "emotion": "neutral"},
                            })
                            if not self._interrupted:
                                await self._speak(text.strip(), send_fn, send_audio_fn)
                            if not self._interrupted:
                                self.session.add_turn("assistant", text.strip())
                        finally:
                            self._responding = False
                    else:
                        # LLM 判断无需说话，重置计数器避免重复触发
                        self.screen_sense._frames_since_trigger = 0
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    self._responding = False
                    logger.error(f"主动说话出错: {e}")
        except asyncio.CancelledError:
            logger.info("主动说话循环已停止")

    async def _proactive_judge(self, frames: list[str]) -> str:
        """把截图发给 LLM，让它决定说不说"""
        content = []
        for b64 in frames:
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{b64}",
                    "detail": self._screen_detail,
                },
            })
        content.append({
            "type": "text",
            "text": self._PROACTIVE_SYSTEM_HINT,
        })

        system_parts = []
        if self.character.persona:
            system_parts.append(self.character.persona.strip())
        system_prompt = "\n\n".join(system_parts) if system_parts else None

        messages = [{"role": "user", "content": content}]

        full = ""
        async for chunk in self.llm.chat_completion(messages, system=system_prompt):
            if isinstance(chunk, str):
                full += chunk
            elif isinstance(chunk, dict) and chunk.get("type") == "text_delta":
                full += chunk.get("text", "")
        return full.strip()
