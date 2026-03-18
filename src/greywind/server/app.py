"""FastAPI 应用 — HTTP + WebSocket 入口"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from greywind.server.service_context import ServiceContext, create_service_context
from greywind.server.ws_handler import handle_websocket

_ctx: ServiceContext | None = None


@asynccontextmanager
async def lifespan(application: FastAPI):
    global _ctx
    _ctx = create_service_context()
    logger.info(f"灰风后端启动: {_ctx.config.server.host}:{_ctx.config.server.port}")
    yield


app = FastAPI(title="GreyWind", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    engines = {}
    screen_cfg = {}
    if _ctx:
        engines = {
            "vad": _ctx.vad is not None,
            "asr": _ctx.asr is not None,
            "tts": _ctx.tts is not None,
            "screen_sense": _ctx.config.screen.enabled,
        }
        screen_cfg = {
            "capture_interval": _ctx.config.screen.capture_interval,
            "monitor": _ctx.config.screen.monitor,
        }
    return {
        "status": "ok",
        "character": _ctx.character.name if _ctx else "unknown",
        "engines": engines,
        "screen": screen_cfg,
    }


@app.get("/api/screen-settings")
async def get_screen_settings():
    if not _ctx:
        return {"error": "后端未就绪"}
    cfg = _ctx.config.screen
    return {
        "diff_threshold": cfg.diff_threshold,
        "active_window_filter": cfg.active_window_filter,
        "monitor": cfg.monitor,
        "cooldown": cfg.cooldown,
        "enabled": cfg.enabled,
    }


@app.post("/api/screen-settings")
async def update_screen_settings(body: dict):
    if not _ctx:
        return {"error": "后端未就绪"}
    cfg = _ctx.config.screen

    # ScreenSense 是每连接创建的，这里更新全局配置。
    # enabled 的即时生效通过前端 WebSocket 发送 screen_sense_toggle 消息实现。
    if "diff_threshold" in body:
        cfg.diff_threshold = float(body["diff_threshold"])
    if "active_window_filter" in body:
        cfg.active_window_filter = bool(body["active_window_filter"])
    if "monitor" in body:
        cfg.monitor = str(body["monitor"])
    if "cooldown" in body:
        cfg.cooldown = float(body["cooldown"])
    if "enabled" in body:
        cfg.enabled = bool(body["enabled"])

    return {"ok": True}


@app.get("/api/desktop-settings")
async def get_desktop_settings():
    if not _ctx:
        return {"error": "后端未就绪"}
    cfg = _ctx.config.desktop
    return {"enabled": cfg.enabled}


@app.post("/api/desktop-settings")
async def update_desktop_settings(body: dict):
    if not _ctx:
        return {"error": "后端未就绪"}
    cfg = _ctx.config.desktop
    if "enabled" in body:
        cfg.enabled = bool(body["enabled"])
    return {"ok": True}


# ── 音色管理 API ──

@app.get("/api/voice/list")
async def voice_list():
    """列出当前可用音色（预置 + 自定义）"""
    if not _ctx:
        return {"error": "后端未就绪"}
    try:
        from greywind.engines.tts.voice_manager import VoiceManager
        vm = VoiceManager(api_key=_ctx.config.tts.api_key)
        custom = vm.list()
    except Exception as e:
        logger.error(f"获取音色列表失败: {e}")
        custom = []
    current = _ctx.config.tts.voice or ""
    has_ref = bool(_ctx.config.tts.reference_audio and _ctx.config.tts.reference_text)
    return {
        "current_voice": current,
        "using_reference": has_ref,
        "custom_voices": custom,
    }


@app.post("/api/voice/upload")
async def voice_upload(body: dict):
    """上传参考音频创建自定义音色（base64 方式）"""
    if not _ctx:
        return {"error": "后端未就绪"}
    text = body.get("text", "")
    custom_name = body.get("custom_name", "")
    audio_b64 = body.get("audio_base64", "")
    filename = body.get("filename", "audio.mp3")
    if not text or not custom_name or not audio_b64:
        return {"error": "缺少 text / custom_name / audio_base64 参数"}
    import tempfile, os, base64
    tmp = None
    try:
        from greywind.engines.tts.voice_manager import VoiceManager
        vm = VoiceManager(api_key=_ctx.config.tts.api_key)
        suffix = os.path.splitext(filename)[1] or ".mp3"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.write(base64.b64decode(audio_b64))
        tmp.close()
        uri = vm.upload(tmp.name, text, custom_name, model=_ctx.config.tts.model or "FunAudioLLM/CosyVoice2-0.5B")
        return {"ok": True, "uri": uri, "custom_name": custom_name}
    except Exception as e:
        logger.error(f"音色上传失败: {e}")
        return {"error": str(e)}
    finally:
        if tmp and os.path.exists(tmp.name):
            os.unlink(tmp.name)


@app.post("/api/voice/delete")
async def voice_delete(body: dict):
    """删除自定义音色"""
    if not _ctx:
        return {"error": "后端未就绪"}
    uri = body.get("uri", "")
    if not uri:
        return {"error": "缺少 uri 参数"}
    # 禁止删除当前正在使用的音色
    if uri == _ctx.config.tts.voice:
        return {"error": "不能删除当前正在使用的音色，请先切换到其他音色"}
    try:
        from greywind.engines.tts.voice_manager import VoiceManager
        vm = VoiceManager(api_key=_ctx.config.tts.api_key)
        vm.delete(uri)
        return {"ok": True}
    except Exception as e:
        logger.error(f"音色删除失败: {e}")
        return {"error": str(e)}


@app.post("/api/voice/preview")
async def voice_preview(body: dict):
    """试听指定音色，返回音频 base64（带本地缓存）"""
    if not _ctx:
        return {"error": "后端未就绪"}
    voice = body.get("voice", "")
    if not voice:
        return {"error": "缺少 voice 参数"}
    text = body.get("text", "你好，我是灰风，很高兴认识你。")
    try:
        import asyncio, base64, os, hashlib
        cfg = _ctx.config.tts

        # 缓存：按 voice + text 的 hash 存文件
        cache_dir = os.path.join("cache", "voice_preview")
        os.makedirs(cache_dir, exist_ok=True)
        cache_key = hashlib.md5(f"{voice}:{text}".encode()).hexdigest()
        cache_path = os.path.join(cache_dir, f"{cache_key}.{cfg.response_format}")

        if os.path.exists(cache_path):
            with open(cache_path, "rb") as f:
                audio_b64 = base64.b64encode(f.read()).decode()
            return {"ok": True, "audio_base64": audio_b64, "format": cfg.response_format, "cached": True}

        from greywind.engines.tts.siliconflow_tts import SiliconFlowTTS
        tts = SiliconFlowTTS(
            api_url=cfg.api_url, api_key=cfg.api_key,
            default_model=cfg.model or "FunAudioLLM/CosyVoice2-0.5B", default_voice=voice,
            sample_rate=cfg.sample_rate, response_format=cfg.response_format,
            stream=False, speed=cfg.speed, gain=cfg.gain,
        )
        audio_path = await asyncio.to_thread(tts.generate_audio, text)
        if not audio_path:
            return {"error": "音频生成失败"}
        # 复制到缓存
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        with open(cache_path, "wb") as f:
            f.write(audio_bytes)
        os.unlink(audio_path)
        audio_b64 = base64.b64encode(audio_bytes).decode()
        return {"ok": True, "audio_base64": audio_b64, "format": cfg.response_format, "cached": False}
    except Exception as e:
        logger.error(f"音色试听失败: {e}")
        return {"error": str(e)}


@app.post("/api/voice/switch")
async def voice_switch(body: dict):
    """切换当前使用的音色（热切换，不需要重启）"""
    if not _ctx:
        return {"error": "后端未就绪"}
    voice = body.get("voice", "")
    if not voice:
        return {"error": "缺少 voice 参数"}
    try:
        from greywind.engines.tts.siliconflow_tts import SiliconFlowTTS
        tts = _ctx.tts
        if isinstance(tts, SiliconFlowTTS):
            tts.default_voice = voice
            # 切换到预置/自定义音色时，清除 references 模式
            tts._reference_b64 = None
            tts.reference_text = None
            _ctx.config.tts.voice = voice
            logger.info(f"音色已切换: {voice}")
            return {"ok": True, "voice": voice}
        return {"error": "当前 TTS 引擎不支持音色切换"}
    except Exception as e:
        logger.error(f"音色切换失败: {e}")
        return {"error": str(e)}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    if not _ctx:
        await ws.accept()
        await ws.close(code=1011, reason="后端未就绪")
        return
    await handle_websocket(ws, _ctx)
