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
    ss = _ctx.screen_sense

    if "diff_threshold" in body:
        val = float(body["diff_threshold"])
        cfg.diff_threshold = val
        if ss:
            ss._diff_threshold = val

    if "active_window_filter" in body:
        val = bool(body["active_window_filter"])
        cfg.active_window_filter = val
        if ss:
            ss._active_window_filter = val

    if "monitor" in body:
        cfg.monitor = str(body["monitor"])

    if "cooldown" in body:
        val = float(body["cooldown"])
        cfg.cooldown = val
        if ss:
            ss._cooldown = val

    if "enabled" in body:
        val = bool(body["enabled"])
        cfg.enabled = val
        if ss:
            ss.enabled = val

    # 注意：enabled 的实际生效需要重新连接 WebSocket，
    # 因为 ScreenSense 是每连接创建的，这里只更新配置供下次连接使用

    return {"ok": True}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    if not _ctx:
        await ws.accept()
        await ws.close(code=1011, reason="后端未就绪")
        return
    await handle_websocket(ws, _ctx)
