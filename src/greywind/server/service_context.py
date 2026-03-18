"""服务上下文 — DI 容器，按配置实例化所有引擎和组件"""

from loguru import logger

from greywind.config.models import AppConfig, CharacterConfig
from greywind.config.loader import load_config, load_character
from greywind.memory.store_json import JSONMemoryStore
from greywind.context_runtime.session_manager import SessionManager
from greywind.context_runtime.thread_resolver import ThreadResolver
from greywind.context_runtime.prompt_assembler import PromptAssembler

_LLM_PROVIDER_MAP = {
    "openai": "openai_compatible_llm",
    "claude": "claude_llm",
    "ollama": "ollama_llm",
    "gemini": "openai_compatible_llm",
    "deepseek": "deepseek_llm",
}


class ServiceContext:
    """持有所有引擎和组件实例"""

    def __init__(self, config: AppConfig, character: CharacterConfig):
        self.config = config
        self.character = character
        self.session = SessionManager()
        self.thread = ThreadResolver()
        self.assembler = PromptAssembler()
        self.memory = JSONMemoryStore()
        self.memory.load()
        self.llm = self._create_llm()
        self.tts = self._create_tts()
        self.asr = self._try_create("ASR", self._create_asr)
        self.vad = self._try_create("VAD", self._create_vad)
        self.browser = self._try_create("Browser", self._create_browser)
        self.desktop = self._try_create("Desktop", self._create_desktop)
        logger.info("ServiceContext 初始化完成")

    @staticmethod
    def _try_create(name, factory):
        try:
            return factory()
        except Exception as e:
            logger.warning(f"{name} 引擎加载失败（相关功能不可用）: {e}")
            return None

    def _create_llm(self):
        from greywind.engines.llm.stateless_llm_factory import LLMFactory
        cfg = self.config.llm
        provider = _LLM_PROVIDER_MAP.get(cfg.provider, cfg.provider)
        return LLMFactory.create_llm(
            provider,
            model=cfg.model,
            llm_api_key=cfg.api_key,
            base_url=cfg.base_url,
        )

    def _create_tts(self):
        from greywind.engines.tts.tts_factory import TTSFactory
        cfg = self.config.tts
        return TTSFactory.get_tts_engine(
            cfg.engine,
            voice=cfg.voice,
            api_key=cfg.api_key,
            api_url=cfg.api_url,
            default_model=cfg.model,
            default_voice=cfg.voice,
            response_format=cfg.response_format,
            sample_rate=cfg.sample_rate,
            stream=cfg.stream,
            speed=cfg.speed,
            gain=cfg.gain,
            reference_audio=cfg.reference_audio,
            reference_text=cfg.reference_text,
        )

    def _create_asr(self):
        from greywind.engines.asr.asr_factory import ASRFactory
        cfg = self.config.asr
        return ASRFactory.get_asr_system(
            cfg.engine, model=cfg.model, api_key=cfg.api_key,
            base_url=cfg.base_url,
        )

    def _create_vad(self):
        from greywind.engines.vad.silero import VADEngine
        return VADEngine()

    def _create_browser(self):
        cfg = self.config.browser
        if not cfg.enabled:
            logger.info("浏览器操控已禁用")
            return None
        if cfg.provider == "playwright":
            from greywind.execution.playwright_provider import PlaywrightProvider
            return PlaywrightProvider(
                screenshot_quality=cfg.screenshot_quality,
                screenshot_width=cfg.screenshot_width,
                idle_timeout=cfg.idle_timeout,
                max_tabs=cfg.max_tabs,
                user_data_dir=cfg.user_data_dir or None,
            )
        elif cfg.provider == "extension":
            logger.warning("extension provider 尚未实现，浏览器操控不可用。请使用 playwright provider")
            return None
        else:
            logger.warning(f"未知浏览器 provider: {cfg.provider}")
            return None

    def _create_desktop(self):
        cfg = self.config.desktop
        if not cfg.enabled:
            logger.info("桌面操控已禁用")
            return None
        from greywind.execution.pyautogui_provider import PyAutoGuiProvider
        return PyAutoGuiProvider(
            screenshot_quality=cfg.screenshot_quality,
            screenshot_width=cfg.screenshot_width,
            action_delay=cfg.action_delay,
        )


def create_service_context(config_path: str = "conf.yaml") -> ServiceContext:
    config = load_config(config_path)
    character = load_character(config.character)
    return ServiceContext(config, character)
