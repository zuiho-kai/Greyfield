# Original source: Open-LLM-VTuber (https://github.com/Open-LLM-VTuber/Open-LLM-VTuber)
# Copyright (c) 2025 Yi-Ting Chiu, MIT License
# Modified for GreyWind project
from typing import Type

from loguru import logger

from .stateless_llm.stateless_llm_interface import StatelessLLMInterface


class LLMFactory:
    @staticmethod
    def create_llm(llm_provider, **kwargs) -> Type[StatelessLLMInterface]:
        logger.info(f"Initializing LLM: {llm_provider}")

        if llm_provider in (
            "openai_compatible_llm", "openai_llm", "openai",
            "gemini_llm", "zhipu_llm", "deepseek_llm",
            "groq_llm", "mistral_llm", "lmstudio_llm",
        ):
            from .stateless_llm.openai_compatible_llm import AsyncLLM as OpenAICompatibleLLM

            return OpenAICompatibleLLM(
                model=kwargs.get("model"),
                base_url=kwargs.get("base_url"),
                llm_api_key=kwargs.get("llm_api_key"),
                organization_id=kwargs.get("organization_id"),
                project_id=kwargs.get("project_id"),
                temperature=kwargs.get("temperature"),
            )
        elif llm_provider == "claude_llm":
            from .stateless_llm.claude_llm import AsyncLLM as ClaudeLLM

            return ClaudeLLM(
                system=kwargs.get("system_prompt"),
                base_url=kwargs.get("base_url"),
                model=kwargs.get("model"),
                llm_api_key=kwargs.get("llm_api_key"),
            )
        elif llm_provider == "ollama_llm":
            from .stateless_llm.ollama_llm import OllamaLLM

            return OllamaLLM(
                model=kwargs.get("model"),
                base_url=kwargs.get("base_url"),
                llm_api_key=kwargs.get("llm_api_key"),
                organization_id=kwargs.get("organization_id"),
                project_id=kwargs.get("project_id"),
                temperature=kwargs.get("temperature"),
                keep_alive=kwargs.get("keep_alive"),
                unload_at_exit=kwargs.get("unload_at_exit"),
            )
        elif llm_provider == "doubao_web":
            from .stateless_llm.doubao_web_llm import DoubaoWebLLM

            return DoubaoWebLLM(
                user_data_dir=kwargs.get("user_data_dir"),
                poll_interval=kwargs.get("poll_interval", 0.5),
                max_wait=kwargs.get("max_wait", 120),
            )
        elif llm_provider == "parallel_web":
            from .stateless_llm.parallel_web_llm import ParallelWebLLM
            from .stateless_llm.doubao_web_llm import DoubaoWebLLM

            # 主 LLM 用 kwargs 里的 primary_provider 创建
            primary_provider = kwargs.pop("primary_provider", "openai_compatible_llm")
            primary = LLMFactory.create_llm(primary_provider, **kwargs)
            web_llm = DoubaoWebLLM(
                user_data_dir=kwargs.get("user_data_dir"),
                max_wait=kwargs.get("web_max_wait", 120),
            )
            return ParallelWebLLM(primary=primary, web_llm=web_llm)
        else:
            raise ValueError(f"Unsupported LLM provider: {llm_provider}")
