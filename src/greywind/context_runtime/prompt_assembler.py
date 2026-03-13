"""Prompt 组装器 — 将角色、记忆、上下文、用户输入拼装为完整 prompt"""

from typing import List, Dict, Any

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
    ) -> List[Dict[str, str]]:
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

        messages = [{"role": "system", "content": system_message}]

        # 最近对话
        for turn in recent_dialogue:
            messages.append({
                "role": turn["role"],
                "content": turn["content"],
            })

        # 当前用户输入
        messages.append({"role": "user", "content": user_input})

        return messages
