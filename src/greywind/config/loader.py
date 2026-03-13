"""配置加载器 — YAML 加载 + 环境变量替换"""

import os
import re
from pathlib import Path
from typing import Optional

import yaml
from loguru import logger

from .models import AppConfig, CharacterConfig

_ENV_PATTERN = re.compile(r"\$\{(\w+)\}")


def _resolve_env_vars(obj):
    """递归替换配置值中的 ${VAR} 为环境变量"""
    if isinstance(obj, str):
        def replacer(m):
            key = m.group(1)
            val = os.environ.get(key, "")
            if not val:
                logger.warning(f"环境变量 {key} 未设置")
            return val
        return _ENV_PATTERN.sub(replacer, obj)
    elif isinstance(obj, dict):
        return {k: _resolve_env_vars(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_resolve_env_vars(v) for v in obj]
    return obj


def load_config(config_path: str = "conf.yaml") -> AppConfig:
    """加载主配置文件"""
    path = Path(config_path)
    if not path.exists():
        logger.warning(f"配置文件 {config_path} 不存在，使用默认配置")
        return AppConfig()

    with open(path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}

    resolved = _resolve_env_vars(raw)
    config = AppConfig(**resolved)
    logger.info(f"配置加载完成: {config_path}")
    return config


def load_character(
    name: str, characters_dir: str = "src/characters"
) -> CharacterConfig:
    """加载角色配置文件"""
    path = Path(characters_dir) / f"{name}.yaml"
    if not path.exists():
        logger.warning(f"角色文件 {path} 不存在，使用默认角色")
        return CharacterConfig()

    with open(path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}

    character = CharacterConfig(**raw)
    logger.info(f"角色加载完成: {name}")
    return character
