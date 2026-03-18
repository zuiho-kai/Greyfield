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
        self._scale_ratio: float = 1.0  # 截图缩放比例，用于坐标反算
        # 保留 failsafe（鼠标移到左上角可中止）
        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0.1

    # ── 截图相关 ──

    def _take_screenshot(self, region: tuple[int, int, int, int] | None = None) -> str:
        """截图并返回 base64，自动缩放到目标宽度"""
        img: Image.Image = pyautogui.screenshot(region=region)
        # 缩放到目标宽度，保持比例，并记录缩放比例供坐标反算
        if img.width > self._screenshot_width:
            self._scale_ratio = img.width / self._screenshot_width
            new_h = int(img.height / self._scale_ratio)
            img = img.resize((self._screenshot_width, new_h), Image.LANCZOS)
        else:
            self._scale_ratio = 1.0
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=self._screenshot_quality)
        return base64.b64encode(buf.getvalue()).decode()

    def _to_native(self, x: int, y: int) -> tuple[int, int]:
        """将模型坐标（缩放后）反算为原生屏幕坐标"""
        return int(x * self._scale_ratio), int(y * self._scale_ratio)

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
        nx, ny = self._to_native(x, y)
        return await self._do_and_screenshot(pyautogui.click, nx, ny)

    async def double_click(self, x: int, y: int) -> ActionResult:
        nx, ny = self._to_native(x, y)
        return await self._do_and_screenshot(pyautogui.doubleClick, nx, ny)

    async def right_click(self, x: int, y: int) -> ActionResult:
        nx, ny = self._to_native(x, y)
        return await self._do_and_screenshot(pyautogui.rightClick, nx, ny)

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
        nx1, ny1 = self._to_native(x1, y1)
        nx2, ny2 = self._to_native(x2, y2)
        def _do_drag():
            pyautogui.moveTo(nx1, ny1)
            pyautogui.drag(nx2 - nx1, ny2 - ny1, duration=0.5)
        return await self._do_and_screenshot(_do_drag)

    async def scroll(self, x: int, y: int, direction: str, amount: int = 3) -> ActionResult:
        nx, ny = self._to_native(x, y)
        clicks = amount if direction == "up" else -amount
        def _do_scroll():
            pyautogui.moveTo(nx, ny)
            pyautogui.scroll(clicks)
        return await self._do_and_screenshot(_do_scroll)

    async def move(self, x: int, y: int) -> ActionResult:
        nx, ny = self._to_native(x, y)
        return await self._do_and_screenshot(pyautogui.moveTo, nx, ny)

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
