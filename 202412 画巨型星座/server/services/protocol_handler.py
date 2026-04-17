"""
协议消息处理器

负责解析接收到的协议帧，路由到相应的处理服务。
"""

from __future__ import annotations
from typing import Dict, Any, Optional

from ..protocol import TransferFrame, SubMessage, LDPCCodec
from ..protocol.constants import PacketType, MsgType, LightCommand
from .light_control import LightControlService
from .verify_service import VerifyService


class ProtocolHandler:
    """
    协议消息处理器
    
    处理流程:
    1. 接收LDPC编码数据或原始帧数据
    2. LDPC解码（如需要）
    3. TransferFrame解析
    4. CRC校验
    5. 根据Packet_Type路由到相应服务
    6. 处理SubMessage
    7. 返回处理结果
    """
    
    def __init__(self, light_service: LightControlService, verify_service: Optional[VerifyService] = None, logger=None):
        """
        初始化协议处理器
        
        Args:
            light_service: 灯光控制服务实例
            verify_service: 互校验服务实例（可选）
            logger: ProtocolLogger实例（可选）
        """
        self.light_service = light_service
        self.verify_service = verify_service
        self._codec = LDPCCodec()
        self._logger = logger
    
    def handle_frame(self, frame_bytes: bytes) -> Dict[str, Any]:
        """
        处理原始帧数据
        
        Args:
            frame_bytes: 完整的传输帧字节（未LDPC编码）
            
        Returns:
            处理结果字典 {"success": bool, "type": str, ...}
        """
        try:
            frame = TransferFrame.from_bytes(frame_bytes)
            return self._process_frame(frame)
        except ValueError as e:
            print(f"[ProtocolHandler] 帧解析失败: {e}")
            return {"success": False, "error": f"Frame parse error: {e}"}
        except Exception as e:
            print(f"[ProtocolHandler] 帧处理异常: {e}")
            return {"success": False, "error": f"Frame processing error: {e}"}
    
    def handle_ldpc_frame(self, ldpc_data: bytes, codec: Optional[LDPCCodec] = None) -> Dict[str, Any]:
        """
        处理LDPC编码的帧数据
        
        Args:
            ldpc_data: LDPC编码的字节数据
            codec: LDPC编解码器（可选）
            
        Returns:
            处理结果字典
        """
        try:
            if codec is None:
                codec = self._codec
            
            frame = TransferFrame.from_ldpc_bytes(ldpc_data, codec)
            return self._process_frame(frame)
        except ValueError as e:
            print(f"[ProtocolHandler] LDPC帧处理失败: {e}")
            return {"success": False, "error": f"LDPC frame error: {e}"}
        except Exception as e:
            print(f"[ProtocolHandler] LDPC帧处理异常: {e}")
            return {"success": False, "error": f"LDPC frame exception: {e}"}
    
    def _process_frame(self, frame: TransferFrame) -> Dict[str, Any]:
        """
        处理已解析的传输帧
        
        Args:
            frame: 已解析的TransferFrame对象
            
        Returns:
            处理结果字典
        """
        packet_type = frame.packet_type
        
        if packet_type == PacketType.LIGHT_CONTROL:
            return self._handle_light_control(frame)
        elif packet_type == PacketType.VERIFY_REQUEST:
            return self._handle_verify_request(frame)
        elif packet_type == PacketType.VERIFY_RESPONSE:
            return self._handle_verify_response(frame)
        elif packet_type == PacketType.TELEMETRY:
            return self._handle_telemetry(frame)
        elif packet_type == PacketType.STATUS_REPORT:
            return self._handle_status_report(frame)
        else:
            return {
                "success": False,
                "error": f"Unknown packet type: 0x{packet_type:02X}",
                "frame": {
                    "scid": frame.scid,
                    "frame_count": frame.frame_count,
                    "packet_type": packet_type,
                }
            }
    
    def _handle_light_control(self, frame: TransferFrame) -> Dict[str, Any]:
        """
        处理灯光控制帧
        
        Args:
            frame: 灯光控制传输帧
            
        Returns:
            处理结果
        """
        results = []
        all_success = True
        
        for msg in frame.messages:
            if msg.msg_id != MsgType.LIGHT_CONTROL:
                continue
            
            try:
                sat_id = msg.dest_id
                self.light_service.apply_light_data(sat_id, msg.data)
                
                results.append({
                    "sat_id": sat_id,
                    "success": True,
                    "light_state": self.light_service.get_light(sat_id),
                })
            except ValueError as e:
                results.append({
                    "sat_id": msg.dest_id,
                    "success": False,
                    "error": str(e),
                })
                all_success = False
        
        return {
            "success": all_success,
            "type": "light_control",
            "frame_count": frame.frame_count,
            "results": results,
        }
    
    def _handle_verify_request(self, frame: TransferFrame) -> Dict[str, Any]:
        """
        处理互校验请求帧
        
        Args:
            frame: VerifyRequest传输帧
            
        Returns:
            处理结果，包含VerifyResponse子消息
        """
        if self.verify_service is None:
            return {
                "success": False,
                "error": "VerifyService not available",
                "type": "verify_request",
            }
        
        responses = []
        for msg in frame.messages:
            if msg.msg_id != MsgType.VERIFY_REQUEST:
                continue
            
            try:
                target_msg_id = msg.dest_id
                found = self.verify_service.get_stored_message(
                    msg.dest_id, target_msg_id
                )
                if found:
                    response_msg = SubMessage(
                        msg_id=target_msg_id,
                        dest_id=found.dest_id,
                        data=found.data,
                    )
                    response_msg.crc_msg = found.crc_msg
                    responses.append(response_msg)
            except Exception as e:
                print(f"[ProtocolHandler] VerifyRequest处理失败: {e}")
        
        return {
            "success": len(responses) > 0,
            "type": "verify_request",
            "frame_count": frame.frame_count,
            "responses": responses,
        }
    
    def _handle_verify_response(self, frame: TransferFrame) -> Dict[str, Any]:
        """
        处理互校验响应帧
        
        Args:
            frame: VerifyResponse传输帧
            
        Returns:
            处理结果，包含验证一致性信息
        """
        if self.verify_service is None:
            return {
                "success": False,
                "error": "VerifyService not available",
                "type": "verify_response",
            }
        
        verified_results = []
        for msg in frame.messages:
            if msg.msg_id != MsgType.VERIFY_RESPONSE:
                continue
            
            try:
                verified_results.append({
                    "msg_id": msg.msg_id,
                    "dest_id": msg.dest_id,
                    "data": msg.data,
                    "crc_msg": msg.crc_msg,
                })
            except Exception as e:
                print(f"[ProtocolHandler] VerifyResponse处理失败: {e}")
        
        return {
            "success": len(verified_results) > 0,
            "type": "verify_response",
            "frame_count": frame.frame_count,
            "verified": verified_results,
        }
    
    def _handle_telemetry(self, frame: TransferFrame) -> Dict[str, Any]:
        """Handle telemetry frame (Phase 2)"""
        return {
            "success": True,
            "type": "telemetry",
            "frame_count": frame.frame_count,
            "message": "Telemetry handling not yet implemented",
        }
    
    def _handle_status_report(self, frame: TransferFrame) -> Dict[str, Any]:
        """Handle status report frame (Phase 2)"""
        return {
            "success": True,
            "type": "status_report",
            "frame_count": frame.frame_count,
            "message": "Status report handling not yet implemented",
        }
    
    def build_light_control_frame(
        self,
        commands: list,
        frame_count: int = 0,
        packet_id: int = 0,
        neighbor_map: Optional[Dict[int, list]] = None,
    ) -> bytes:
        """
        根据灯光指令列表构造LDPC编码的协议帧
        
        Args:
            commands: [{"sat_id": 0, "command": "on"}, {"sat_id": 3, "command": "off"}, ...]
            frame_count: 帧计数器
            packet_id: 数据包标识
            neighbor_map: {sat_id: [neighbor_id, ...], ...} 邻居拓扑
        
        Returns:
            LDPC编码后的字节数据
        """
        messages = []
        msg_counter = 0
        
        for cmd in commands:
            sat_id = cmd.get("sat_id", 0)
            command = cmd.get("command", "").lower()
            
            if command == "on":
                data = bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
            elif command == "off":
                data = bytes([LightCommand.TURN_OFF, LightCommand.STATE_OFF])
            else:
                continue
            
            msg = SubMessage(
                msg_id=msg_counter,
                dest_id=sat_id,
                data=data,
            )
            messages.append(msg)
            msg_counter += 1
            
            if neighbor_map and sat_id in neighbor_map:
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
                        
                        neighbor_msg = SubMessage(
                            msg_id=msg_counter,
                            dest_id=neighbor_id,
                            data=n_data,
                        )
                        messages.append(neighbor_msg)
                        msg_counter += 1
        
        frame = TransferFrame(
            version=1,
            scid=0x0001,
            vcid=0,
            frame_count=frame_count,
            packet_type=PacketType.LIGHT_CONTROL,
            dest_id=0xFFFF,
            packet_id=packet_id,
            messages=messages,
        )
        
        ldpc_bytes = frame.to_ldpc_bytes(self._codec)
        
        if self._logger:
            self._logger.log_ldpc_decoded(frame)
            self._logger.log_crc_verified(frame.verify_crc(), frame.crc)
            self._logger.log_submessages(messages)
        
        return ldpc_bytes
