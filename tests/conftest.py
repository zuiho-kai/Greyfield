"""测试共用 fixtures — 从 helpers 导入工具类，暴露 pytest fixtures"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from greywind.config.models import CharacterConfig
from greywind.context_runtime.prompt_assembler import PromptAssembler
from greywind.memory.store_json import JSONMemoryStore

# 工具类统一从 helpers 导入，方便集成测试直接 import
from tests.helpers import MockLLM, MockTTS, make_mock_ctx  # noqa: F401


# ── pytest fixtures ────────────────────────────────────────────────────────────

@pytest.fixture
def mock_ctx():
    return make_mock_ctx()


@pytest.fixture
def recording_llm():
    """可独立断言调用记录的 LLM mock。"""
    return MockLLM("好的。")


@pytest.fixture
def test_client(mock_ctx):
    """注入 mock_ctx 的 TestClient，lifespan 跑但返回 mock。"""
    from starlette.testclient import TestClient
    import greywind.server.app as app_module

    with patch.object(app_module, "create_service_context", return_value=mock_ctx):
        with TestClient(app_module.app, raise_server_exceptions=True) as client:
            yield client


# ── 单元测试 fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def sample_character() -> CharacterConfig:
    return CharacterConfig(name="灰风", persona="你是灰风。")


@pytest.fixture
def tmp_memory_file(tmp_path) -> Path:
    data = {
        "persona_facts": ["我叫灰风", "我来自灰蛊风暴"],
        "user_facts": ["用户喜欢编程"],
        "preferences": ["用中文回答"],
    }
    p = tmp_path / "memory.json"
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return p


@pytest.fixture
def memory_store(tmp_memory_file) -> JSONMemoryStore:
    store = JSONMemoryStore(path=str(tmp_memory_file))
    store.load()
    return store


@pytest.fixture
def assembler() -> PromptAssembler:
    return PromptAssembler()
