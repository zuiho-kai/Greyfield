"""硅基流动音色管理 — 上传参考音频、列出/删除自定义音色"""

from pathlib import Path

import requests
from loguru import logger

_API_BASE = "https://api.siliconflow.cn/v1"


class VoiceManager:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self._headers = {"Authorization": f"Bearer {api_key}"}

    def upload(
        self, audio_path: str, text: str, custom_name: str,
        model: str = "FunAudioLLM/CosyVoice2-0.5B",
    ) -> str:
        """上传参考音频创建自定义音色，返回 voice URI"""
        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(f"参考音频不存在: {audio_path}")

        with open(path, "rb") as f:
            files = {"file": (path.name, f)}
            data = {"model": model, "customName": custom_name, "text": text}
            resp = requests.post(
                f"{_API_BASE}/uploads/audio/voice",
                headers=self._headers, data=data, files=files,
            )
        resp.raise_for_status()
        uri = resp.json().get("uri", "")
        logger.info(f"音色上传成功: {custom_name} → {uri}")
        return uri

    def list(self) -> list[dict]:
        """列出当前账号下所有自定义音色"""
        resp = requests.get(
            f"{_API_BASE}/audio/voice/list", headers=self._headers,
        )
        resp.raise_for_status()
        return resp.json().get("result", [])

    def delete(self, uri: str) -> bool:
        """删除指定音色"""
        resp = requests.post(
            f"{_API_BASE}/audio/voice/deletions",
            headers={**self._headers, "Content-Type": "application/json"},
            json={"uri": uri},
        )
        resp.raise_for_status()
        logger.info(f"音色已删除: {uri}")
        return True
