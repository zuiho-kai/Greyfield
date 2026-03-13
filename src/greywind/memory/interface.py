"""记忆系统接口 — 为未来 SQLite/向量检索预留"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any


class MemoryInterface(ABC):
    @abstractmethod
    def load(self) -> None:
        """加载记忆"""
        ...

    @abstractmethod
    def save(self) -> None:
        """持久化记忆"""
        ...

    @abstractmethod
    def get_system_prompt(self) -> str:
        """返回注入 LLM 的记忆文本"""
        ...

    @abstractmethod
    def get_entries(self) -> List[Dict[str, Any]]:
        """返回所有记忆条目"""
        ...

    @abstractmethod
    def add_entry(self, entry: Dict[str, Any]) -> None:
        """添加一条记忆"""
        ...
