"""
客户端会话管理

每个WebSocket连接拥有独立的计算状态和推送循环。
"""

from __future__ import annotations
import asyncio
import base64
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
        constellation=None,
        protocol_logger=None,
    ):
        self.client_id = client_id
        self.websocket = websocket
        self.service = propagation_service_factory()
        self.push_task: Optional[asyncio.Task] = None
        self.is_active = True
        self.stats = SessionStats()
        self._constellation = constellation
        self._protocol_logger = protocol_logger
        self._frame_counter = 0
        
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
            
            if msg_type == "protocol_frame":
                if "light_commands" in cmd:
                    await self._handle_light_batch_command(cmd)
                else:
                    await self._handle_protocol_frame(cmd)
            elif msg_type == "request_data":
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

    async def _handle_protocol_frame(self, cmd: dict) -> None:
        """处理协议帧消息"""
        from ..protocol import LDPCCodec
        from ..services.protocol_handler import ProtocolHandler
        from ..services.light_control import LightControlService
        from ..services.verify_service import VerifyService
        
        try:
            frame_data = cmd.get("frame")
            use_ldpc = cmd.get("use_ldpc", True)
            
            if not frame_data:
                await self._send_command_response("error", "No frame data provided")
                return
            
            raw_bytes = base64.b64decode(frame_data)
            
            if not hasattr(self, '_protocol_handler'):
                light_service = LightControlService()
                verify_service = VerifyService(num_satellites=light_service._num_satellites)
                self._protocol_handler = ProtocolHandler(
                    light_service, verify_service=verify_service, logger=self._protocol_logger
                )
                self._light_service = light_service
                self._verify_service = verify_service
            
            if use_ldpc:
                result = self._protocol_handler.handle_ldpc_frame(raw_bytes)
            else:
                result = self._protocol_handler.handle_frame(raw_bytes)
            
            if result["success"]:
                await self._send_command_response("light_control_ok", result)
                print(f"[Client {self.client_id}] 灯光控制成功: {result}")
            else:
                await self._send_command_response("light_control_error", result)
                print(f"[Client {self.client_id}] 灯光控制失败: {result}")
                
        except Exception as e:
            print(f"[Client {self.client_id}] 协议帧处理异常: {e}")
            await self._send_command_response("error", str(e))

    async def _handle_light_batch_command(self, cmd: dict) -> None:
        """处理批量灯光控制指令"""
        from ..services.protocol_handler import ProtocolHandler
        from ..services.light_control import LightControlService
        from ..services.verify_service import VerifyService
        from ..services.neighbor_finder import NeighborFinder
        
        try:
            commands = cmd.get("light_commands", [])
            if not commands:
                await self._send_command_response("error", "No light commands provided")
                return
            
            if self._protocol_logger:
                raw_frame = base64.b64encode(b"batch_command").decode('ascii')
                self._protocol_logger.log_sent(raw_frame, commands, client_addr=self.client_id)
            
            if not hasattr(self, '_protocol_handler'):
                light_service = LightControlService()
                verify_service = VerifyService(num_satellites=light_service._num_satellites)
                self._protocol_handler = ProtocolHandler(
                    light_service, verify_service=verify_service, logger=self._protocol_logger
                )
                self._light_service = light_service
                self._verify_service = verify_service
            
            neighbor_map = {}
            if self._constellation:
                try:
                    finder = NeighborFinder(neighbor_count=2)
                    neighbor_map = finder.find_neighbors_from_constellation(
                        self._constellation, neighbor_count=2
                    )
                    self._verify_service.set_neighbor_map(neighbor_map)
                    print(f"[Client {self.client_id}] 邻居拓扑: {neighbor_map}")
                except Exception as e:
                    print(f"[Client {self.client_id}] 邻居计算失败: {e}")
            
            self._frame_counter += 1
            ldpc_bytes = self._protocol_handler.build_light_control_frame(
                commands,
                frame_count=self._frame_counter,
                packet_id=self._frame_counter,
                neighbor_map=neighbor_map,
            )
            
            if self._constellation:
                results = self._constellation.apply_light_control(commands)
                
                for cmd_item in commands:
                    sat_id = cmd_item.get("sat_id", 0)
                    command = cmd_item.get("command", "").lower()
                    if sat_id in neighbor_map:
                        for msg_idx, msg in enumerate(self._protocol_handler._codec._G if hasattr(self._protocol_handler._codec, '_G') else []):
                            pass
                        self._verify_service.store_submessages(
                            sat_id,
                            self._build_submessages_for_sat(sat_id, commands, neighbor_map),
                        )
                
                verify_results = {}
                for cmd_item in commands:
                    sat_id = cmd_item.get("sat_id", 0)
                    neighbors = neighbor_map.get(sat_id, [])
                    if neighbors:
                        verify_results[sat_id] = {
                            "neighbors": neighbors,
                            "status": "skip",
                        }
                
                if self._protocol_logger:
                    self._protocol_logger.log_result(
                        all(r.get("success") for r in results),
                        {"results": results, "neighbors": neighbor_map, "verify": verify_results},
                    )
                
                await self._send_command_response("light_control_ok", {
                    "type": "light_control",
                    "results": results,
                    "neighbor_map": neighbor_map,
                    "verify": verify_results,
                })
                print(f"[Client {self.client_id}] 批量灯光控制成功: {len(results)}颗卫星, 邻居: {neighbor_map}")
            else:
                await self._send_command_response("error", "Constellation not available")
                
        except Exception as e:
            print(f"[Client {self.client_id}] 批量灯光控制异常: {e}")
            if self._protocol_logger:
                self._protocol_logger.log_error("batch_command_error", str(e), self.client_id)
            await self._send_command_response("error", str(e))
    
    def _build_submessages_for_sat(
        self,
        sat_id: int,
        commands: list,
        neighbor_map: dict,
    ) -> list:
        """为指定卫星构建子消息列表（自身+邻星）"""
        from ..protocol import SubMessage
        from ..protocol.constants import LightCommand
        
        messages = []
        msg_counter = 0
        
        for cmd in commands:
            cmd_sat_id = cmd.get("sat_id", 0)
            if cmd_sat_id == sat_id:
                command = cmd.get("command", "").lower()
                if command == "on":
                    data = bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
                elif command == "off":
                    data = bytes([LightCommand.TURN_OFF, LightCommand.STATE_OFF])
                else:
                    continue
                messages.append(SubMessage(
                    msg_id=msg_counter,
                    dest_id=cmd_sat_id,
                    data=data,
                ))
                msg_counter += 1
        
        if sat_id in neighbor_map:
            for neighbor_id in neighbor_map[sat_id]:
                neighbor_cmd = next(
                    (c for c in commands if c.get("sat_id") == neighbor_id),
                    None
                )
                if neighbor_cmd:
                    n_command = neighbor_cmd.get("command", "").lower()
                    if n_command == "on":
                        n_data = bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
                    elif n_command == "off":
                        n_data = bytes([LightCommand.TURN_OFF, LightCommand.STATE_OFF])
                    else:
                        continue
                    messages.append(SubMessage(
                        msg_id=msg_counter,
                        dest_id=neighbor_id,
                        data=n_data,
                    ))
                    msg_counter += 1
        
        return messages

    async def _send_command_response(self, cmd: str, data: Any) -> None:
        """发送命令响应"""
        try:
            message = json.dumps({
                "type": "protocol_response",
                "cmd": cmd,
                "data": data,
            })
            await self.websocket.send(message)
        except Exception as e:
            print(f"[Client {self.client_id}] 发送响应失败: {e}")
            
    def get_stats(self) -> dict:
        """获取会话统计信息"""
        return {
            "client_id": self.client_id,
            **self.stats.to_dict(),
            "service_state": self.service.state.value,
            "buffer_length": self.service.buffer_length,
            "current_step": self.service.current_step,
        }
