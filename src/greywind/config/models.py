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
    enabled: bool = True
    capture_interval: float = 3.0
    trigger_frames: int = 5
    diff_threshold: float = 0.02
    cooldown: float = 30.0
    detail: str = "low"
    buffer_size: int = 10


class AppConfig(BaseModel):
    server: ServerConfig = ServerConfig()
    llm: LLMConfig = LLMConfig()
    asr: ASRConfig = ASRConfig()
    tts: TTSConfig = TTSConfig()
    memory: MemoryConfig = MemoryConfig()
    screen: ScreenConfig = ScreenConfig()
    character: str = "greywind"
