"""豆包网页版 LLM — 通过 Playwright 操控浏览器白嫖"""
from __future__ import annotations

import asyncio
from typing import AsyncIterator, List, Dict, Any, Optional

from loguru import logger

from .stateless_llm_interface import StatelessLLMInterface


class DoubaoWebLLM(StatelessLLMInterface):
    """通过 Playwright 操控豆包网页版，实现 StatelessLLMInterface。

    首次使用需要用户在弹出的浏览器中登录豆包，登录态会持久化到本地。
    """

    # 豆包回复区域选择器（按优先级）
    _REPLY_SELECTORS = [
        '[class*="flow-markdown-body"]',
        '[class*="markdown-body"]',
        '[class*="markdown"]',
    ]

    def __init__(
        self,
        user_data_dir: Optional[str] = None,
        poll_interval: float = 0.5,
        max_wait: int = 120,
        screenshot_width: int = 1280,
    ):
        self._user_data_dir = user_data_dir
        self._poll_interval = poll_interval
        self._max_wait = max_wait
        self._screenshot_width = screenshot_width
        self._playwright = None
        self._context = None
        self._page = None
        self._ready = False
        self.support_tools = False  # 网页版不支持 function calling

    async def _ensure_browser(self):
        """确保浏览器已启动且在豆包页面"""
        if self._ready and self._page:
            try:
                await self._page.title()
                return
            except Exception:
                self._ready = False

        import os
        from playwright.async_api import async_playwright

        if not self._playwright:
            self._playwright = await async_playwright().start()

        data_dir = self._user_data_dir or os.path.join(
            os.path.expanduser("~"), ".greywind", "browser_data"
        )
        os.makedirs(data_dir, exist_ok=True)

        self._context = await self._playwright.chromium.launch_persistent_context(
            data_dir,
            headless=False,
            viewport={"width": self._screenshot_width, "height": 720},
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            ignore_default_args=["--enable-automation"],
        )

        self._page = await self._context.new_page()
        await self._page.goto("https://www.doubao.com/chat/", wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(3)

        # 检查是否需要登录
        url = self._page.url
        if "login" in url or "region-ban" in url or "security" in url:
            logger.warning("豆包需要登录，请在浏览器中登录...")
            for _ in range(300):
                await asyncio.sleep(1)
                url = self._page.url
                if "doubao.com/chat" in url and "login" not in url and "security" not in url:
                    logger.info("豆包登录成功")
                    break
            else:
                raise RuntimeError("豆包登录超时")

        self._ready = True
        logger.info("DoubaoWebLLM: 浏览器就绪")

    async def _new_chat(self):
        """点击新对话"""
        try:
            btn = await self._page.query_selector('text=新对话')
            if btn:
                await btn.click()
                await asyncio.sleep(1)
        except Exception:
            pass

    async def _send_message(self, text: str):
        """在输入框输入并发送"""
        await self._page.fill("textarea", text)
        await asyncio.sleep(0.3)
        await self._page.keyboard.press("Enter")

    async def _read_last_reply(self) -> str:
        """读取最后一条回复，尝试多个选择器"""
        for sel in self._REPLY_SELECTORS:
            els = await self._page.query_selector_all(sel)
            if els:
                text = await els[-1].inner_text()
                if text.strip():
                    return text.strip()
        return ""

    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        system: str = None,
        tools: List[Dict[str, Any]] = None,
    ) -> AsyncIterator[str]:
        """发送消息到豆包网页版，流式返回回复文本。

        网页版不支持 tools，tools 参数会被忽略。
        只取 messages 中最后一条 user 消息发送。
        """
        await self._ensure_browser()

        # 提取最后一条 user 消息
        user_text = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                content = msg.get("content", "")
                if isinstance(content, str):
                    user_text = content
                elif isinstance(content, list):
                    for part in content:
                        if isinstance(part, dict) and part.get("type") == "text":
                            user_text = part.get("text", "")
                            break
                break

        if not user_text:
            yield "（无用户消息）"
            return

        # system prompt 拼到消息前面（网页版没有 system 设置）
        full_text = user_text
        if system:
            full_text = f"[系统指令] {system}\n\n[用户] {full_text}"

        # 新对话 + 发送
        await self._new_chat()
        await self._send_message(full_text)
        logger.info(f"DoubaoWebLLM: 已发送 ({len(full_text)} 字)")

        # 流式轮询：读取回复，yield 新增部分
        # 用"文本不再增长"来判定生成完毕（连续 3 次无变化）
        prev_text = ""
        stable_count = 0
        await asyncio.sleep(2)
        elapsed = 0.0

        while elapsed < self._max_wait:
            await asyncio.sleep(self._poll_interval)
            elapsed += self._poll_interval

            current = await self._read_last_reply()
            if len(current) > len(prev_text):
                delta = current[len(prev_text):]
                prev_text = current
                stable_count = 0
                yield delta
            elif current and current == prev_text:
                stable_count += 1
                # 连续 3 次（1.5 秒）无变化，且已经有内容，判定完成
                if stable_count >= 3 and elapsed > 3:
                    break
            else:
                stable_count = 0

        # 最后再读一次，确保没遗漏
        final = await self._read_last_reply()
        if len(final) > len(prev_text):
            yield final[len(prev_text):]

        logger.info(f"DoubaoWebLLM: 回复完成 ({elapsed:.1f}s, {len(final)} 字)")

    async def close(self):
        """关闭浏览器（登录态已持久化）"""
        if self._page:
            try:
                await self._page.close()
            except Exception:
                pass
        if self._context:
            await self._context.close()
        if self._playwright:
            await self._playwright.stop()
        self._ready = False
        logger.info("DoubaoWebLLM: 已关闭（登录态已保存）")
