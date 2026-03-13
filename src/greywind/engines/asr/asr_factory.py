# Original source: Open-LLM-VTuber (https://github.com/Open-LLM-VTuber/Open-LLM-VTuber)
# Copyright (c) 2025 Yi-Ting Chiu, MIT License
# Modified for GreyWind project
from typing import Type
from .asr_interface import ASRInterface


class ASRFactory:
    @staticmethod
    def get_asr_system(system_name: str, **kwargs) -> Type[ASRInterface]:
        if system_name == "whisper_api":
            from .openai_api_asr import VoiceRecognition as OpenAIWhisperASR

            return OpenAIWhisperASR(
                api_key=kwargs.get("api_key"),
                model=kwargs.get("model", "whisper-1"),
                lang=kwargs.get("lang", "zh"),
                base_url=kwargs.get("base_url"),
            )
        else:
            raise ValueError(f"Unknown ASR system: {system_name}")
