"""PromptAssembler 单元测试"""

import pytest
from greywind.config.models import CharacterConfig
from greywind.context_runtime.prompt_assembler import PromptAssembler


@pytest.fixture
def asm():
    return PromptAssembler()


@pytest.fixture
def char():
    return CharacterConfig(name="灰风", persona="你是灰风，桌面 AI 伴侣。")


def _system(messages):
    return next(m["content"] for m in messages if m["role"] == "system")


def _user(messages):
    return next(m for m in messages if m["role"] == "user")


# ── persona 注入 ──────────────────────────────────────────────────────────────

def test_persona_appears_in_system(asm, char):
    msgs = asm.assemble(char, "", "t1", "s1", [], "你好")
    assert "你是灰风" in _system(msgs)


def test_empty_persona_skipped(asm):
    char = CharacterConfig(name="灰风", persona="")
    msgs = asm.assemble(char, "", "t1", "s1", [], "你好")
    # system 不含 persona 但仍含 thread/session 行
    assert "[thread: t1]" in _system(msgs)


# ── 工具注入 ──────────────────────────────────────────────────────────────────

def test_tools_injected_when_provided(asm, char):
    msgs = asm.assemble(char, "", "t1", "s1", [], "你好", enabled_tools=["浏览器", "桌面"])
    assert "浏览器" in _system(msgs)
    assert "桌面" in _system(msgs)


def test_tools_not_injected_when_none(asm, char):
    msgs = asm.assemble(char, "", "t1", "s1", [], "你好", enabled_tools=None)
    assert "【工具使用】" not in _system(msgs)


def test_tools_not_injected_when_empty(asm, char):
    msgs = asm.assemble(char, "", "t1", "s1", [], "你好", enabled_tools=[])
    assert "【工具使用】" not in _system(msgs)


# ── 记忆注入 ──────────────────────────────────────────────────────────────────

def test_memory_prompt_appears_in_system(asm, char):
    msgs = asm.assemble(char, "关于我：\n- 我叫灰风", "t1", "s1", [], "你好")
    assert "关于我" in _system(msgs)


def test_empty_memory_not_injected(asm, char):
    msgs = asm.assemble(char, "", "t1", "s1", [], "你好")
    sys = _system(msgs)
    # 不含 None 或 "None" 字符串
    assert "None" not in sys


# ── thread/session 元信息 ────────────────────────────────────────────────────

def test_thread_and_session_in_system(asm, char):
    msgs = asm.assemble(char, "", "thread-abc", "session-xyz", [], "你好")
    sys = _system(msgs)
    assert "thread: thread-abc" in sys
    assert "session: session-xyz" in sys


# ── 用户消息格式 ─────────────────────────────────────────────────────────────

def test_user_message_is_string_without_screenshot(asm, char):
    msgs = asm.assemble(char, "", "t1", "s1", [], "你好")
    user = _user(msgs)
    assert user["content"] == "你好"


def test_user_message_is_list_with_screenshot(asm, char):
    msgs = asm.assemble(char, "", "t1", "s1", [], "看看这个", screen_image_b64="FAKEBASE64")
    user = _user(msgs)
    assert isinstance(user["content"], list)
    types_ = [part["type"] for part in user["content"]]
    assert "image_url" in types_
    assert "text" in types_


def test_screenshot_detail_low(asm, char):
    msgs = asm.assemble(char, "", "t1", "s1", [], "X", screen_image_b64="B64", screen_detail="low")
    user = _user(msgs)
    img_part = next(p for p in user["content"] if p["type"] == "image_url")
    assert img_part["image_url"]["detail"] == "low"


# ── 历史对话顺序 ──────────────────────────────────────────────────────────────

def test_recent_dialogue_in_order(asm, char):
    history = [
        {"role": "user", "content": "第一条"},
        {"role": "assistant", "content": "回复一"},
        {"role": "user", "content": "第二条"},
    ]
    msgs = asm.assemble(char, "", "t1", "s1", history, "第三条")
    # system + 3 history + 1 current user = 5
    assert len(msgs) == 5
    assert msgs[1]["content"] == "第一条"
    assert msgs[2]["content"] == "回复一"
    assert msgs[3]["content"] == "第二条"
    assert msgs[4]["content"] == "第三条"


def test_empty_history(asm, char):
    msgs = asm.assemble(char, "", "t1", "s1", [], "你好")
    assert len(msgs) == 2  # system + user
