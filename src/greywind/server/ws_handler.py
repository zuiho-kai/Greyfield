"""WebSocket 消息处理器 — 按协议路由消息到 Voice Pipeline"""

import asyncio
import json
import base64
import struct

import numpy as np
from loguru import logger
from fastapi import WebSocket, WebSocketDisconnect

from greywind.persona.voice_pipeline import VoicePipeline
from greywind.persona.screen_sense import ScreenSense
from greywind.server.service_context import ServiceContext


async def handle_websocket(ws: WebSocket, ctx: ServiceContext):
    await ws.accept()
    # 每连接独立创建 ScreenSense，避免跨连接共享脏状态
    screen_sense = None
    cfg = ctx.config.screen
    if cfg.enabled:
        try:
            screen_sense = ScreenSense(
                buffer_size=cfg.buffer_size,
                trigger_frames=cfg.trigger_frames,
                diff_threshold=cfg.diff_threshold,
                cooldown=cfg.cooldown,
                active_window_filter=cfg.active_window_filter,
            )
        except Exception as e:
            logger.warning(f"ScreenSense 创建失败: {e}")
    pipeline = VoicePipeline(ctx, screen_sense=screen_sense)
    logger.info("WebSocket 连接已建立（独立 pipeline）")
    chunk_count = 0
    proactive_task = None

    # 如果屏幕感知已启用，启动主动说话循环
    if pipeline.screen_sense and pipeline.screen_sense.enabled:
        async def send_msg_safe(msg: dict):
            try:
                await ws.send_json(msg)
            except Exception:
                pass

        async def send_audio_safe(audio_bytes: bytes, payload: dict):
            try:
                await ws.send_json({"type": "reply_audio_meta", "payload": payload})
                await ws.send_bytes(audio_bytes)
            except Exception:
                pass

        proactive_task = asyncio.create_task(
            pipeline.proactive_loop(send_msg_safe, send_audio_safe)
        )

    async def send_msg(msg: dict):
        await ws.send_json(msg)

    async def send_audio(audio_bytes: bytes, payload: dict):
        await ws.send_json({"type": "reply_audio_meta", "payload": payload})
        await ws.send_bytes(audio_bytes)

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError as e:
                await send_msg({"type": "error", "payload": {"message": f"消息格式错误: {e}"}})
                continue
            msg_type = msg.get("type", "")
            payload = msg.get("payload", {})

            if msg_type == "text_input":
                text = payload.get("text", "").strip()
                if text:
                    await pipeline.handle_text(text, send_msg, send_audio)

            elif msg_type == "audio_chunk":
                audio_b64 = payload.get("audio_base64", "")
                if audio_b64:
                    try:
                        audio_bytes = base64.b64decode(audio_b64)
                    except Exception:
                        await send_msg({"type": "error", "payload": {"message": "音频数据解码失败"}})
                        continue
                    audio_floats = _pcm16_to_floats(audio_bytes)
                    chunk_count += 1
                    if chunk_count % 50 == 1:
                        rms = np.sqrt(np.mean(np.array(audio_floats) ** 2))
                        logger.debug(f"audio_chunk #{chunk_count}, samples={len(audio_floats)}, rms={rms:.4f}")
                    await pipeline.feed_audio(audio_floats, send_msg, send_audio)

            elif msg_type == "screen_capture":
                image_b64 = payload.get("image_base64", "")
                window_title = payload.get("window_title", "")
                if image_b64 and pipeline.screen_sense:
                    pipeline.screen_sense.receive_frame(image_b64, window_title)

            elif msg_type == "interrupt":
                await pipeline.interrupt()

            else:
                logger.warning(f"未知消息类型: {msg_type}")

    except WebSocketDisconnect:
        logger.info("WebSocket 连接断开")
        if proactive_task:
            proactive_task.cancel()
        try:
            await pipeline.interrupt()
        except Exception as e:
            logger.debug(f"disconnect cleanup error: {e}")
    except Exception as e:
        logger.error(f"WebSocket 错误: {e}")
        if proactive_task:
            proactive_task.cancel()


def _pcm16_to_floats(data: bytes) -> list[float]:
    """PCM 16-bit LE bytes -> float list [-1, 1]"""
    samples = np.frombuffer(data, dtype=np.int16)
    return (samples.astype(np.float32) / 32768.0).tolist()
