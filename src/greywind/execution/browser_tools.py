"""浏览器工具定义（JSON Schema）+ 工具分发"""
from __future__ import annotations

import json
from typing import Any, Dict

from loguru import logger

from .base import BrowserProvider, ActionResult


# ── 工具定义（OpenAI Function Calling 格式）──

BROWSER_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "browser_goto",
            "description": "导航到指定 URL",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "目标 URL"},
                    "tab_id": {"type": "string", "description": "标签页 ID（可选，不传则用当前标签页）"},
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "browser_click",
            "description": "点击页面元素。selector 支持 CSS 选择器或 text= 文本匹配",
            "parameters": {
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "CSS 选择器或 text=xxx 文本匹配"},
                    "tab_id": {"type": "string", "description": "标签页 ID（可选）"},
                },
                "required": ["selector"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "browser_type",
            "description": "在输入框中输入文本",
            "parameters": {
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "输入框的 CSS 选择器"},
                    "text": {"type": "string", "description": "要输入的文本"},
                    "tab_id": {"type": "string", "description": "标签页 ID（可选）"},
                },
                "required": ["selector", "text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "browser_screenshot",
            "description": "截取当前页面截图",
            "parameters": {
                "type": "object",
                "properties": {
                    "tab_id": {"type": "string", "description": "标签页 ID（可选）"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "browser_read_text",
            "description": "读取页面文本内容",
            "parameters": {
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "CSS 选择器（可选，不传则读取整个页面）"},
                    "tab_id": {"type": "string", "description": "标签页 ID（可选）"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "browser_scroll",
            "description": "滚动页面",
            "parameters": {
                "type": "object",
                "properties": {
                    "direction": {"type": "string", "enum": ["up", "down"], "description": "滚动方向"},
                    "amount": {"type": "integer", "description": "滚动像素数（默认 500）"},
                    "tab_id": {"type": "string", "description": "标签页 ID（可选）"},
                },
                "required": ["direction"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "browser_wait",
            "description": "等待元素出现或等待指定时间",
            "parameters": {
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "等待的元素选择器"},
                    "timeout": {"type": "integer", "description": "等待秒数（默认 2）"},
                    "tab_id": {"type": "string", "description": "标签页 ID（可选）"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "browser_back",
            "description": "浏览器后退",
            "parameters": {
                "type": "object",
                "properties": {
                    "tab_id": {"type": "string", "description": "标签页 ID（可选）"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "browser_new_tab",
            "description": "新开一个标签页。可以命名，命名标签页不会自动关闭",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "标签页名称（可选，命名后不自动关闭）"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "browser_switch_tab",
            "description": "切换到指定标签页",
            "parameters": {
                "type": "object",
                "properties": {
                    "tab_id": {"type": "string", "description": "目标标签页 ID"},
                },
                "required": ["tab_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "browser_close_tab",
            "description": "关闭指定标签页",
            "parameters": {
                "type": "object",
                "properties": {
                    "tab_id": {"type": "string", "description": "要关闭的标签页 ID"},
                },
                "required": ["tab_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "browser_list_tabs",
            "description": "列出所有打开的标签页",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


def is_browser_tool(name: str) -> bool:
    """判断是否是浏览器工具"""
    return name.startswith("browser_")


async def dispatch_browser_tool(
    provider: BrowserProvider, tool_name: str, arguments: str
) -> dict[str, Any]:
    """分发浏览器工具调用，返回结果 dict（可直接序列化为 tool result）"""
    try:
        args = json.loads(arguments) if arguments else {}
    except json.JSONDecodeError:
        return {"success": False, "error": f"参数解析失败: {arguments}"}

    logger.info(f"浏览器工具调用: {tool_name}({args})")

    result = None
    if tool_name == "browser_goto":
        result = await provider.goto(args["url"], args.get("tab_id"))
    elif tool_name == "browser_click":
        result = await provider.click(args["selector"], args.get("tab_id"))
    elif tool_name == "browser_type":
        result = await provider.type_text(args["selector"], args["text"], args.get("tab_id"))
    elif tool_name == "browser_screenshot":
        result = await provider.screenshot(args.get("tab_id"))
    elif tool_name == "browser_read_text":
        result = await provider.read_text(args.get("selector"), args.get("tab_id"))
    elif tool_name == "browser_scroll":
        result = await provider.scroll(args["direction"], args.get("amount"), args.get("tab_id"))
    elif tool_name == "browser_wait":
        result = await provider.wait(args.get("selector"), args.get("timeout"), args.get("tab_id"))
    elif tool_name == "browser_back":
        result = await provider.back(args.get("tab_id"))
    elif tool_name == "browser_new_tab":
        result = await provider.new_tab(args.get("name"))
    elif tool_name == "browser_switch_tab":
        result = await provider.switch_tab(args["tab_id"])
    elif tool_name == "browser_close_tab":
        result = await provider.close_tab(args["tab_id"])
    elif tool_name == "browser_list_tabs":
        tabs = await provider.list_tabs()
        return {
            "success": True,
            "tabs": [{"tab_id": t.tab_id, "title": t.title, "url": t.url, "name": t.name} for t in tabs],
        }
    else:
        return {"success": False, "error": f"未知工具: {tool_name}"}

    # 构造返回 dict
    out: Dict[str, Any] = {"success": result.success}
    if result.error:
        out["error"] = result.error
    if result.title:
        out["title"] = result.title
    if result.url:
        out["url"] = result.url
    if result.text:
        out["text"] = result.text
    if result.tab_id:
        out["tab_id"] = result.tab_id
    # screenshot_b64 单独处理，不放在文本结果里（由调用方决定怎么注入 messages）
    if result.screenshot_b64:
        out["has_screenshot"] = True
        out["screenshot_b64"] = result.screenshot_b64

    logger.info(f"浏览器工具结果: {tool_name} -> success={result.success}")
    return out
