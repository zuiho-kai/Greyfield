"""Prompt 组装器 — 将角色、记忆、上下文、用户输入拼装为完整 prompt"""

from typing import List, Dict, Any, Optional

from greywind.config.models import CharacterConfig


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
    ) -> List[Dict[str, Any]]:
        """组装完整的 messages 列表，供 LLM 调用"""
        system_parts = []

        # 角色设定
        if character.persona:
            system_parts.append(character.persona.strip())

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
            messages.append({
                "role": turn["role"],
                "content": turn["content"],
            })

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
