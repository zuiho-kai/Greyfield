"""WebSocket 集成测试 — MockLLM + MockTTS 注入，全链路自动验证

测试路径：TestClient(app) → ws_handler → VoicePipeline → PromptAssembler
         → MockLLM(yield 固定文本) → reply_text → MockTTS(skip audio) → status:idle

不涉及真实 LLM API / TTS / 麦克风 / 音频硬件。
"""

from __future__ import annotations

import pytest
from unittest.mock import patch
from starlette.testclient import TestClient

import greywind.server.app as app_module
from tests.helpers import MockLLM, make_mock_ctx


# ── 工具函数 ──────────────────────────────────────────────────────────────────

def collect_until_idle(ws, max_msgs: int = 30) -> list[dict]:
    """收集消息直到 status:idle 或达到上限。"""
    msgs = []
    for _ in range(max_msgs):
        msg = ws.receive_json()
        msgs.append(msg)
        if msg.get("type") == "status" and msg["payload"]["state"] == "idle":
            break
    return msgs


def send_text(ws, text: str) -> list[dict]:
    """发送 text_input，收集完整响应序列。"""
    ws.send_json({"type": "text_input", "payload": {"text": text}})
    return collect_until_idle(ws)


def reply_texts(msgs: list[dict]) -> list[str]:
    """提取所有 reply_text 消息的文本。"""
    return [m["payload"]["text"] for m in msgs if m.get("type") == "reply_text"]


def status_states(msgs: list[dict]) -> list[str]:
    """提取所有 status 消息的 state。"""
    return [m["payload"]["state"] for m in msgs if m.get("type") == "status"]


# ── 基础链路 ──────────────────────────────────────────────────────────────────

def test_text_input_full_cycle():
    """text_input → thinking → speaking → reply_text → idle 完整链路"""
    ctx = make_mock_ctx("你好，我是灰风。")
    with patch.object(app_module, "create_service_context", return_value=ctx):
        with TestClient(app_module.app) as client:
            with client.websocket_connect("/ws") as ws:
                msgs = send_text(ws, "你好")

    states = status_states(msgs)
    assert "thinking" in states
    assert "speaking" in states
    assert states[-1] == "idle"


def test_reply_text_contains_llm_response():
    """reply_text 中的文本来自 MockLLM 的固定回复"""
    ctx = make_mock_ctx("你好，我是灰风。")
    with patch.object(app_module, "create_service_context", return_value=ctx):
        with TestClient(app_module.app) as client:
            with client.websocket_connect("/ws") as ws:
                msgs = send_text(ws, "hi")

    texts = reply_texts(msgs)
    assert len(texts) > 0
    combined = "".join(texts)
    assert "灰风" in combined


def test_no_audio_messages_when_mock_tts():
    """MockTTS 返回 None → 不发送 reply_audio_meta 消息"""
    ctx = make_mock_ctx()
    with patch.object(app_module, "create_service_context", return_value=ctx):
        with TestClient(app_module.app) as client:
            with client.websocket_connect("/ws") as ws:
                msgs = send_text(ws, "测试")

    types = {m.get("type") for m in msgs}
    assert "reply_audio_meta" not in types


# ── 上下文连续性 ──────────────────────────────────────────────────────────────

def test_session_accumulates_across_turns():
    """多轮对话：第 N 轮 LLM 收到的 messages 长度 > 第 1 轮"""
    llm = MockLLM("好的。")
    ctx = make_mock_ctx(llm=llm)

    with patch.object(app_module, "create_service_context", return_value=ctx):
        with TestClient(app_module.app) as client:
            with client.websocket_connect("/ws") as ws:
                send_text(ws, "第一句话")
                send_text(ws, "第二句话")
                send_text(ws, "第三句话")

    # 共 3 次调用，第 3 次的 messages 应多于第 1 次（历史积累）
    assert len(llm.calls) == 3
    assert len(llm.calls[2]) > len(llm.calls[0])


