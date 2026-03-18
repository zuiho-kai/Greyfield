"""执行层通用接口 — BrowserProvider / DesktopProvider 抽象基类 + ActionResult"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class ActionResult:
    """动作执行结果（浏览器/桌面共用）"""
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


class DesktopProvider(ABC):
    """桌面操控通用接口，所有 provider 实现此接口"""

    @abstractmethod
    async def screenshot(self, region: tuple[int, int, int, int] | None = None) -> ActionResult:
        """截取全屏或指定区域 (x, y, w, h)"""

    @abstractmethod
    async def click(self, x: int, y: int) -> ActionResult:
        """单击指定坐标"""

    @abstractmethod
    async def double_click(self, x: int, y: int) -> ActionResult:
        """双击指定坐标"""

    @abstractmethod
    async def right_click(self, x: int, y: int) -> ActionResult:
        """右键点击指定坐标"""

    @abstractmethod
    async def type_text(self, text: str) -> ActionResult:
        """在当前焦点输入文字（支持中文）"""

    @abstractmethod
    async def hotkey(self, *keys: str) -> ActionResult:
        """按组合键，如 hotkey('ctrl', 'c')"""

    @abstractmethod
    async def drag(self, x1: int, y1: int, x2: int, y2: int) -> ActionResult:
        """从 (x1,y1) 拖拽到 (x2,y2)"""

    @abstractmethod
    async def scroll(self, x: int, y: int, direction: str, amount: int = 3) -> ActionResult:
        """在指定位置滚动鼠标滚轮"""

    @abstractmethod
    async def move(self, x: int, y: int) -> ActionResult:
        """移动鼠标到指定位置"""

    @abstractmethod
    async def find_window(self, title: str | None = None) -> ActionResult:
        """查找/列出窗口"""

    @abstractmethod
    async def focus_window(self, title: str) -> ActionResult:
        """激活指定窗口"""
