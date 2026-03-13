"""OpenAI Whisper API ASR — 调用 OpenAI 语音转文字云端 API"""

import io
import wave

import numpy as np
from loguru import logger
from openai import OpenAI

from .asr_interface import ASRInterface


class VoiceRecognition(ASRInterface):
    def __init__(
        self, api_key: str = None, model: str = "whisper-1", lang: str = "zh",
        base_url: str = None,
    ) -> None:
        logger.info("初始化 OpenAI 兼容 ASR（base_url=%s, model=%s）...", base_url, model)
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.lang = lang

    def transcribe_np(self, audio: np.ndarray) -> str:
        audio = np.clip(audio, -1, 1)
        audio_integer = (audio * 32767).astype(np.int16)

        audio_buffer = io.BytesIO()
        with wave.open(audio_buffer, "wb") as wf:
            wf.setnchannels(self.NUM_CHANNELS)
            wf.setsampwidth(self.SAMPLE_WIDTH)
            wf.setframerate(self.SAMPLE_RATE)
            wf.writeframes(audio_integer.tobytes())
        audio_buffer.seek(0)

        transcription = self.client.audio.transcriptions.create(
            file=("audio.wav", audio_buffer.read()),
            model=self.model,
            response_format="text",
            language=self.lang,
            temperature=0.0,
        )
        return transcription
