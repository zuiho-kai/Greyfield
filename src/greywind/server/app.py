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
    if _ctx:
        engines = {
            "vad": _ctx.vad is not None,
            "asr": _ctx.asr is not None,
            "tts": _ctx.tts is not None,
        }
    return {
        "status": "ok",
        "character": _ctx.character.name if _ctx else "unknown",
        "engines": engines,
    }


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    if not _ctx:
        await ws.accept()
        await ws.close(code=1011, reason="后端未就绪")
        return
    await handle_websocket(ws, _ctx)
