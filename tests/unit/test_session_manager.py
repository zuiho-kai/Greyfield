"""SessionManager 单元测试"""

import uuid
import pytest
from greywind.context_runtime.session_manager import SessionManager


@pytest.fixture
def sm():
    return SessionManager(max_recent=5)


# ── session_id ────────────────────────────────────────────────────────────────

def test_session_id_is_valid_uuid(sm):
    uuid.UUID(sm.session_id)  # 不抛异常即为合法 UUID


def test_session_id_stable(sm):
    assert sm.session_id == sm.session_id


def test_two_sessions_have_different_ids():
    assert SessionManager().session_id != SessionManager().session_id


# ── add_turn / get_recent_dialogue ───────────────────────────────────────────

def test_add_and_get_turns(sm):
    sm.add_turn("user", "你好")
    sm.add_turn("assistant", "你好，我是灰风。")
    turns = sm.get_recent_dialogue()
    assert len(turns) == 2
    assert turns[0]["role"] == "user"
    assert turns[0]["content"] == "你好"
    assert turns[1]["role"] == "assistant"


def test_turns_have_timestamp(sm):
    sm.add_turn("user", "hi")
    turn = sm.get_recent_dialogue()[0]
    assert "timestamp" in turn
    assert isinstance(turn["timestamp"], float)


# ── max_recent 裁剪 ──────────────────────────────────────────────────────────

def test_max_recent_trim(sm):
    # max_recent=5 → 最多保留 5*2=10 条消息
    for i in range(12):
        sm.add_turn("user", f"消息{i}")
    turns = sm.get_recent_dialogue()
    assert len(turns) == 10


def test_get_recent_returns_latest_turns(sm):
    for i in range(12):
        sm.add_turn("user", f"消息{i}")
    turns = sm.get_recent_dialogue()
    # 最后一条应该是 消息11
    assert turns[-1]["content"] == "消息11"


def test_get_recent_returns_at_most_max_recent_times_2():
    sm = SessionManager(max_recent=3)
    for i in range(10):
        sm.add_turn("user", f"msg{i}")
    assert len(sm.get_recent_dialogue()) == 6  # 3*2


# ── state ────────────────────────────────────────────────────────────────────

def test_initial_state_is_idle(sm):
    assert sm.state == "idle"


def test_state_setter(sm):
    sm.state = "thinking"
    assert sm.state == "thinking"
    sm.state = "speaking"
    assert sm.state == "speaking"


# ── clear ────────────────────────────────────────────────────────────────────

def test_clear_empties_dialogue(sm):
    sm.add_turn("user", "hi")
    sm.add_turn("assistant", "hello")
    sm.clear()
    assert sm.get_recent_dialogue() == []


def test_clear_allows_new_turns(sm):
    sm.add_turn("user", "before")
    sm.clear()
    sm.add_turn("user", "after")
    turns = sm.get_recent_dialogue()
    assert len(turns) == 1
    assert turns[0]["content"] == "after"
