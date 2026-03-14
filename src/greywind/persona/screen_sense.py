"""屏幕感知模块 — 截图收集、差异检测、主动触发判断"""

import base64
import io
import time
from collections import deque

from loguru import logger

try:
    from PIL import Image
except ImportError:
    Image = None
    logger.warning("Pillow 未安装，屏幕感知的差异检测不可用")


class ScreenSense:
    """管理截图缓冲区，提供差异检测和触发判断"""

    def __init__(
        self,
        buffer_size: int = 10,
        trigger_frames: int = 5,
        diff_threshold: float = 0.02,
        cooldown: float = 30.0,
    ):
        self._buffer: deque[str] = deque(maxlen=buffer_size)
        self._trigger_frames = trigger_frames
        self._diff_threshold = diff_threshold
        self._cooldown = cooldown
        self._last_speak_time: float = 0.0
        self._frames_since_trigger: int = 0
        self._last_thumb = None  # 上一帧缩略图，用于差异检测
        self._enabled = True

    def receive_frame(self, image_b64: str) -> bool:
        """收到一帧截图，做差异检测，返回是否被采纳（非重复帧）"""
        if not self._enabled:
            return False

        if Image is not None:
            try:
                thumb = self._make_thumbnail(image_b64)
                if self._last_thumb is not None:
                    diff = self._pixel_diff(self._last_thumb, thumb)
                    if diff < self._diff_threshold:
                        return False
                self._last_thumb = thumb
            except Exception as e:
                logger.debug(f"截图差异检测失败，直接采纳: {e}")

        self._buffer.append(image_b64)
        self._frames_since_trigger += 1
        return True

    def should_trigger(self) -> bool:
        """判断是否应该触发一次主动说话"""
        if not self._enabled:
            return False
        if self._frames_since_trigger < self._trigger_frames:
            return False
        if time.time() - self._last_speak_time < self._cooldown:
            return False
        return True

    def mark_spoken(self):
        """标记刚刚主动说了话，重置计数器并进入冷却"""
        self._last_speak_time = time.time()
        self._frames_since_trigger = 0

    def get_recent_frames(self, n: int = 5) -> list[str]:
        """取最近 N 张截图的 base64"""
        items = list(self._buffer)
        return items[-n:]

    def get_latest_frame(self) -> str | None:
        """取最新一张截图（被动模式用）"""
        return self._buffer[-1] if self._buffer else None

    def clear(self):
        """清空缓冲区"""
        self._buffer.clear()
        self._frames_since_trigger = 0
        self._last_thumb = None

    @property
    def enabled(self) -> bool:
        return self._enabled

    @enabled.setter
    def enabled(self, value: bool):
        self._enabled = value
        if not value:
            self.clear()

    @staticmethod
    def _make_thumbnail(image_b64: str):
        """将 base64 图片缩小到 160x90 用于差异比较"""
        raw = base64.b64decode(image_b64)
        img = Image.open(io.BytesIO(raw)).convert("L")  # 灰度
        return img.resize((160, 90))

    @staticmethod
    def _pixel_diff(img_a, img_b) -> float:
        """计算两张缩略图的归一化 RMSE (0~1)"""
        pixels_a = list(img_a.getdata())
        pixels_b = list(img_b.getdata())
        if len(pixels_a) != len(pixels_b):
            return 1.0
        mse = sum((a - b) ** 2 for a, b in zip(pixels_a, pixels_b)) / len(pixels_a)
        # RMSE 归一化到 0~1
        return (mse ** 0.5) / 255.0