def test_first_turn_has_user_message_in_messages():
    """第一轮 LLM 收到的 messages 中包含用户输入"""
    llm = MockLLM("嗯。")
    ctx = make_mock_ctx(llm=llm)

    with patch.object(app_module, "create_service_context", return_value=ctx):
        with TestClient(app_module.app) as client:
            with client.websocket_connect("/ws") as ws:
                send_text(ws, "请记住这句话")

    last_messages = llm.calls[-1]
    # 应该有 system + user 两条
    roles = [m["role"] for m in last_messages]
    assert "user" in roles
    user_content = next(m["content"] for m in last_messages if m["role"] == "user")
    assert "请记住这句话" in (user_content if isinstance(user_content, str) else str(user_content))


def test_third_turn_has_previous_assistant_turns():
    """第三轮 messages 中应能看到前两轮 assistant 的回复"""
    llm = MockLLM("好的。")
    ctx = make_mock_ctx(llm=llm)

    with patch.object(app_module, "create_service_context", return_value=ctx):
        with TestClient(app_module.app) as client:
            with client.websocket_connect("/ws") as ws:
                send_text(ws, "第一")
                send_text(ws, "第二")
                send_text(ws, "第三")

    third_messages = llm.calls[2]
    roles = [m["role"] for m in third_messages]
    # 第三轮应该有历史的 assistant 消息
    assert roles.count("assistant") >= 1


# ── clear_history ────────────────────────────────────────────────────────────

def test_clear_history_resets_session():
    """clear_history 后下一轮 LLM 只看到当前输入，不含历史"""
    llm = MockLLM("ok")
    ctx = make_mock_ctx(llm=llm)

    with patch.object(app_module, "create_service_context", return_value=ctx):
        with TestClient(app_module.app) as client:
            with client.websocket_connect("/ws") as ws:
                # 建立几轮历史
                send_text(ws, "消息一")
                send_text(ws, "消息二")

                # 清空历史
                ws.send_json({"type": "clear_history"})
                status_msg = ws.receive_json()
                assert status_msg["payload"]["state"] == "idle"

                # 清空后再发
                send_text(ws, "清空后的消息")

    # 清空前最后一次调用（消息二）的 messages 长度
    msgs_before_clear = len(llm.calls[1])
    # 清空后的 messages 长度（应该更短，没有历史）
    msgs_after_clear = len(llm.calls[2])

    assert msgs_after_clear < msgs_before_clear


# ── interrupt ────────────────────────────────────────────────────────────────

def test_interrupt_does_not_crash():
    """发送 interrupt 后服务端不崩溃，连接保持"""
    ctx = make_mock_ctx()
    with patch.object(app_module, "create_service_context", return_value=ctx):
        with TestClient(app_module.app) as client:
            with client.websocket_connect("/ws") as ws:
                # 发完立刻打断
                ws.send_json({"type": "text_input", "payload": {"text": "你好"}})
                ws.send_json({"type": "interrupt"})
                # 收到 idle 后仍能发下一条
                collect_until_idle(ws)
                msgs = send_text(ws, "打断后再发")

    # 没有崩溃，且第二次响应正常
    assert any(m.get("type") == "reply_text" for m in msgs)


# ── 未知消息类型 ──────────────────────────────────────────────────────────────

def test_unknown_message_type_keeps_connection():
    """未知消息类型不崩溃，连接保持"""
    ctx = make_mock_ctx()
    with patch.object(app_module, "create_service_context", return_value=ctx):
        with TestClient(app_module.app) as client:
            with client.websocket_connect("/ws") as ws:
                # 发未知类型
                ws.send_json({"type": "totally_unknown", "payload": {}})
                # 发正常消息，仍能响应
                msgs = send_text(ws, "连接还在吗")

    assert any(m.get("type") == "reply_text" for m in msgs)


# ── health 端点 ───────────────────────────────────────────────────────────────

def test_health_endpoint_returns_ok():
    """/health 返回 ok"""
    ctx = make_mock_ctx()
    with patch.object(app_module, "create_service_context", return_value=ctx):
        with TestClient(app_module.app) as client:
            response = client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["character"] == "灰风"
