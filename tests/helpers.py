"""测试共用工具类 — MockLLM / MockTTS / make_mock_ctx

可直接 import，不依赖 pytest conftest magic。
"""

from __future__ import annotations

import types
from pathlib import Path
from typing import AsyncIterator, List, Dict, Any

from greywind.config.models import (
    AppConfig, CharacterConfig,
    BrowserConfig, DesktopConfig, ScreenConfig,
)
from greywind.context_runtime.prompt_assembler import PromptAssembler
from greywind.context_runtime.session_manager import SessionManager
from greywind.context_runtime.thread_resolver import ThreadResolver
from greywind.engines.llm.stateless_llm.stateless_llm_interface import StatelessLLMInterface
from greywind.engines.tts.tts_interface import TTSInterface
from greywind.memory.store_json import JSONMemoryStore


class MockLLM(StatelessLLMInterface):
    """固定回复的 LLM mock，记录每次调用的 messages 供断言使用。

    注意：只 yield str，不模拟 tool call（list[ToolCallObject]）路径。
    需要测试工具调用时请另写专用 mock。
    """

    def __init__(self, response: str = "你好，我是灰风。"):
        self.response = response
        self.calls: list[list] = []

    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        system: str = None,
        tools: List[Dict[str, Any]] = None,
    ) -> AsyncIterator[str]:
        self.calls.append(messages)
        for char in self.response:
            yield char


class MockTTS(TTSInterface):
    """返回 None 的 TTS mock，跳过音频生成以简化 WebSocket 消息序列。"""

    def generate_audio(self, text: str, file_name_no_ext=None) -> str:
        return None  # VoicePipeline._speak 会跳过 None 的 audio_path

    async def async_generate_audio(self, text: str, file_name_no_ext=None) -> str:
        return None  # 跳过线程池，直接返回 None


def make_mock_ctx(
    llm_response: str = "你好，我是灰风。",
    llm: MockLLM | None = None,
) -> types.SimpleNamespace:
    """构造最小可用的 ServiceContext 替身，注入 MockLLM / MockTTS。"""
    _llm = llm or MockLLM(llm_response)
    config = AppConfig(
        browser=BrowserConfig(enabled=False),
        desktop=DesktopConfig(enabled=False),
        screen=ScreenConfig(enabled=False),
    )
    character = CharacterConfig(name="灰风", persona="你是灰风，一个桌面 AI 伴侣。")
    memory = JSONMemoryStore.__new__(JSONMemoryStore)
    memory._path = Path("/nonexistent/test_memory.json")
    memory._data = {"persona_facts": [], "user_facts": [], "preferences": []}

    return types.SimpleNamespace(
        config=config,
        character=character,
        llm=_llm,
        tts=MockTTS(),
        asr=None,
        vad=None,
        browser=None,
        desktop=None,
        assembler=PromptAssembler(),
        memory=memory,
        session=SessionManager(),
        thread=ThreadResolver(),
    )
