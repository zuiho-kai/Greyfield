"""ThreadResolver 单元测试"""

import uuid
import pytest
from greywind.context_runtime.thread_resolver import ThreadResolver


@pytest.fixture
def tr():
    return ThreadResolver()


def test_resolve_returns_valid_uuid(tr):
    uuid.UUID(tr.resolve())


def test_resolve_is_stable(tr):
    """同一实例多次 resolve 返回同一 thread_id"""
    assert tr.resolve() == tr.resolve()


def test_different_instances_have_different_defaults():
    assert ThreadResolver().resolve() != ThreadResolver().resolve()


def test_create_thread_returns_new_uuid(tr):
    tid = tr.create_thread()
    uuid.UUID(tid)  # 合法 UUID


def test_create_thread_differs_from_default(tr):
    assert tr.create_thread() != tr.resolve()


def test_create_thread_each_call_unique(tr):
    t1 = tr.create_thread()
    t2 = tr.create_thread()
    assert t1 != t2
