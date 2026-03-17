# Original source: Open-LLM-VTuber (https://github.com/Open-LLM-VTuber/Open-LLM-VTuber)
# Copyright (c) 2025 Yi-Ting Chiu, MIT License
# Modified for GreyWind project
import requests
from loguru import logger
from .tts_interface import TTSInterface


class SiliconFlowTTS(TTSInterface):
    def __init__(
        self,
        api_url,
        api_key,
        default_model,
        default_voice,
        sample_rate,
        response_format,
        stream,
        speed,
        gain,
        reference_audio=None,
        reference_text=None,
    ):
        self.api_url = api_url
        self.api_key = api_key
        self.default_model = default_model
        self.default_voice = default_voice
        self.sample_rate = sample_rate
        self.response_format = response_format
        self.stream = stream
        self.speed = speed
        self.gain = gain
        self.reference_audio = reference_audio
        self.reference_text = reference_text
        # 预加载参考音频 base64（启动时一次性读取）
        self._reference_b64 = None
        if reference_audio:
            self._reference_b64 = self._load_reference(reference_audio)

    @staticmethod
    def _load_reference(audio_path: str) -> str:
        """读取参考音频文件，返回 data URI（base64）"""
        import base64
        from pathlib import Path

        p = Path(audio_path)
        if not p.exists():
            logger.warning(f"参考音频文件不存在: {audio_path}")
            return ""
        suffix = p.suffix.lstrip(".").lower()
        mime = {"mp3": "audio/mpeg", "wav": "audio/wav", "ogg": "audio/ogg"}.get(
            suffix, "audio/mpeg"
        )
        raw = p.read_bytes()
        b64 = base64.b64encode(raw).decode()
        logger.info(f"已加载参考音频: {audio_path} ({len(raw)} bytes)")
        return f"data:{mime};base64,{b64}"

    def _build_payload(self, text: str) -> dict:
        """构建 TTS 请求体，有参考音频时用 references 模式"""
        payload = {
            "input": text,
            "response_format": self.response_format,
            "sample_rate": self.sample_rate,
            "stream": self.stream,
            "speed": self.speed,
            "gain": self.gain,
            "model": self.default_model,
        }
        if self._reference_b64 and self.reference_text:
            # references 模式：即时音色克隆，voice 和 references 互斥
            payload["references"] = [
                {"audio": self._reference_b64, "text": self.reference_text}
            ]
        else:
            payload["voice"] = self.default_voice
        return payload

    def generate_audio(self, text: str, file_name_no_ext=None) -> str:
        cache_file = self.generate_cache_file_name(
            file_name_no_ext, file_extension=self.response_format
        )
        payload = self._build_payload(text)
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            if self.api_url is None:
                logger.error("API URL 未正确配置，请检查配置文件")
                return ""
            response = requests.post(self.api_url, json=payload, headers=headers)
            response.raise_for_status()
            with open(cache_file, "wb") as f:
                f.write(response.content)
            mode = "references" if self._reference_b64 else "voice"
            logger.info(f"音频生成成功 ({mode}): {cache_file}")
            return cache_file
        except requests.RequestException as e:
            logger.error(f"音频生成失败: {e}")
            return ""

    def remove_file(self, filepath: str, verbose: bool = True) -> None:
        super().remove_file(filepath, verbose)

    def generate_cache_file_name(self, file_name_no_ext=None, file_extension="wav"):
        return super().generate_cache_file_name(file_name_no_ext, file_extension)
