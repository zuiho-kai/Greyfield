"""公告推送器 — 持有当前 WebSocket 连接的发送回调，支持主动推送公告给前端"""

from typing import Awaitable, Callable, Optional

from loguru import logger


class Announcer:
    """单连接公告推送器。

    ws_handler 连接建立时调用 register()，断线时调用 unregister()。
    外部代码通过 push() 向前端推送 announcement 消息。
    """

    def __init__(self) -> None:
        self._send_fn: Optional[Callable[[dict], Awaitable[None]]] = None

    def register(self, send_fn: Callable[[dict], Awaitable[None]]) -> None:
        if self._send_fn is not None:
            logger.warning("Announcer: 新连接覆盖了旧连接的 send_fn（仅支持单连接）")
        self._send_fn = send_fn

    def unregister(self) -> None:
        self._send_fn = None

    async def push(self, text: str, duration_ms: int = 5000) -> None:
        """向前端推送一条公告。WebSocket 未连接时静默忽略。"""
        if not self._send_fn:
            logger.debug("Announcer: 无活跃连接，公告被丢弃")
            return
        try:
            await self._send_fn({
                "type": "announcement",
                "payload": {"text": text, "duration_ms": duration_ms},
            })
        except Exception as e:
            logger.warning(f"Announcer: 推送公告失败: {e}")
