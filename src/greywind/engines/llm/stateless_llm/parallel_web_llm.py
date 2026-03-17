"""并行 LLM — 同时调用主 LLM（API）和网页版 LLM，合并结果"""
from __future__ import annotations

import asyncio
from typing import AsyncIterator, List, Dict, Any, Optional

from loguru import logger

from .stateless_llm_interface import StatelessLLMInterface


class ParallelWebLLM(StatelessLLMInterface):
    """并行调用主 LLM 和网页版 LLM（如豆包），合并结果。

    主 LLM 负责 tool calling 和正常对话。
    网页版 LLM 并行搜索，结果追加到主 LLM 回复后面。
    """

    def __init__(self, primary: StatelessLLMInterface, web_llm: StatelessLLMInterface):
        self._primary = primary
        self._web_llm = web_llm
        self.support_tools = getattr(primary, "support_tools", True)

    async def _collect_web_reply(self, messages, system) -> str:
        """收集网页版 LLM 的完整回复"""
        try:
            full = ""
            async for chunk in self._web_llm.chat_completion(messages, system=system):
                if isinstance(chunk, str):
                    full += chunk
            return full.strip()
        except Exception as e:
            logger.warning(f"网页版 LLM 出错: {e}")
            return ""

    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        system: str = None,
        tools: List[Dict[str, Any]] = None,
    ) -> AsyncIterator[str]:
        """并行调用主 LLM 和网页版 LLM。

        主 LLM 流式输出直接 yield。
        网页版 LLM 在后台并行跑，完成后追加结果。
        """
        # 启动网页版 LLM 后台任务
        web_task = asyncio.create_task(
            self._collect_web_reply(messages, system)
        )

        # 主 LLM 流式输出
        has_tool_calls = False
        async for chunk in self._primary.chat_completion(
            messages, system=system, tools=tools
        ):
            # 透传 tool calls
            if not isinstance(chunk, str):
                has_tool_calls = True
                yield chunk
                continue
            yield chunk

        # 等网页版 LLM 完成（如果还没完成的话）
        try:
            web_reply = await asyncio.wait_for(web_task, timeout=120)
        except asyncio.TimeoutError:
            logger.warning("网页版 LLM 超时 (120s)")
            web_reply = ""
        except Exception as e:
            logger.warning(f"网页版 LLM 出错: {e}")
            web_reply = ""

        # 追加网页版结果（如果有内容且主 LLM 没有 tool call）
        if web_reply and not has_tool_calls:
            yield f"\n\n【豆包搜索结果】\n{web_reply}"
