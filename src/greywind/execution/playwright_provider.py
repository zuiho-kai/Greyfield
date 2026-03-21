"""Playwright Provider — 独立浏览器实例，零配置"""
from __future__ import annotations

import asyncio
import base64
import subprocess
import uuid
from typing import Optional, List, Any

from loguru import logger

from .base import BrowserProvider, ActionResult, TabInfo


async def _ensure_chromium_installed():
    """检查并自动安装 Chromium 浏览器二进制"""
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            p.chromium.launch()
        return True
    except Exception:
        logger.info("PlaywrightProvider: 正在安装 Chromium...")
        try:
            subprocess.run(
                ["python", "-m", "playwright", "install", "chromium"],
                capture_output=True,
                check=True,
            )
            logger.info("PlaywrightProvider: Chromium 安装完成")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"PlaywrightProvider: Chromium 安装失败 — {e}")
            return False


class PlaywrightProvider(BrowserProvider):
    def __init__(self, screenshot_quality: int = 50, screenshot_width: int = 1280,
                 idle_timeout: int = 60, max_tabs: int = 10,
                 user_data_dir: Optional[str] = None):
        self._playwright = None
        self._browser = None
        self._context = None
        self._tabs: dict = {}  # tab_id -> Page
        self._tab_names: dict = {}  # tab_id -> name (命名标签页)
        self._active_tab: Optional[str] = None
        self._screenshot_quality = screenshot_quality
        self._screenshot_width = screenshot_width
        self._idle_timeout = idle_timeout
        self._max_tabs = max_tabs
        self._user_data_dir = user_data_dir
        self._idle_timer: asyncio.Task | None = None
        self._connected = False

    async def connect(self) -> bool:
        try:
            from playwright.async_api import async_playwright
            import os

            # 首次启动：自动检查并安装 Chromium
            if not await _ensure_chromium_installed():
                logger.error("PlaywrightProvider: Chromium 不可用")
                return False

            self._playwright = await async_playwright().start()

            # 持久化 user data dir：保留登录态，下次启动不用重新登录
            data_dir = self._user_data_dir or os.path.join(
                os.path.expanduser("~"), ".greywind", "browser_data"
            )
            os.makedirs(data_dir, exist_ok=True)

            # launch_persistent_context = 浏览器 + context 合一，cookies 自动持久化
            self._context = await self._playwright.chromium.launch_persistent_context(
                data_dir,
                headless=False,
                viewport={"width": self._screenshot_width, "height": 720},
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                ],
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                ignore_default_args=["--enable-automation"],
            )
            # persistent context 没有单独的 browser 对象
            self._browser = None
            self._connected = True
            logger.info(f"PlaywrightProvider: 浏览器已启动（数据目录: {data_dir}）")
            return True
        except Exception as e:
            logger.error(f"PlaywrightProvider: 启动失败 — {e}")
            self._connected = False
            return False

    async def disconnect(self):
        for page in self._tabs.values():
            try:
                await page.close()
            except Exception:
                pass
        self._tabs.clear()
        self._tab_names.clear()
        self._active_tab = None
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        self._connected = False
        logger.info("PlaywrightProvider: 已断开（登录态已保存）")

    @property
    def is_connected(self) -> bool:
        return self._connected

    async def _ensure_connected(self):
        if not self._connected:
            await self.connect()

    def _get_page(self, tab_id: str | None = None):
        tid = tab_id or self._active_tab
        if tid and tid in self._tabs:
            return self._tabs[tid]
        return None

    async def _take_screenshot(self, page) -> str | None:
        try:
            raw = await page.screenshot(type="jpeg", quality=self._screenshot_quality)
            return base64.b64encode(raw).decode()
        except Exception as e:
            logger.warning(f"截图失败: {e}")
            return None

    def _reset_idle_timer(self, tab_id: str):
        """重置无名标签页的空闲计时器"""
        if tab_id in self._tab_names:
            return  # 命名标签页不自动关闭

    # ── 动作实现 ──

    async def goto(self, url: str, tab_id: str | None = None) -> ActionResult:
        await self._ensure_connected()
        if not self._tabs:
            await self.new_tab()
        page = self._get_page(tab_id)
        if not page:
            return ActionResult(success=False, error="无可用标签页")
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            shot = await self._take_screenshot(page)
            return ActionResult(
                success=True, screenshot_b64=shot,
                title=await page.title(), url=page.url,
            )
        except Exception as e:
            return ActionResult(success=False, error=str(e))

    async def click(self, selector: str, tab_id: str | None = None) -> ActionResult:
        page = self._get_page(tab_id)
        if not page:
            return ActionResult(success=False, error="无可用标签页")
        try:
            await page.click(selector, timeout=5000)
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
            shot = await self._take_screenshot(page)
            return ActionResult(success=True, screenshot_b64=shot)
        except Exception as e:
            return ActionResult(success=False, error=str(e))

    async def type_text(self, selector: str, text: str, tab_id: str | None = None) -> ActionResult:
        page = self._get_page(tab_id)
        if not page:
            return ActionResult(success=False, error="无可用标签页")
        try:
            await page.fill(selector, text, timeout=5000)
            shot = await self._take_screenshot(page)
            return ActionResult(success=True, screenshot_b64=shot)
        except Exception as e:
            return ActionResult(success=False, error=str(e))

    async def screenshot(self, tab_id: str | None = None) -> ActionResult:
        page = self._get_page(tab_id)
        if not page:
            return ActionResult(success=False, error="无可用标签页")
        shot = await self._take_screenshot(page)
        return ActionResult(success=True, screenshot_b64=shot,
                            title=await page.title(), url=page.url)

    async def read_text(self, selector: str | None = None, tab_id: str | None = None) -> ActionResult:
        page = self._get_page(tab_id)
        if not page:
            return ActionResult(success=False, error="无可用标签页")
        try:
            if selector:
                el = await page.query_selector(selector)
                text = await el.inner_text() if el else ""
            else:
                text = await page.inner_text("body")
            # 截断过长文本
            if len(text) > 4000:
                text = text[:4000] + "\n...(截断)"
            return ActionResult(success=True, text=text)
        except Exception as e:
            return ActionResult(success=False, error=str(e))

    async def scroll(self, direction: str, amount: int | None = None, tab_id: str | None = None) -> ActionResult:
        page = self._get_page(tab_id)
        if not page:
            return ActionResult(success=False, error="无可用标签页")
        pixels = amount or 500
        dy = pixels if direction == "down" else -pixels
        try:
            await page.mouse.wheel(0, dy)
            await asyncio.sleep(0.3)
            shot = await self._take_screenshot(page)
            return ActionResult(success=True, screenshot_b64=shot)
        except Exception as e:
            return ActionResult(success=False, error=str(e))

    async def back(self, tab_id: str | None = None) -> ActionResult:
        page = self._get_page(tab_id)
        if not page:
            return ActionResult(success=False, error="无可用标签页")
        try:
            await page.go_back(wait_until="domcontentloaded", timeout=10000)
            shot = await self._take_screenshot(page)
            return ActionResult(
                success=True, screenshot_b64=shot,
                title=await page.title(), url=page.url,
            )
        except Exception as e:
            return ActionResult(success=False, error=str(e))

    async def wait(self, selector: str | None = None, timeout: int | None = None, tab_id: str | None = None) -> ActionResult:
        page = self._get_page(tab_id)
        if not page:
            return ActionResult(success=False, error="无可用标签页")
        try:
            if selector:
                await page.wait_for_selector(selector, timeout=(timeout or 10) * 1000)
            else:
                await asyncio.sleep(timeout or 2)
            return ActionResult(success=True)
        except Exception as e:
            return ActionResult(success=False, error=str(e))

    async def new_tab(self, name: str | None = None) -> ActionResult:
        await self._ensure_connected()
        if len(self._tabs) >= self._max_tabs:
            return ActionResult(success=False, error=f"标签页已达上限 {self._max_tabs}")
        try:
            page = await self._context.new_page()
            tab_id = str(uuid.uuid4())[:8]
            self._tabs[tab_id] = page
            self._active_tab = tab_id
            if name:
                self._tab_names[tab_id] = name
            logger.info(f"新标签页: {tab_id}" + (f" ({name})" if name else ""))
            return ActionResult(success=True, tab_id=tab_id)
        except Exception as e:
            return ActionResult(success=False, error=str(e))

    async def switch_tab(self, tab_id: str) -> ActionResult:
        if tab_id not in self._tabs:
            return ActionResult(success=False, error=f"标签页 {tab_id} 不存在")
        self._active_tab = tab_id
        page = self._tabs[tab_id]
        shot = await self._take_screenshot(page)
        return ActionResult(
            success=True, screenshot_b64=shot, tab_id=tab_id,
            title=await page.title(), url=page.url,
        )

    async def close_tab(self, tab_id: str) -> ActionResult:
        if tab_id not in self._tabs:
            return ActionResult(success=False, error=f"标签页 {tab_id} 不存在")
        try:
            await self._tabs[tab_id].close()
            del self._tabs[tab_id]
            self._tab_names.pop(tab_id, None)
            if self._active_tab == tab_id:
                self._active_tab = next(iter(self._tabs), None)
            return ActionResult(success=True)
        except Exception as e:
            return ActionResult(success=False, error=str(e))

    async def list_tabs(self) -> List[TabInfo]:
        result = []
        for tid, page in self._tabs.items():
            try:
                title = await page.title()
                url = page.url
            except Exception:
                title, url = "", ""
            result.append(TabInfo(
                tab_id=tid, title=title, url=url,
                name=self._tab_names.get(tid),
            ))
        return result
