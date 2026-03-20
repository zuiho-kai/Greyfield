"""JSONMemoryStore 单元测试"""

import json
import pytest
from pathlib import Path

from greywind.memory.store_json import JSONMemoryStore


@pytest.fixture
def empty_store(tmp_path) -> JSONMemoryStore:
    store = JSONMemoryStore(path=str(tmp_path / "memory.json"))
    # 不调用 load()，使用空默认 _data
    return store


@pytest.fixture
def loaded_store(tmp_path) -> JSONMemoryStore:
    data = {
        "persona_facts": ["我叫灰风", "我来自灰蛊风暴"],
        "user_facts": ["用户喜欢编程"],
        "preferences": ["使用中文回答"],
    }
    p = tmp_path / "memory.json"
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    store = JSONMemoryStore(path=str(p))
    store.load()
    return store


# ── 文件不存在时的安全行为 ────────────────────────────────────────────────────

def test_load_missing_file_no_exception(tmp_path):
    store = JSONMemoryStore(path=str(tmp_path / "nonexistent.json"))
    store.load()  # 不应抛异常


def test_empty_store_get_system_prompt_is_empty(empty_store):
    assert empty_store.get_system_prompt() == ""


def test_empty_store_get_entries_is_empty(empty_store):
    assert empty_store.get_entries() == []


# ── 有数据时的 get_system_prompt 格式 ───────────────────────────────────────

def test_persona_facts_in_prompt(loaded_store):
    prompt = loaded_store.get_system_prompt()
    assert "关于我：" in prompt
    assert "我叫灰风" in prompt


def test_user_facts_in_prompt(loaded_store):
    prompt = loaded_store.get_system_prompt()
    assert "关于用户：" in prompt
    assert "用户喜欢编程" in prompt


def test_preferences_in_prompt(loaded_store):
    prompt = loaded_store.get_system_prompt()
    assert "用户偏好：" in prompt
    assert "使用中文回答" in prompt


# ── add_entry ────────────────────────────────────────────────────────────────

def test_add_persona_fact(empty_store):
    empty_store.add_entry({"type": "persona_facts", "content": "我是 AI"})
    entries = empty_store.get_entries()
    assert any(e["content"] == "我是 AI" for e in entries)


def test_add_user_fact(empty_store):
    empty_store.add_entry({"type": "user_facts", "content": "用户叫张三"})
    prompt = empty_store.get_system_prompt()
    assert "用户叫张三" in prompt


def test_add_entry_with_unknown_type_ignored(empty_store):
    empty_store.add_entry({"type": "unknown_type", "content": "应被忽略"})
    assert empty_store.get_entries() == []


def test_add_entry_with_empty_content_ignored(empty_store):
    empty_store.add_entry({"type": "persona_facts", "content": ""})
    assert empty_store.get_entries() == []


# ── save / load 往返 ─────────────────────────────────────────────────────────

def test_save_load_roundtrip(tmp_path):
    path = str(tmp_path / "memory.json")
    store1 = JSONMemoryStore(path=path)
    store1.add_entry({"type": "persona_facts", "content": "我叫灰风"})
    store1.save()

    store2 = JSONMemoryStore(path=path)
    store2.load()
    prompt = store2.get_system_prompt()
    assert "我叫灰风" in prompt


# ── 损坏文件容错 ─────────────────────────────────────────────────────────────

def test_corrupted_json_no_exception(tmp_path):
    p = tmp_path / "bad.json"
    p.write_text("{invalid json!!!", encoding="utf-8")
    store = JSONMemoryStore(path=str(p))
    store.load()  # 不应抛异常
    assert store.get_system_prompt() == ""
