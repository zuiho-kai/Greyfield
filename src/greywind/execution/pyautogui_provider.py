"""桌面操控 — PyAutoGUI 实现"""
from __future__ import annotations

import asyncio
import base64
import io

import pyautogui
import pyperclip
from loguru import logger
from PIL import Image

from .base import ActionResult, DesktopProvider


class PyAutoGuiProvider(DesktopProvider):
    """基于 pyautogui 的桌面操控实现"""

    def __init__(
        self,
        screenshot_quality: int = 50,
        screenshot_width: int = 1280,
        action_delay: float = 1.0,
    ):
        self._screenshot_quality = screenshot_quality
        self._screenshot_width = screenshot_width
        self._action_delay = action_delay
        # 保留 failsafe（鼠标移到左上角可中止）
        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0.1

    # ── 截图相关 ──

    def _take_screenshot(self, region: tuple[int, int, int, int] | None = None) -> str:
        """截图并返回 base64，自动缩放到目标宽度"""
        img: Image.Image = pyautogui.screenshot(region=region)
        # 缩放到目标宽度，保持比例
        if img.width > self._screenshot_width:
            ratio = self._screenshot_width / img.width
            new_h = int(img.height * ratio)
            img = img.resize((self._screenshot_width, new_h), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=self._screenshot_quality)
        return base64.b64encode(buf.getvalue()).decode()

    async def _do_and_screenshot(self, action, *args, **kwargs) -> ActionResult:
        """执行操作 → 等待 UI 稳定 → 截图，统一错误处理"""
        try:
            result_text = await asyncio.to_thread(action, *args, **kwargs)
            await asyncio.sleep(self._action_delay)
            shot = await asyncio.to_thread(self._take_screenshot)
            return ActionResult(success=True, screenshot_b64=shot, text=str(result_text) if result_text else None)
        except Exception as e:
            logger.error(f"桌面操作失败: {e}")
            return ActionResult(success=False, error=str(e))

    # ── 接口实现 ──

    async def screenshot(self, region=None) -> ActionResult:
        try:
            shot = await asyncio.to_thread(self._take_screenshot, region)
            return ActionResult(success=True, screenshot_b64=shot)
        except Exception as e:
            return ActionResult(success=False, error=str(e))

    async def click(self, x: int, y: int) -> ActionResult:
        return await self._do_and_screenshot(pyautogui.click, x, y)

    async def double_click(self, x: int, y: int) -> ActionResult:
        return await self._do_and_screenshot(pyautogui.doubleClick, x, y)

    async def right_click(self, x: int, y: int) -> ActionResult:
        return await self._do_and_screenshot(pyautogui.rightClick, x, y)

    async def type_text(self, text: str) -> ActionResult:
        """中文用剪贴板粘贴，纯 ASCII 用 pyautogui.write"""
        def _do_type():
            if all(ord(c) < 128 for c in text):
                pyautogui.write(text, interval=0.02)
            else:
                pyperclip.copy(text)
                pyautogui.hotkey("ctrl", "v")
        return await self._do_and_screenshot(_do_type)

    async def hotkey(self, *keys: str) -> ActionResult:
        return await self._do_and_screenshot(pyautogui.hotkey, *keys)

    async def drag(self, x1: int, y1: int, x2: int, y2: int) -> ActionResult:
        def _do_drag():
            pyautogui.moveTo(x1, y1)
            pyautogui.drag(x2 - x1, y2 - y1, duration=0.5)
        return await self._do_and_screenshot(_do_drag)

    async def scroll(self, x: int, y: int, direction: str, amount: int = 3) -> ActionResult:
        clicks = amount if direction == "up" else -amount
        def _do_scroll():
            pyautogui.moveTo(x, y)
            pyautogui.scroll(clicks)
        return await self._do_and_screenshot(_do_scroll)

    async def move(self, x: int, y: int) -> ActionResult:
        return await self._do_and_screenshot(pyautogui.moveTo, x, y)

    async def find_window(self, title: str | None = None) -> ActionResult:
        try:
            def _do_find():
                import pygetwindow as gw
                if title:
                    windows = gw.getWindowsWithTitle(title)
                else:
                    windows = gw.getAllWindows()
                return [{"title": w.title, "visible": w.visible, "position": (w.left, w.top, w.width, w.height)}
                        for w in windows if w.title.strip()]
            info = await asyncio.to_thread(_do_find)
            return ActionResult(success=True, text=str(info))
        except Exception as e:
            return ActionResult(success=False, error=str(e))

    async def focus_window(self, title: str) -> ActionResult:
        try:
            def _do_focus():
                import pygetwindow as gw
                windows = gw.getWindowsWithTitle(title)
                if not windows:
                    return None
                win = windows[0]
                win.activate()
                return win.title
            win_title = await asyncio.to_thread(_do_focus)
            if win_title is None:
                return ActionResult(success=False, error=f"未找到窗口: {title}")
            await asyncio.sleep(0.3)
            shot = await asyncio.to_thread(self._take_screenshot)
            return ActionResult(success=True, screenshot_b64=shot, text=f"已激活窗口: {win_title}")
        except Exception as e:
            return ActionResult(success=False, error=str(e))
