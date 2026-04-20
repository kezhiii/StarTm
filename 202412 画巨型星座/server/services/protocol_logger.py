"""
协议日志记录器

记录协议帧的发送、LDPC解码、CRC校验、子消息解析和执行结果。
每次启动后端服务创建新的日志文件：log/test_yyyymmddhhmmss.log
"""

from __future__ import annotations
import os
import base64
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from ..protocol import TransferFrame, SubMessage
from ..protocol.constants import PacketType, MsgType, LightCommand


class ProtocolLogger:
    """
    协议日志记录器
    
    记录内容:
    1. 发送的原始Base64数据
    2. LDPC编码前消息示例
    3. LDPC编码后消息示例
    4. LDPC解码后的帧内容
    5. CRC校验结果
    6. LDPC解码后完整消息队列
    7. 执行结果
    
    日志格式:
    === 协议帧处理日志 ===
    时间: 2026-04-17 10:30:01.123
    客户端: 127.0.0.1:54321
    
    [1] 发送原始帧 (Base64):
        55AA0025AABBCCDD...
    
    [2] LDPC编码前消息示例 (卫星0):
        Msg_ID: 0000
        Dest_ID: 0000
        Data_Length: 0002
        Data: 0101
        CRC_msg: XXXXXXXX
        指令类型: LIGHT_CONTROL (0x0101)
        含义: 开灯
    
    [3] LDPC编码后消息示例 (卫星0):
        55AA0040000AABBCCDD...
    
    [4] LDPC解码后:
        Sync: AABBCCDD
        Version: 1
        ...
    
    [5] CRC校验: 通过 (CRC=E0083F5A)
    
    [6] LDPC解码后完整消息队列:
        Msg[0]: Msg_ID=0000, Dest_ID=0000, Data_Length=2, Data=0101
            指令类型: LIGHT_CONTROL (0x0000)
            含义: 开灯
        Msg[1]: Msg_ID=0001, Dest_ID=000E, Data_Length=2, Data=0101
            指令类型: LIGHT_CONTROL (0x0001)
            含义: 开灯
        ...
    
    [7] 执行结果: 成功
    ================================
    """
    
    def __init__(self, log_dir: str = "log"):
        """
        初始化协议日志记录器
        
        Args:
            log_dir: 日志目录（相对于项目根目录）
        """
        self._log_dir = Path(log_dir)
        self._log_dir.mkdir(parents=True, exist_ok=True)
        
        # 创建日志文件: test_yyyymmddhhmmss.log
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        self._log_path = self._log_dir / f"test_{timestamp}.log"
        
        # 写入文件头
        with open(self._log_path, "w", encoding="utf-8") as f:
            f.write("=" * 60 + "\n")
            f.write("协议帧处理日志\n")
            f.write(f"启动时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"日志文件: {self._log_path.name}\n")
            f.write("=" * 60 + "\n\n")
        
        print(f"[ProtocolLogger] 日志文件已创建: {self._log_path}")
    
    @property
    def log_path(self) -> Path:
        """日志文件路径"""
        return self._log_path
    
    def _write(self, content: str) -> None:
        """写入日志内容"""
        with open(self._log_path, "a", encoding="utf-8") as f:
            f.write(content + "\n")
    
    def log_sent(self, raw_base64: str, commands: List[Dict[str, Any]], client_addr: str = "unknown") -> None:
        """
        记录发送的原始Base64数据和指令列表
        
        Args:
            raw_base64: 原始Base64编码的帧数据
            commands: 灯光指令列表 [{"sat_id": 0, "command": "on"}, ...]
            client_addr: 客户端地址
        """
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        
        self._write(f"=== 协议帧处理日志 ===")
        self._write(f"时间: {now}")
        self._write(f"客户端: {client_addr}")
        self._write(f"")
        self._write(f"[1] 发送原始帧 (Base64):")
        
        # 分行显示Base64（每行80字符）
        for i in range(0, len(raw_base64), 80):
            self._write(f"    {raw_base64[i:i+80]}")
        
        self._write(f"")
        self._write(f"    指令列表 ({len(commands)}条):")
        for cmd in commands:
            sat_id = cmd.get("sat_id", "?")
            command = cmd.get("command", "?")
            arrow = "开灯" if command == "on" else "关灯"
            self._write(f"      → 卫星{sat_id} {arrow}")
        self._write(f"")
    
    def log_ldpc_before_sample(self, raw_frame_bytes: bytes, first_msg: Optional[SubMessage] = None) -> None:
        """
        记录LDPC编码前消息示例（单个卫星）
        
        Args:
            raw_frame_bytes: 原始帧字节
            first_msg: 要显示的第一个子消息（若为None则自动选择第一条）
        """
        self._write(f"[2] LDPC编码前消息示例 (卫星0):")
        
        if raw_frame_bytes is None and first_msg is None:
            self._write(f"    (暂无原始帧数据)")
            return
        
        frame = TransferFrame.from_bytes(raw_frame_bytes)
        
        if first_msg is None:
            first_msg = frame.messages[0] if frame.messages else None
        
        # 显示原始帧
        self._write(f"    原始帧 (前64字节): {raw_frame_bytes.hex().upper()}")
        self._write(
            f"    子消息: Msg_ID={first_msg.msg_id:04X}, "
            f"Dest_ID={first_msg.dest_id:04X}, "
            f"Data_Length={first_msg.data_length}, "
            f"Data={first_msg.data.hex().upper() if first_msg.data else ''}"
        )
        
        if first_msg and first_msg.msg_id == MsgType.LIGHT_CONTROL and first_msg.data_length == 2:
            try:
                cmd_type = LightCommand(first_msg.data[0])
                light_state = LightCommand(first_msg.data[1])
                cmd_name = "开灯" if cmd_type == LightCommand.TURN_ON else "关灯"
                self._write(f"    指令类型: 0x{cmd_type:02X} ({cmd_name}), 含义: {cmd_name}")
            except ValueError:
                self._write(f"    指令格式无法识别")
        
        # 显示子消息总数
        self._write(f"    (共{len(frame.messages)}条子消息)")
    
    def log_ldpc_after_sample(self, ldpc_bytes: bytes) -> None:
        """
        记录LDPC编码后消息示例（单个卫星）
        
        Args:
            ldpc_bytes: LDPC编码后的字节数据
        """
        self._write(f"[3] LDPC编码后消息示例 (卫星0):")
        self._write(f"    编码数据 (前32字节): {ldpc_bytes[:32].hex().upper()}")
        self._write(f"    子消息: Msg_ID=0000, Dest_ID=0000, Data=0101 (开灯)")
    
    def log_ldpc_decoded(self, frame: TransferFrame) -> None:
        """
        记录LDPC解码后的帧内容
        
        Args:
            frame: 解析后的TransferFrame对象
        """
        self._write(f"[4] LDPC解码后:")
        self._write(f"    Sync: {frame.sync.hex().upper()}")
        self._write(f"    Version: {frame.version}")
        self._write(f"    SCID: {frame.scid:04X}")
        self._write(f"    VCID: {frame.vcid}")
        self._write(f"    Frame_Count: {frame.frame_count}")
        
        # Packet_Type名称
        try:
            pt_name = PacketType(frame.packet_type).name
        except ValueError:
            pt_name = f"UNKNOWN(0x{frame.packet_type:02X})"
        self._write(f"    Packet_Type: {frame.packet_type:02X} ({pt_name})")
        
        self._write(f"    Dest_ID: {frame.dest_id:04X}")
        self._write(f"    Packet_ID: {frame.packet_id:04X}")
        self._write(f"    Packet_Length: {self._calc_packet_length(frame)}")
        self._write(f"    CRC: {frame.crc:08X}")
        self._write(f"")
    
    def _calc_packet_length(self, frame: TransferFrame) -> int:
        """计算Payload长度"""
        payload_len = 1  # Msg_Count
        for msg in frame.messages:
            payload_len += 10 + msg.data_length
        return payload_len
    
    def log_crc_verified(self, passed: bool, crc_value: int) -> None:
        """
        记录CRC校验结果
        
        Args:
            passed: 校验是否通过
            crc_value: CRC值
        """
        status = "通过" if passed else "失败"
        self._write(f"[5] CRC校验: {status} (CRC={crc_value:08X})")
        self._write(f"")
    
    def log_complete_message_queue(self, messages: List[SubMessage]) -> None:
        """
        记录LDPC解码后完整消息队列（全部卫星）
        
        Args:
            messages: 所有解码后的子消息列表
        """
        self._write(f"[6] LDPC解码后完整消息队列 (旧格式，建议使用log_per_satellite_frames):")
        
        for i, msg in enumerate(messages):
            data_hex = msg.data.hex().upper() if msg.data else ""
            self._write(f"    Msg[{i}]: Msg_ID={msg.msg_id:04X}, Dest_ID={msg.dest_id:04X}, Data_Length={msg.data_length}, Data={data_hex}")
            
            if msg.data and len(msg.data) == 2:
                try:
                    cmd_type = LightCommand(msg.data[0])
                    cmd_name = "开灯" if cmd_type == LightCommand.TURN_ON else "关灯"
                    self._write(f"        → 卫星{msg.dest_id:04X} 指令类型: 0x{cmd_type:02X} ({cmd_name}), 含义: {cmd_name}")
                except ValueError:
                    self._write(f"        → 卫星{msg.dest_id:04X} 指令格式无法识别")
        self._write(f"")
    
    def log_per_satellite_frames(self, frames: list) -> None:
        """
        记录按卫星分组的协议帧（每颗卫星一帧，每帧3条子消息）
        
        Args:
            frames: 列表，每项为 (dest_id, ldpc_bytes, TransferFrame) 元组
        """
        self._write(f"[6] LDPC解码后完整消息队列（按卫星分组）:")
        self._write(f"    共{len(frames)}颗卫星帧")
        self._write(f"")
        
        for sat_id, ldpc_bytes, frame in frames:
            self._write(f"  ── 帧 Dest_ID=0x{sat_id:04X} (卫星{sat_id}) ──")
            
            for i, msg in enumerate(frame.messages):
                data_hex = msg.data.hex().upper() if msg.data else "(空)"
                role = "自身指令" if i == 0 else f"邻星验证(卫星{msg.dest_id})"
                self._write(
                    f"    SubMsg[{i}]: Msg_ID={msg.msg_id:04X}, "
                    f"Dest_ID={msg.dest_id:04X}, "
                    f"Data_Length={msg.data_length}, "
                    f"Data={data_hex}  [{role}]"
                )
                
                if msg.data and len(msg.data) == 2:
                    try:
                        cmd_type = LightCommand(msg.data[0])
                        cmd_name = "开灯" if cmd_type == LightCommand.TURN_ON else "关灯"
                        self._write(f"        → 指令类型: 0x{cmd_type:02X} ({cmd_name})")
                    except ValueError:
                        pass
                elif not msg.data:
                    self._write(f"        → 该卫星未被点亮（空数据）")
            
            self._write(f"")
        self._write(f"")
    
    def log_result(self, success: bool, details: Dict[str, Any]) -> None:
        """
        记录执行结果
        
        Args:
            success: 是否成功
            details: 详细信息
        """
        status = "成功" if success else "失败"
        self._write(f"[7] 执行结果: {status}")
        
        if "results" in details:
            for r in details["results"]:
                sat_id = r.get("sat_id", "?")
                ok = r.get("success", False)
                state = r.get("light_state", False)
                err = r.get("error", "")
                if ok:
                    self._write(f"    卫星{sat_id}: 灯光{'开' if state else '关'}")
                else:
                    self._write(f"    卫星{sat_id}: 失败 - {err}")
        
        if "error" in details:
            self._write(f"    错误: {details['error']}")
        
        self._write(f"================================")
        self._write(f"")
    
    def log_error(self, error_type: str, message: str, client_addr: str = "unknown") -> None:
        """
        记录错误
        
        Args:
            error_type: 错误类型
            message: 错误信息
            client_addr: 客户端地址
        """
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        
        self._write(f"=== 协议帧处理错误 ===")
        self._write(f"时间: {now}")
        self._write(f"客户端: {client_addr}")
        self._write(f"错误类型: {error_type}")
        self._write(f"错误信息: {message}")
        self._write(f"================================")
        self._write(f"")
