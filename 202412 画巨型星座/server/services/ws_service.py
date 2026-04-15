"""
WebSocket 推送服务

管理 WebSocket 连接、数据推送、客户端命令处理。
"""

from __future__ import annotations
import asyncio
import json
import time
from typing import Optional, Callable, Awaitable, Dict, Any, Set
from dataclasses import dataclass, field

from ..services.propagation_service import PropagationService
from ..core.frame_data import FrameData


@dataclass
class ClientInfo:
    """客户端连接信息"""
    websocket: Any  # websockets.WebSocketServerProtocol
    connected_at: float = 0.0
    last_activity: float = 0.0
    is_active: bool = True


class WsService:
    """
    WebSocket 推送服务。

    职责：
    - 管理客户端连接
    - 推送轨道递推数据
    - 处理客户端控制命令（pause/resume/stop）
    - 管理推送周期和节奏
    """

    def __init__(
        self,
        propagation_service: PropagationService,
        host: str = "0.0.0.0",
        port: int = 8765,
        initial_push_seconds: int = 5,
        compute_interval: int = 10,
        push_interval: int = 10,
    ):
        """
        创建 WebSocket 服务。

        Args:
            propagation_service: 轨道递推服务
            host: 监听地址
            port: 监听端口
            initial_push_seconds: 首次推送数据秒数
            compute_interval: 每次计算的步数
            push_interval: 推送周期（秒）
        """
        self._propagation_service = propagation_service
        self._host = host
        self._port = port
        self._initial_push_seconds = initial_push_seconds
        self._compute_interval = compute_interval
        self._push_interval = push_interval
        self._clients: Dict[str, ClientInfo] = {}
        self._is_running = False

    @property
    def propagation_service(self) -> PropagationService:
        return self._propagation_service

    @property
    def host(self) -> str:
        return self._host

    @property
    def port(self) -> int:
        return self._port

    @property
    def client_count(self) -> int:
        return len(self._clients)

    @property
    def is_running(self) -> bool:
        return self._is_running

    async def handle_client(self, websocket) -> None:
        """
        处理单个客户端连接。

        Args:
            websocket: WebSocket 连接对象
        """
        client_id = str(id(websocket))
        client = ClientInfo(
            websocket=websocket,
            connected_at=time.time(),
            last_activity=time.time(),
        )
        self._clients[client_id] = client

        print(f"[WS] 客户端连接: {websocket.remote_address} (ID: {client_id})")

        try:
            await self._run_push_loop(client)
        except Exception as e:
            print(f"[WS] 客户端 {client_id} 错误: {e}")
        finally:
            self._remove_client(client_id)
            print(f"[WS] 客户端 {client_id} 断开连接")

    async def _run_push_loop(self, client: ClientInfo) -> None:
        """
        运行数据推送循环。

        Args:
            client: 客户端信息
        """
        service = self._propagation_service
        
        # 处理各种状态，确保能进入 RUNNING
        if service.state.value == "stopped":
            service.reset()  # STOPPED → IDLE → READY
        elif service.state.value == "paused":
            service.resume()  # PAUSED → RUNNING，直接进入推送循环
        elif service.state.value == "running":
            # 前一个客户端可能还没完全断开，等待其释放
            print("[WS] 等待前一个客户端断开...")
            while service.state.value == "running":
                await asyncio.sleep(0.1)
            service.reset()  # 确保状态正确
        
        service.start()

        try:
            # 快速首帧：预计算 initial_push_seconds 秒
            print(f"[WS] 预计算 {self._initial_push_seconds} 秒数据...")
            for _ in range(self._initial_push_seconds):
                while service.buffer_length >= service._buffer.capacity:
                    await asyncio.sleep(0.1)
                service.compute_step(dt=1.0)
            print("[WS] 预计算完成，开始推送")

            # 首次推送
            frames = service.get_and_pop(self._initial_push_seconds)
            await self._send_data(client, frames, is_first=True)
            print(f"[WS] 已推送首帧 {len(frames)} 秒数据")

            # 后续推送循环
            while service.is_running:
                cycle_start = time.time()

                # 计算 compute_interval 步
                for _ in range(self._compute_interval):
                    while service.buffer_length >= service._buffer.capacity:
                        await asyncio.sleep(0.1)
                    if not service.is_running:
                        break
                    service.compute_step(dt=1.0)

                if not service.is_running:
                    break

                # 推送新计算的数据
                frames = service.get_and_pop(self._compute_interval)
                if frames:
                    await self._send_data(client, frames, is_first=False)

                # 等待到推送周期结束
                elapsed = time.time() - cycle_start
                if elapsed < self._push_interval:
                    await asyncio.sleep(self._push_interval - elapsed)

                # 接收控制指令（非阻塞）
                await self._handle_commands(client)

                # 如果暂停，等待
                while service.is_paused and service.is_running:
                    await asyncio.sleep(0.1)
                    await self._handle_commands(client)

        finally:
            service.stop()
            print("[WS] 计算引擎已停止")

    async def _send_data(self, client: ClientInfo, frames: list, is_first: bool = False) -> None:
        """
        发送帧数据到客户端。

        Args:
            client: 客户端信息
            frames: FrameData 列表
            is_first: 是否为首帧
        """
        data_list = []
        for frame in frames:
            compact = frame.to_compact()
            data_list.append([row.tolist() if hasattr(row, 'tolist') else list(row) for row in compact])

        message = json.dumps({
            "type": "data",
            "data": data_list,
            "is_first": is_first,
        })

        await client.websocket.send(message)
        client.last_activity = time.time()

    async def _handle_commands(self, client: ClientInfo) -> None:
        """
        处理客户端控制命令。

        Args:
            client: 客户端信息
        """
        try:
            msg = await asyncio.wait_for(client.websocket.recv(), timeout=0.01)
            cmd = json.loads(msg)

            if cmd.get("type") == "command":
                command = cmd.get("cmd")
                service = self._propagation_service

                if command == "stop":
                    service.pause()
                    print(f"[WS] 客户端 {id(client)} 收到停止指令")
                elif command == "pause":
                    service.pause()
                    print(f"[WS] 客户端 {id(client)} 收到暂停指令")
                elif command == "resume":
                    service.resume()
                    print(f"[WS] 客户端 {id(client)} 收到恢复指令")
                elif command == "reset":
                    service.reset()
                    print(f"[WS] 客户端 {id(client)} 收到重置指令")

        except asyncio.TimeoutError:
            pass
        except Exception as e:
            if "ConnectionClosed" in str(type(e).__name__):
                raise
            print(f"[WS] 命令处理错误: {e}")

    def _remove_client(self, client_id: str) -> None:
        """移除客户端"""
        self._clients.pop(client_id, None)

    def warmup_jit(self) -> None:
        """预热 JIT 编译器"""
        self._propagation_service.warmup_jit()

    def __repr__(self) -> str:
        return (
            f"WsService(host={self._host}:{self._port}, "
            f"clients={self.client_count}, "
            f"running={self._is_running})"
        )
