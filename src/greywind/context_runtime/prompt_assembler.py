"""Prompt 组装器 — 将角色、记忆、上下文、用户输入拼装为完整 prompt"""

from typing import List, Dict, Any, Optional

from greywind.config.models import CharacterConfig

# 工具使用引导（当有工具可用时注入 system prompt）
_TOOL_GUIDANCE = """【工具使用】
你拥有以下能力，在合适的时候主动使用：
{capabilities}

使用原则：
- 用户问实时信息（天气、新闻、股价等）→ 你没有实时数据，必须用工具去查
- 用户让你操作电脑（打开软件、点击、输入等）→ 用桌面工具执行
- 用户让你上网搜索/打开网页 → 用浏览器工具执行
- 你不确定的事实性问题 → 先用工具查证，再回答
- 闲聊、情绪表达、观点类问题 → 直接回答，不需要工具
- 工具返回结果后，用你自己的风格简短总结给用户，不要原样复述"""


class PromptAssembler:
    def assemble(
        self,
        character: CharacterConfig,
        memory_prompt: str,
        thread_id: str,
        session_id: str,
        recent_dialogue: List[Dict[str, Any]],
        user_input: str,
        screen_image_b64: Optional[str] = None,
        screen_detail: str = "low",
        enabled_tools: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """组装完整的 messages 列表，供 LLM 调用"""
        system_parts = []

        # 角色设定
        if character.persona:
            system_parts.append(character.persona.strip())

        # 工具使用引导（仅当有工具可用时注入）
        if enabled_tools:
            cap_lines = "\n".join(f"- {t}" for t in enabled_tools)
            system_parts.append(
                _TOOL_GUIDANCE.format(capabilities=cap_lines).strip()
            )

        # 记忆注入
        if memory_prompt:
            system_parts.append(memory_prompt)

        # 上下文元信息
        system_parts.append(
            f"[thread: {thread_id}] [session: {session_id}]"
        )

        system_message = "\n\n".join(system_parts)

        messages: List[Dict[str, Any]] = [{"role": "system", "content": system_message}]

        # 最近对话
        for turn in recent_dialogue:
            msg: Dict[str, Any] = {
                "role": turn["role"],
                "content": turn["content"],
            }
            # 恢复 tool_calls（如果有）
            if turn.get("tool_calls"):
                msg["tool_calls"] = turn["tool_calls"]
            messages.append(msg)

        # 当前用户输入（可能附带截图）
        if screen_image_b64:
            messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{screen_image_b64}",
                            "detail": screen_detail,
                        },
                    },
                    {"type": "text", "text": user_input},
                ],
            })
        else:
            messages.append({"role": "user", "content": user_input})

        return messages
