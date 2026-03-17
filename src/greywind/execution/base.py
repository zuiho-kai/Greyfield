"""浏览器操控通用接口 — BrowserProvider 抽象基类 + ActionResult"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class ActionResult:
    """浏览器动作执行结果"""
    success: bool
    screenshot_b64: Optional[str] = None
    text: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None
    tab_id: Optional[str] = None
    error: Optional[str] = None


@dataclass
class TabInfo:
    """标签页信息"""
    tab_id: str
    title: str = ""
    url: str = ""
    name: Optional[str] = None  # 命名标签页


class BrowserProvider(ABC):
    """浏览器操控通用接口，所有 provider 实现此接口"""

    @abstractmethod
    async def connect(self) -> bool:
        """连接/启动浏览器"""

    @abstractmethod
    async def disconnect(self):
        """断开连接"""

    @abstractmethod
    async def goto(self, url: str, tab_id: str | None = None) -> ActionResult:
        """导航到 URL"""

    @abstractmethod
    async def click(self, selector: str, tab_id: str | None = None) -> ActionResult:
        """点击元素"""

    @abstractmethod
    async def type_text(self, selector: str, text: str, tab_id: str | None = None) -> ActionResult:
        """输入文本"""

    @abstractmethod
    async def screenshot(self, tab_id: str | None = None) -> ActionResult:
        """截取当前页面"""

    @abstractmethod
    async def read_text(self, selector: str | None = None, tab_id: str | None = None) -> ActionResult:
        """读取页面文本"""

    @abstractmethod
    async def scroll(self, direction: str, amount: int | None = None, tab_id: str | None = None) -> ActionResult:
        """滚动页面"""

    @abstractmethod
    async def back(self, tab_id: str | None = None) -> ActionResult:
        """后退"""

    @abstractmethod
    async def wait(self, selector: str | None = None, timeout: int | None = None, tab_id: str | None = None) -> ActionResult:
        """等待元素/时间"""

    @abstractmethod
    async def new_tab(self, name: str | None = None) -> ActionResult:
        """新开标签页"""

    @abstractmethod
    async def switch_tab(self, tab_id: str) -> ActionResult:
        """切换标签页"""

    @abstractmethod
    async def close_tab(self, tab_id: str) -> ActionResult:
        """关闭标签页"""

    @abstractmethod
    async def list_tabs(self) -> List[TabInfo]:
        """列出所有标签页"""

    @property
    @abstractmethod
    def is_connected(self) -> bool:
        """是否已连接"""
