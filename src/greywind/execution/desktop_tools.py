"""桌面工具定义（JSON Schema）+ 工具分发"""
from __future__ import annotations

import json
from typing import Any, Dict

from loguru import logger

from .base import DesktopProvider


# ── 工具定义（OpenAI Function Calling 格式）──

DESKTOP_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "desktop_screenshot",
            "description": "截取桌面全屏截图，用于观察当前屏幕内容",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "desktop_click",
            "description": "单击桌面指定坐标",
            "parameters": {
                "type": "object",
                "properties": {
                    "x": {"type": "integer", "description": "横坐标"},
                    "y": {"type": "integer", "description": "纵坐标"},
                },
                "required": ["x", "y"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "desktop_double_click",
            "description": "双击桌面指定坐标",
            "parameters": {
                "type": "object",
                "properties": {
                    "x": {"type": "integer", "description": "横坐标"},
                    "y": {"type": "integer", "description": "纵坐标"},
                },
                "required": ["x", "y"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "desktop_right_click",
            "description": "右键点击桌面指定坐标",
            "parameters": {
                "type": "object",
                "properties": {
                    "x": {"type": "integer", "description": "横坐标"},
                    "y": {"type": "integer", "description": "纵坐标"},
                },
                "required": ["x", "y"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "desktop_type",
            "description": "在当前焦点位置输入文字（支持中文）",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "要输入的文字"},
                },
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "desktop_hotkey",
            "description": "按组合键，如 ctrl+c、alt+tab、win+d",
            "parameters": {
                "type": "object",
                "properties": {
                    "keys": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "按键列表，如 [\"ctrl\", \"c\"]",
                    },
                },
                "required": ["keys"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "desktop_drag",
            "description": "从坐标 A 拖拽到坐标 B",
            "parameters": {
                "type": "object",
                "properties": {
                    "x1": {"type": "integer", "description": "起点横坐标"},
                    "y1": {"type": "integer", "description": "起点纵坐标"},
                    "x2": {"type": "integer", "description": "终点横坐标"},
                    "y2": {"type": "integer", "description": "终点纵坐标"},
                },
                "required": ["x1", "y1", "x2", "y2"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "desktop_scroll",
            "description": "在指定位置滚动鼠标滚轮",
            "parameters": {
                "type": "object",
                "properties": {
                    "x": {"type": "integer", "description": "横坐标"},
                    "y": {"type": "integer", "description": "纵坐标"},
                    "direction": {"type": "string", "enum": ["up", "down"], "description": "滚动方向"},
                    "amount": {"type": "integer", "description": "滚动格数（默认 3）"},
                },
                "required": ["x", "y", "direction"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "desktop_move",
            "description": "移动鼠标到指定位置",
            "parameters": {
                "type": "object",
                "properties": {
                    "x": {"type": "integer", "description": "横坐标"},
                    "y": {"type": "integer", "description": "纵坐标"},
                },
                "required": ["x", "y"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "desktop_find_window",
            "description": "查找/列出窗口。不传 title 则列出所有可见窗口",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "窗口标题关键词（可选）"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "desktop_focus_window",
            "description": "激活指定窗口到前台",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "窗口标题关键词"},
                },
                "required": ["title"],
            },
        },
    },
]


def is_desktop_tool(name: str) -> bool:
    """判断是否是桌面工具"""
    return name.startswith("desktop_")


async def dispatch_desktop_tool(
    provider: DesktopProvider, tool_name: str, arguments: str
) -> dict[str, Any]:
    """分发桌面工具调用，返回结果 dict"""
    try:
        args = json.loads(arguments) if arguments else {}
    except json.JSONDecodeError:
        return {"success": False, "error": f"参数解析失败: {arguments}"}

    logger.info(f"桌面工具调用: {tool_name}({args})")

    result: ActionResult | None = None
    if tool_name == "desktop_screenshot":
        result = await provider.screenshot()
    elif tool_name == "desktop_click":
        result = await provider.click(args["x"], args["y"])
    elif tool_name == "desktop_double_click":
        result = await provider.double_click(args["x"], args["y"])
    elif tool_name == "desktop_right_click":
        result = await provider.right_click(args["x"], args["y"])
    elif tool_name == "desktop_type":
        result = await provider.type_text(args["text"])
    elif tool_name == "desktop_hotkey":
        result = await provider.hotkey(*args["keys"])
    elif tool_name == "desktop_drag":
        result = await provider.drag(args["x1"], args["y1"], args["x2"], args["y2"])
    elif tool_name == "desktop_scroll":
        result = await provider.scroll(args["x"], args["y"], args["direction"], args.get("amount", 3))
    elif tool_name == "desktop_move":
        result = await provider.move(args["x"], args["y"])
    elif tool_name == "desktop_find_window":
        result = await provider.find_window(args.get("title"))
    elif tool_name == "desktop_focus_window":
        result = await provider.focus_window(args["title"])
    else:
        return {"success": False, "error": f"未知工具: {tool_name}"}

    out: Dict[str, Any] = {"success": result.success}
    if result.error:
        out["error"] = result.error
    if result.text:
        out["text"] = result.text
    if result.screenshot_b64:
        out["has_screenshot"] = True
        out["screenshot_b64"] = result.screenshot_b64

    logger.info(f"桌面工具结果: {tool_name} -> success={result.success}")
    return out
