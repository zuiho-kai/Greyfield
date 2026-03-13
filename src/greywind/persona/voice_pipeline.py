"""Voice Pipeline — VAD->ASR->LLM->TTS 流式语音管线"""

import asyncio
import base64
import re
from pathlib import Path

import numpy as np
from loguru import logger

SENTENCE_DELIMITERS = re.compile(r"(?<=[。！？.!?\n])")


class VoicePipeline:
    def __init__(self, ctx):
        self.asr = ctx.asr
        self.tts = ctx.tts
        self.vad = ctx.vad
        self.llm = ctx.llm
        self.assembler = ctx.assembler
        self.session = ctx.session
        self.thread = ctx.thread
        self.memory = ctx.memory
        self.character = ctx.character
        self._interrupted = False
        self._response_task: asyncio.Task | None = None

    async def feed_audio(self, audio_floats, send_fn):
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
                self._start_response(text, send_fn)

    async def handle_text(self, text: str, send_fn):
        """文字 -> 响应"""
        await self.interrupt()
        self._start_response(text, send_fn)

    def _start_response(self, text, send_fn):
        if self._response_task and not self._response_task.done():
            self._response_task.cancel()
        self._response_task = asyncio.create_task(self._respond(text, send_fn))

    async def interrupt(self):
        self._interrupted = True
        if self._response_task and not self._response_task.done():
            self._response_task.cancel()
            try:
                await self._response_task
            except asyncio.CancelledError:
                pass
        self._interrupted = False

    async def _respond(self, user_text, send_fn):
        self._interrupted = False
        try:
            await send_fn({"type": "status", "payload": {"state": "thinking"}})
            messages = self.assembler.assemble(
                character=self.character,
                memory_prompt=self.memory.get_system_prompt(),
                thread_id=self.thread.resolve(),
                session_id=self.session.session_id,
                recent_dialogue=self.session.get_recent_dialogue(),
                user_input=user_text,
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

            full_response = ""
            sentence_buffer = ""
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
                full_response += text
                sentence_buffer += text
                sentences = SENTENCE_DELIMITERS.split(sentence_buffer)
                if len(sentences) > 1:
                    for s in sentences[:-1]:
                        if s.strip():
                            await self._speak(s.strip(), send_fn)
                    sentence_buffer = sentences[-1]

            if sentence_buffer.strip() and not self._interrupted:
                await self._speak(sentence_buffer.strip(), send_fn)
            if full_response and not self._interrupted:
                self.session.add_turn("assistant", full_response)
        except asyncio.CancelledError:
            logger.info("响应被打断")
        except Exception as e:
            logger.error(f"响应出错: {e}")
            await send_fn({"type": "error", "payload": {"message": str(e)}})
        finally:
            if not self._interrupted:
                await send_fn({"type": "status", "payload": {"state": "idle"}})

    async def _speak(self, text, send_fn):
        await send_fn(
            {"type": "reply_text", "payload": {"text": text, "emotion": "neutral"}}
        )
        audio_path = None
        try:
            audio_path = await self.tts.async_generate_audio(text)
            if audio_path and not self._interrupted:
                audio_b64 = self._audio_to_base64(audio_path)
                duration_ms = self._estimate_duration(audio_path)
                fmt = Path(audio_path).suffix.lstrip(".")  # mp3, wav, etc.
                await send_fn({
                    "type": "reply_audio",
                    "payload": {
                        "audio_base64": audio_b64,
                        "format": fmt,
                        "duration_ms": duration_ms,
                    },
                })
        except Exception as e:
            logger.error(f"TTS 出错: {e}")
        finally:
            if audio_path:
                self.tts.remove_file(audio_path)

    @staticmethod
    def _audio_to_base64(path: str) -> str:
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode("ascii")

    @staticmethod
    def _estimate_duration(path: str) -> int:
        """粗估音频时长（ms）。按文件大小 / 16 估算，不同格式/码率下不准确，仅用于前端占位。"""
        try:
            return max(int(Path(path).stat().st_size / 16), 500)
        except Exception:
            return 1000
