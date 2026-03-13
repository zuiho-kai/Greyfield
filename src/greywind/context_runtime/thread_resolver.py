"""线程解析器 — 当前极简策略：默认单主线程"""

import uuid
from loguru import logger


class ThreadResolver:
    def __init__(self):
        self._default_thread_id = str(uuid.uuid4())
        logger.info(f"默认线程: {self._default_thread_id}")

    def resolve(self, context: dict = None) -> str:
        """返回当前对话的 thread_id，当前策略：始终返回默认线程"""
        return self._default_thread_id

    def create_thread(self) -> str:
        """手动创建新线程"""
        thread_id = str(uuid.uuid4())
        logger.info(f"新建线程: {thread_id}")
        return thread_id
