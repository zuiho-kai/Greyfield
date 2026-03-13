# Original source: Open-LLM-VTuber (https://github.com/Open-LLM-VTuber/Open-LLM-VTuber)
# Copyright (c) 2025 Yi-Ting Chiu, MIT License
# Modified for GreyWind project
"""工具调用类型定义 — 内联自 Open-LLM-VTuber mcpp/types.py (MIT)"""

from dataclasses import dataclass, field
from typing import Optional, Any


@dataclass
class ToolCallFunctionObject:
    name: str = ""
    arguments: str = ""


@dataclass
class ToolCallObject:
    id: Optional[str] = None
    type: str = "function"
    index: int = 0
    function: ToolCallFunctionObject = field(default_factory=ToolCallFunctionObject)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ToolCallObject":
        function = ToolCallFunctionObject(
            name=data["function"]["name"],
            arguments=data["function"]["arguments"],
        )
        return cls(
            id=data["id"],
            type=data["type"],
            index=data["index"],
            function=function,
        )
