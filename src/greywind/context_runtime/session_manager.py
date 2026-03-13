"""会话管理器 — session_id + 最近对话保持"""

import uuid
import time
from typing import List, Dict, Any

from loguru import logger


class SessionManager:
    def __init__(self, max_recent: int = 10):
        self._session_id = str(uuid.uuid4())
        self._max_recent = max_recent
        self._recent_dialogue: List[Dict[str, Any]] = []
        self._state = "idle"
        self._created_at = time.time()
        logger.info(f"会话创建: {self._session_id}")

    @property
    def session_id(self) -> str:
        return self._session_id

    @property
    def state(self) -> str:
        return self._state

    @state.setter
    def state(self, value: str):
        self._state = value

    def add_turn(self, role: str, content: str) -> None:
        """添加一轮对话"""
        self._recent_dialogue.append({
            "role": role,
            "content": content,
            "timestamp": time.time(),
        })
        if len(self._recent_dialogue) > self._max_recent * 2:
            self._recent_dialogue = self._recent_dialogue[-self._max_recent * 2:]

    def get_recent_dialogue(self) -> List[Dict[str, Any]]:
        """返回最近对话（最多 max_recent 轮，即 max_recent*2 条消息）"""
        return self._recent_dialogue[-self._max_recent * 2:]

    def clear(self) -> None:
        """清空对话历史"""
        self._recent_dialogue.clear()
        logger.info("对话历史已清空")
