"""
WebSocket 服务 - 多客户端版本

每个客户端拥有独立的计算会话和推送循环。
"""

from __future__ import annotations
import asyncio
import json
import time
from typing import Dict, Callable, Any, Optional
from dataclasses import dataclass, field

try:
    import websockets
    from websockets.server import WebSocketServerProtocol
except ImportError:
    websockets = None
    WebSocketServerProtocol = Any

from ..services.propagation_service import PropagationService
from .client_session import ClientSession


@dataclass
class ServerStats:
    """服务器统计信息"""
    started_at: float = field(default_factory=time.time)
    total_connections: int = 0
    active_connections: int = 0
    peak_connections: int = 0
    
    def to_dict(self) -> dict:
        """转换为字典格式"""
        return {
            "started_at": self.started_at,
            "uptime_seconds": time.time() - self.started_at,
            "total_connections": self.total_connections,
            "active_connections": self.active_connections,
            "peak_connections": self.peak_connections,
        }


class WsService:
    """
    WebSocket服务（多客户端版本）。
    
    职责：
    - 管理多个客户端连接
    - 每个客户端拥有独立的 PropagationService
    - 支持最多 MAX_CLIENTS 个并发连接
    - 客户端断开时自动清理资源
    """
    
    MAX_CLIENTS = 10  # 最大客户端数
    
    def __init__(
        self,
        propagation_service_factory: Callable[[], PropagationService],
        host: str = "0.0.0.0",
        port: int = 8765,
        constellation=None,
        protocol_logger=None,
    ):
        self._service_factory = propagation_service_factory
        self._host = host
        self._port = port
        self._clients: Dict[str, ClientSession] = {}
        self._is_running = False
        self._server = None
        self._stats = ServerStats()
        self._constellation = constellation
        self._protocol_logger = protocol_logger
        
    @property
    def is_running(self) -> bool:
        """服务是否正在运行"""
        return self._is_running
        
    @property
    def client_count(self) -> int:
        """当前活跃客户端数"""
        return len(self._clients)
        
    @property
    def stats(self) -> ServerStats:
        """获取服务器统计信息"""
        return self._stats
        
    def get_all_client_stats(self) -> list:
        """获取所有客户端的统计信息"""
        return [client.get_stats() for client in self._clients.values()]
        
    async def start(self) -> None:
        """启动WebSocket服务"""
        if websockets is None:
            raise ImportError("websockets 包未安装，请运行: pip install websockets")
            
        if self._is_running:
            print("[WS] 服务已在运行中")
            return
        
        # 关键修复：创建闭包包装器，适配 websockets 库的 handler 签名
        # 兼容 websockets v11.0+，path 参数变为可选
        async def handler(websocket, path=None):
            return await self._handle_client(websocket, path)
            
        self._server = await websockets.serve(
            handler,
            self._host,
            self._port,
            ping_interval=20,
            ping_timeout=10,
        )
        
        self._is_running = True
        self._stats.started_at = time.time()
        
        print("=" * 60)
        print(f"[WS] WebSocket 服务已启动")
        print(f"[WS] 地址: ws://{self._host}:{self._port}")
        print(f"[WS] 最大客户端数: {self.MAX_CLIENTS}")
        print("=" * 60)
        
        # 启动监控任务
        asyncio.create_task(self._monitor_task())
        
    async def stop(self) -> None:
        """停止服务并清理所有客户端"""
        if not self._is_running:
            return
            
        print("[WS] 正在停止服务...")
        
        # 停止所有客户端会话
        for client_id, client in list(self._clients.items()):
            print(f"[WS] 停止客户端 {client_id}")
            await client.stop()
            
        self._clients.clear()
        
        if self._server:
            self._server.close()
            await self._server.wait_closed()
            
        self._is_running = False
        print("[WS] 服务已完全停止")
        
    async def _handle_client(self, websocket: WebSocketServerProtocol, path: str) -> None:
        """处理客户端连接"""
        client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}_{id(websocket)}"
        
        # 检查是否达到最大客户端数
        if len(self._clients) >= self.MAX_CLIENTS:
            print(f"[WS] 客户端 {client_id} 连接被拒绝：服务器已满 ({len(self._clients)}/{self.MAX_CLIENTS})")
            await websocket.send(json.dumps({
                "type": "error",
                "message": "服务器已达到最大客户端数限制，请稍后重试",
            }))
            await websocket.close(1008, "Server full")
            return
            
        print(f"[WS] 客户端连接: {client_id} ({len(self._clients) + 1}/{self.MAX_CLIENTS})")
        
        # 更新统计
        self._stats.total_connections += 1
        self._stats.active_connections = len(self._clients) + 1
        self._stats.peak_connections = max(
            self._stats.peak_connections, 
            self._stats.active_connections
        )
        
        # 创建新会话
        session = ClientSession(
            client_id=client_id,
            websocket=websocket,
            propagation_service_factory=self._service_factory,
            constellation=self._constellation,
            protocol_logger=self._protocol_logger,
        )
        self._clients[client_id] = session
        
        try:
            await session.start()
            
            # 关键修复：使用 wait_closed() 可靠检测连接关闭
            # 无论是客户端主动断开、网络异常还是浏览器关闭，都能正确检测
            try:
                await websocket.wait_closed()
                print(f"[WS] 客户端 {client_id} 连接已关闭（wait_closed）")
            except Exception as e:
                print(f"[WS] 客户端 {client_id} wait_closed 异常: {e}")
                
        except Exception as e:
            print(f"[WS] 客户端 {client_id} 处理异常: {e}")
        finally:
            # 关键修复：确保会话停止（无论什么原因断开）
            print(f"[WS] 客户端 {client_id} 进入清理阶段...")
            
            # 标记会话为不活跃
            session.is_active = False
            
            # 停止会话（清理资源）
            try:
                await session.stop()
                print(f"[WS] 客户端 {client_id} 会话已停止")
            except Exception as e:
                print(f"[WS] 客户端 {client_id} 停止会话时出错: {e}")
            
            # 从客户端字典中移除
            if client_id in self._clients:
                del self._clients[client_id]
                print(f"[WS] 客户端 {client_id} 已从字典移除")
            
            # 更新统计
            self._stats.active_connections = len(self._clients)
            print(f"[WS] 客户端 {client_id} 清理完成，当前: {len(self._clients)}/{self.MAX_CLIENTS}")
            
    async def _monitor_task(self) -> None:
        """监控任务：定期打印统计信息"""
        while self._is_running:
            try:
                await asyncio.sleep(30)  # 每30秒打印一次
                
                if not self._is_running:
                    break
                    
                print("\n" + "=" * 60)
                print("[WS] 服务器状态报告")
                print("=" * 60)
                
                server_stats = self._stats.to_dict()
                print(f"运行时间: {server_stats['uptime_seconds']:.0f}秒")
                print(f"总连接数: {server_stats['total_connections']}")
                print(f"当前连接: {server_stats['active_connections']}/{self.MAX_CLIENTS}")
                print(f"峰值连接: {server_stats['peak_connections']}")
                
                if self._clients:
                    print(f"\n客户端详情 ({len(self._clients)}个):")
                    for client_id, client in self._clients.items():
                        stats = client.get_stats()
                        duration = time.time() - stats['connected_at']
                        print(f"  {client_id}:")
                        print(f"    时长: {duration:.0f}秒")
                        print(f"    发送帧数: {stats['frames_sent']}")
                        print(f"    计算帧数: {stats['frames_computed']}")
                        print(f"    当前step: {stats['current_step']}")
                        print(f"    缓冲区: {stats['buffer_length']}帧")
                        
                print("=" * 60 + "\n")
                
            except Exception as e:
                print(f"[WS] 监控任务异常: {e}")
                await asyncio.sleep(5)
                
    def __repr__(self) -> str:
        return (
            f"WsService(host={self._host}:{self._port}, "
            f"clients={len(self._clients)}/{self.MAX_CLIENTS}, "
            f"running={self._is_running})"
        )
