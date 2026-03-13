"""灰风启动入口"""

import uvicorn
from loguru import logger

from greywind.config.loader import load_config


def main():
    config = load_config()
    host = config.server.host
    port = config.server.port
    logger.info(f"启动灰风后端: {host}:{port}")
    uvicorn.run(
        "greywind.server.app:app",
        host=host,
        port=port,
        reload=False,
    )


if __name__ == "__main__":
    main()
