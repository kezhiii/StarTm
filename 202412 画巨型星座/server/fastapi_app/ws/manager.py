"""
WebSocket 连接管理器

管理多个客户端连接，每个客户端拥有独立的 ClientSession。
替代原有的 WsService，适配 FastAPI 原生 WebSocket。
"""

from __future__ import annotations
import time
from typing import Dict, Callable, Any, Optional
from dataclasses import dataclass, field

from fastapi import WebSocket
from sqlalchemy.ext.asyncio import async_sessionmaker

from ...services.client_session import ClientSession
from ...services.propagation_service import PropagationService


@dataclass
class ManagerStats:
    """管理器统计信息"""
    started_at: float = field(default_factory=time.time)
    total_connections: int = 0
    active_connections: int = 0
    peak_connections: int = 0

    def to_dict(self) -> dict:
        return {
            "started_at": self.started_at,
            "uptime_seconds": time.time() - self.started_at,
            "total_connections": self.total_connections,
            "active_connections": self.active_connections,
            "peak_connections": self.peak_connections,
        }


class ConnectionManager:
    """
    FastAPI WebSocket 连接管理器。

    职责：
    - 管理多个客户端连接
    - 每个客户端拥有独立的 PropagationService
    - 支持最多 MAX_CLIENTS 个并发连接
    - 客户端断开时自动清理资源
    """

    MAX_CLIENTS = 10

    def __init__(
        self,
        propagation_service_factory: Callable[[], PropagationService],
        constellation: Optional[Any] = None,
        protocol_logger: Optional[Any] = None,
    ):
        self._service_factory = propagation_service_factory
        self._constellation = constellation
        self._protocol_logger = protocol_logger
        self._clients: Dict[str, ClientSession] = {}
        self._stats = ManagerStats()

    @property
    def client_count(self) -> int:
        return len(self._clients)

    @property
    def stats(self) -> ManagerStats:
        return self._stats

    def _get_session_factory(self) -> Optional[async_sessionmaker]:
        """
        动态获取共享的 session_factory。
        
        在 connect() 时调用，此时 lifespan 已执行完毕，DB 引擎已初始化。
        """
        try:
            from ...db.session import get_session_factory
            return get_session_factory()
        except RuntimeError:
            return None

    async def connect(self, websocket: WebSocket, client_id: str) -> Optional[ClientSession]:
        """
        接受新连接并创建客户端会话。

        Args:
            websocket: FastAPI WebSocket 对象
            client_id: 客户端唯一标识

        Returns:
            ClientSession 实例，如果超过最大连接数则返回 None
        """
        if self.client_count >= self.MAX_CLIENTS:
            await websocket.close(code=1008, reason="服务器已满")
            return None

        await websocket.accept()
        self._stats.total_connections += 1
        self._stats.active_connections = self.client_count + 1
        if self._stats.active_connections > self._stats.peak_connections:
            self._stats.peak_connections = self._stats.active_connections

        service = self._service_factory()
        # 在连接建立时获取 session_factory（此时 DB 引擎已初始化）
        session_factory = self._get_session_factory()

        # 创建灯光调度器并注入到 PropagationService
        if session_factory:
            try:
                from ...services.light_scheduler import LightScheduler
                scheduler = LightScheduler(
                    session_factory=session_factory,
                    constellation=service.constellation,  # 使用 service 的星座，确保状态同步
                )
                service._light_scheduler = scheduler
            except Exception as e:
                print(f"[WS-Manager] 灯光调度器初始化失败: {e}")

        session = ClientSession(
            websocket=websocket,
            client_id=client_id,
            service=service,
            constellation=service.constellation,  # 使用 service 的星座，确保调度器和前端看到的是同一个对象
            protocol_logger=self._protocol_logger,
            session_factory=session_factory,
        )
        self._clients[client_id] = session

        print(f"[WS-Manager] 客户端 {client_id} 已连接 (当前: {self.client_count})")
        return session

    async def disconnect(self, client_id: str) -> None:
        """
        断开客户端连接并清理资源。

        Args:
            client_id: 客户端唯一标识
        """
        if client_id in self._clients:
            session = self._clients.pop(client_id)
            await session.stop()
            self._stats.active_connections = self.client_count
            print(f"[WS-Manager] 客户端 {client_id} 已断开 (当前: {self.client_count})")

    def get_client(self, client_id: str) -> Optional[ClientSession]:
        """获取指定客户端会话"""
        return self._clients.get(client_id)

    def get_all_client_stats(self) -> list:
        """获取所有客户端的统计信息"""
        return [client.get_stats() for client in self._clients.values()]
