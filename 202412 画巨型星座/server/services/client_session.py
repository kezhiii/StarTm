"""
客户端会话管理

每个WebSocket连接拥有独立的计算状态和推送循环。
"""

from __future__ import annotations
import asyncio
import json
import time
from typing import Optional, Callable, Any, List
from dataclasses import dataclass, field

from ..services.propagation_service import PropagationService
from ..core.frame_data import FrameData


@dataclass
class SessionStats:
    """会话统计信息"""
    connected_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    frames_sent: int = 0
    frames_computed: int = 0
    requests_received: int = 0
    
    def to_dict(self) -> dict:
        """转换为字典格式"""
        return {
            "connected_at": self.connected_at,
            "last_activity": self.last_activity,
            "frames_sent": self.frames_sent,
            "frames_computed": self.frames_computed,
            "requests_received": self.requests_received,
            "duration_seconds": time.time() - self.connected_at,
        }


class ClientSession:
    """
    客户端会话。
    
    每个会话拥有独立的：
    - PropagationService（计算状态）
    - 推送循环任务
    - 统计信息
    """
    
    def __init__(
        self,
        client_id: str,
        websocket: Any,
        propagation_service_factory: Callable[[], PropagationService],
    ):
        self.client_id = client_id
        self.websocket = websocket
        self.service = propagation_service_factory()
        self.push_task: Optional[asyncio.Task] = None
        self.is_active = True
        self.stats = SessionStats()
        
    async def start(self) -> None:
        """启动会话"""
        print(f"[Client {self.client_id}] 启动会话")
        
        if self.service.state.value != "running":
            self.service.start()
            
        self.push_task = asyncio.create_task(self._push_loop())
        
    async def stop(self) -> None:
        """停止会话并清理资源"""
        print(f"[Client {self.client_id}] 停止会话，统计: {self.stats.to_dict()}")
        self.is_active = False
        
        if self.push_task:
            self.push_task.cancel()
            try:
                await self.push_task
            except asyncio.CancelledError:
                pass
                
        self.service.stop()
        
    async def _push_loop(self) -> None:
        """独立推送循环"""
        try:
            # 初始发送10帧
            print(f"[Client {self.client_id}] 计算初始10帧...")
            for i in range(10):
                while self.service.buffer_length >= self.service._buffer.capacity:
                    await asyncio.sleep(0.01)
                if not self.service.compute_step(dt=1.0):
                    print(f"[Client {self.client_id}] 初始计算失败")
                    return
                self.stats.frames_computed += 1
            
            initial_frames = self.service.get_and_pop(10)
            await self._send_data(initial_frames, is_first=True)
            self.stats.frames_sent += len(initial_frames)
            print(f"[Client {self.client_id}] 初始发送完成: {len(initial_frames)}帧")
            
            # 进入请求-响应模式
            # 关键修复：移除60秒超时检测，依赖WebSocket原生ping/pong机制
            # 前端后台10秒后自动发送pause，连接保持不断开
            
            while self.is_active and self.service.state.value != "stopped":
                try:
                    msg = await asyncio.wait_for(
                        self.websocket.recv(), 
                        timeout=0.1
                    )
                    self.stats.last_activity = time.time()
                    await self._handle_message(msg)
                    
                except asyncio.TimeoutError:
                    # 无消息，继续循环
                    pass
                except Exception as e:
                    if "ConnectionClosed" in str(type(e).__name__):
                        print(f"[Client {self.client_id}] 连接已关闭")
                        break
                    print(f"[Client {self.client_id}] 处理消息时出错: {e}")
                    
        except asyncio.CancelledError:
            print(f"[Client {self.client_id}] 推送循环被取消")
        except Exception as e:
            print(f"[Client {self.client_id}] 推送循环异常: {e}")
            
    async def _handle_message(self, msg: str) -> None:
        """处理客户端消息"""
        try:
            cmd = json.loads(msg)
            msg_type = cmd.get("type")
            
            if msg_type == "request_data":
                await self._handle_request_data(cmd)
            elif msg_type == "pause":
                self.service.pause()
                await self._send_command("paused")
                print(f"[Client {self.client_id}] 收到暂停指令")
            elif msg_type == "resume":
                self.service.resume()
                await self._send_command("resumed")
                print(f"[Client {self.client_id}] 收到恢复指令")
            elif msg_type == "reset":
                self.service.reset()
                print(f"[Client {self.client_id}] 收到重置指令")
            elif msg_type == "command":
                # 处理传统命令格式
                command = cmd.get("cmd")
                if command == "pause":
                    self.service.pause()
                    await self._send_command("paused")
                elif command == "resume":
                    self.service.resume()
                    await self._send_command("resumed")
                elif command == "reset":
                    self.service.reset()
                    print(f"[Client {self.client_id}] 收到重置指令")
                    
        except json.JSONDecodeError:
            print(f"[Client {self.client_id}] JSON解析错误: {msg[:100]}")
        except Exception as e:
            print(f"[Client {self.client_id}] 处理消息异常: {e}")
            
    async def _handle_request_data(self, cmd: dict) -> None:
        """处理数据请求"""
        request_count = min(cmd.get("request_count", 30), 30)
        self.stats.requests_received += 1
        
        # 按需计算
        computed = 0
        for i in range(request_count):
            if not self.service.compute_step(dt=1.0):
                break
            computed += 1
            self.stats.frames_computed += 1
            
            # 每10帧打印一次进度
            if computed % 10 == 0:
                print(f"[Client {self.client_id}] 计算进度: {computed}/{request_count}帧, step={self.service.current_step}")
        
        # 发送计算好的帧
        frames = self.service.get_and_pop(computed)
        if frames:
            await self._send_data(frames)
            self.stats.frames_sent += len(frames)
            
    async def _send_data(self, frames: List[FrameData], is_first: bool = False) -> None:
        """发送数据到客户端"""
        try:
            data_list = []
            for frame in frames:
                compact = frame.to_compact()
                data_list.append([row.tolist() if hasattr(row, 'tolist') else list(row) for row in compact])
            
            message = json.dumps({
                "type": "data",
                "data": data_list,
                "is_first": is_first,
            })
            
            await self.websocket.send(message)
            self.stats.last_activity = time.time()
            
        except Exception as e:
            print(f"[Client {self.client_id}] 发送数据失败: {e}")
            raise
            
    async def _send_command(self, cmd: str) -> None:
        """发送命令回复"""
        try:
            message = json.dumps({
                "type": "command",
                "cmd": cmd,
            })
            await self.websocket.send(message)
            self.stats.last_activity = time.time()
        except Exception as e:
            print(f"[Client {self.client_id}] 发送命令失败: {e}")
            
    def get_stats(self) -> dict:
        """获取会话统计信息"""
        return {
            "client_id": self.client_id,
            **self.stats.to_dict(),
            "service_state": self.service.state.value,
            "buffer_length": self.service.buffer_length,
            "current_step": self.service.current_step,
        }
