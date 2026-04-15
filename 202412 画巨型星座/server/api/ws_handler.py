"""
WebSocket 连接处理器

提供 WebSocket 连接管理和数据推送。
"""

from __future__ import annotations
import asyncio
import json
import time
from typing import Optional

from ..services.ws_service import WsService


class WsConnectionHandler:
    """
    WebSocket 连接处理器。

    职责：
    - 管理 WebSocket 服务器
    - 处理客户端连接生命周期
    - 协调 WsService 进行数据推送
    """

    def __init__(self, ws_service: WsService):
        """
        创建 WebSocket 连接处理器。

        Args:
            ws_service: WebSocket 推送服务
        """
        self._ws_service = ws_service

    async def handle(self, websocket) -> None:
        """
        处理单个 WebSocket 连接。

        Args:
            websocket: WebSocket 连接对象
        """
        await self._ws_service.handle_client(websocket)

    async def run_server(self) -> None:
        """
        运行 WebSocket 服务器。

        此方法会阻塞直到服务器停止。
        """
        import websockets

        print(f"[WS] WebSocket 服务器启动: ws://{self._ws_service.host}:{self._ws_service.port}")

        async with websockets.serve(
            self.handle,
            self._ws_service.host,
            self._ws_service.port,
        ):
            await asyncio.Future()

    def __repr__(self) -> str:
        return f"WsConnectionHandler(service={self._ws_service})"
