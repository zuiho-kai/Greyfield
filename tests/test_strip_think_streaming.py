"""_strip_think_streaming 专项测试

覆盖三类边界：
1. 标签跨 chunk 拆分
2. EOF flush（流结束时 pending 残留）
3. 过滤后内容不含 think block（持久化路径验证）
"""

import pytest
from greywind.persona.voice_pipeline import _strip_think_streaming


# ── 基础功能 ──────────────────────────────────────────────────────────────────

def test_no_think_block():
    text, inside, pending = _strip_think_streaming("hello", False)
    assert text == "hello"
    assert inside is False
    assert pending == ""


def test_complete_think_block_single_chunk():
    text, inside, pending = _strip_think_streaming("a<think>内部</think>b", False)
    assert text == "ab"
    assert inside is False
    assert pending == ""


def test_think_block_only():
    text, inside, pending = _strip_think_streaming("<think>内部</think>", False)
    assert text == ""
    assert inside is False


# ── 边界1：标签跨 chunk 拆分 ──────────────────────────────────────────────────

def test_open_tag_split_across_chunks():
    """<think> 被拆成 <thi + nk>"""
    text1, inside1, pending1 = _strip_think_streaming("hello<thi", False)
    assert text1 == "hello"
    assert inside1 is False
    assert pending1 == "<thi"

    text2, inside2, pending2 = _strip_think_streaming("nk>内部</think>world", inside1, pending1)
    assert text2 == "world"
    assert inside2 is False
    assert pending2 == ""


def test_close_tag_split_across_chunks():
    """</think> 被拆成 </thi + nk>"""
    text1, inside1, pending1 = _strip_think_streaming("<think>内部</thi", False)
    assert text1 == ""
    assert inside1 is True
    assert pending1 == "</thi"

    text2, inside2, pending2 = _strip_think_streaming("nk>after", inside1, pending1)
    assert text2 == "after"
    assert inside2 is False
    assert pending2 == ""


def test_open_tag_split_single_char():
    """<think> 末尾只剩 < 一个字符"""
    text1, inside1, pending1 = _strip_think_streaming("hello<", False)
    assert text1 == "hello"
    assert pending1 == "<"

    text2, inside2, pending2 = _strip_think_streaming("think>skip</think>end", inside1, pending1)
    assert text2 == "end"
    assert inside2 is False


# ── 边界2：EOF flush ───────────────────────────────────────────────────────────

def test_eof_no_pending():
    """流结束时 pending 为空，不影响结果"""
    text, inside, pending = _strip_think_streaming("final", False)
    assert text == "final"
    assert pending == ""


def test_eof_pending_not_in_think():
    """流结束时 pending 有内容且不在 think block 内，应 flush"""
    # 模拟最后一个 chunk 末尾有 <think> 前缀但流已结束
    text, inside, pending = _strip_think_streaming("end<thi", False)
    assert text == "end"
    assert pending == "<thi"
    # 调用方在 EOF 时：if pending and not inside: clean_response += pending
    assert not inside  # 确认不在 think block 内，pending 应被 flush


def test_eof_pending_inside_think():
    """流结束时仍在 think block 内，pending 应丢弃"""
    text, inside, pending = _strip_think_streaming("<think>未闭合", False)
    assert text == ""
    assert inside is True
    # 调用方在 EOF 时：if pending and not inside 为 False，pending 丢弃


# ── 边界3：持久化路径（过滤后内容不含 think block）────────────────────────────

def test_filtered_output_has_no_think_content():
    """多 chunk 累积后，过滤结果不含任何 think block 内容"""
    chunks = [
        "你好",
        "<think>",
        "这是推理过程",
        "不应出现在输出",
        "</think>",
        "我是灰风",
    ]
    inside = False
    pending = ""
    clean = ""
    for chunk in chunks:
        filtered, inside, pending = _strip_think_streaming(chunk, inside, pending)
        clean += filtered
    if pending and not inside:
        clean += pending
    assert "推理过程" not in clean
    assert "不应出现" not in clean
    assert clean == "你好我是灰风"


def test_multiple_think_blocks():
    """单 chunk 含多个 think block"""
    text, inside, pending = _strip_think_streaming(
        "a<think>x</think>b<think>y</think>c", False
    )
    assert text == "abc"
    assert inside is False
