"""配置数据模型 — Pydantic 校验"""

from typing import Optional, Dict
from pydantic import BaseModel


class ServerConfig(BaseModel):
    host: str = "127.0.0.1"
    port: int = 12393


class LLMConfig(BaseModel):
    provider: str = "openai"
    model: str = "stepfun-ai/Step-3.5-Flash"
    api_key: str = ""
    base_url: Optional[str] = "https://api.siliconflow.cn/v1"


class ASRConfig(BaseModel):
    engine: str = "whisper_api"
    model: str = "whisper-1"
    api_key: str = ""
    base_url: Optional[str] = None


class TTSConfig(BaseModel):
    engine: str = "edge_tts"
    voice: str = "zh-CN-XiaoxiaoNeural"
    api_key: Optional[str] = None
    api_url: Optional[str] = None
    model: Optional[str] = None
    response_format: str = "mp3"
    sample_rate: int = 32000
    stream: bool = False
    speed: float = 1.0
    gain: float = 0.0


class MemoryConfig(BaseModel):
    backend: str = "json"


class CharacterConfig(BaseModel):
    name: str = "灰风"
    persona: str = ""
    live2d_model: str = "greywind"
    emotion_map: Dict[str, str] = {}


class ScreenConfig(BaseModel):
    enabled: bool = False
    capture_interval: float = 3.0
    trigger_frames: int = 5
    diff_threshold: float = 0.05
    cooldown: float = 60.0
    detail: str = "high"
    buffer_size: int = 10
    active_window_filter: bool = True   # 前台窗口标题没变时跳过
    monitor: str = "active"             # active=鼠标所在屏幕, primary=主屏, all=全部


class BrowserConfig(BaseModel):
    enabled: bool = False
    provider: str = "playwright"        # playwright | extension
    screenshot_quality: int = 50
    screenshot_width: int = 1280
    idle_timeout: int = 60
    named_tab_timeout: int = 0          # 0 = 命名标签页不自动关闭
    max_tabs: int = 10
    max_tool_rounds: int = 30
    user_data_dir: str = ""             # 持久化浏览器数据目录，空则用默认路径


class AppConfig(BaseModel):
    server: ServerConfig = ServerConfig()
    llm: LLMConfig = LLMConfig()
    asr: ASRConfig = ASRConfig()
    tts: TTSConfig = TTSConfig()
    memory: MemoryConfig = MemoryConfig()
    screen: ScreenConfig = ScreenConfig()
    browser: BrowserConfig = BrowserConfig()
    character: str = "greywind"
