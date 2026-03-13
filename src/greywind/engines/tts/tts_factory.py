# Original source: Open-LLM-VTuber (https://github.com/Open-LLM-VTuber/Open-LLM-VTuber)
# Copyright (c) 2025 Yi-Ting Chiu, MIT License
# Modified for GreyWind project
from typing import Type
from .tts_interface import TTSInterface


class TTSFactory:
    @staticmethod
    def get_tts_engine(engine_type, **kwargs) -> Type[TTSInterface]:
        if engine_type == "edge_tts":
            from .edge_tts import TTSEngine as EdgeTTSEngine

            return EdgeTTSEngine(kwargs.get("voice"))
        elif engine_type == "siliconflow_tts":
            from .siliconflow_tts import SiliconFlowTTS

            return SiliconFlowTTS(
                api_url=kwargs.get("api_url"),
                api_key=kwargs.get("api_key"),
                default_model=kwargs.get("default_model"),
                default_voice=kwargs.get("default_voice"),
                sample_rate=kwargs.get("sample_rate"),
                response_format=kwargs.get("response_format"),
                stream=kwargs.get("stream"),
                speed=kwargs.get("speed"),
                gain=kwargs.get("gain"),
            )
        else:
            raise ValueError(f"Unknown TTS engine type: {engine_type}")
