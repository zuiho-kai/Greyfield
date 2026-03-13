"""JSON 文件记忆存储 — Spine 阶段实现"""

import json
from pathlib import Path
from typing import List, Dict, Any

from loguru import logger
from .interface import MemoryInterface


class JSONMemoryStore(MemoryInterface):
    def __init__(self, path: str = "data/memory.json"):
        self._path = Path(path)
        self._data: Dict[str, Any] = {
            "persona_facts": [],
            "user_facts": [],
            "preferences": [],
        }

    def load(self) -> None:
        if not self._path.exists():
            logger.warning(f"记忆文件 {self._path} 不存在，使用空记忆")
            return
        with open(self._path, "r", encoding="utf-8") as f:
            self._data = json.load(f)
        logger.info(f"记忆加载完成: {len(self._data.get('persona_facts', []))} 条人格事实")

    def save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)
        logger.info(f"记忆已保存: {self._path}")

    def get_system_prompt(self) -> str:
        parts = []
        persona_facts = self._data.get("persona_facts", [])
        if persona_facts:
            parts.append("关于我：\n" + "\n".join(f"- {f}" for f in persona_facts))
        user_facts = self._data.get("user_facts", [])
        if user_facts:
            parts.append("关于用户：\n" + "\n".join(f"- {f}" for f in user_facts))
        preferences = self._data.get("preferences", [])
        if preferences:
            parts.append("用户偏好：\n" + "\n".join(f"- {p}" for p in preferences))
        return "\n\n".join(parts)

    def get_entries(self) -> List[Dict[str, Any]]:
        entries = []
        for key in ("persona_facts", "user_facts", "preferences"):
            for item in self._data.get(key, []):
                entries.append({"type": key, "content": item})
        return entries

    def add_entry(self, entry: Dict[str, Any]) -> None:
        entry_type = entry.get("type", "user_facts")
        content = entry.get("content", "")
        if entry_type in self._data and content:
            self._data[entry_type].append(content)
