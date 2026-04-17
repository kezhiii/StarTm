"""
统一传输帧结构（Transfer Frame）编解码实现

基于通信协议文档定义的帧结构:
- 同步字(Sync): 4字节
- 版本(Version): 4位
- 虚拟通道标识(VCID): 4位  
- 航天器标识(SCID): 2字节
- 帧计数(Frame_Count): 2字节
- 数据包类型(Packet_Type): 1字节
- 目标标识(Dest_ID): 2字节
- 数据包标识(Packet_ID): 2字节
- 数据包长度(Packet_Length): 2字节
- 载荷(Payload): 可变长度
- CRC校验: 4字节
"""

import struct
import binascii
from typing import List, Optional
from dataclasses import dataclass, field


def calc_crc32(data: bytes) -> int:
    """
    计算CRC32校验值
    
    当前使用标准CRC32算法，实际部署时可替换为协议指定的多项式。
    
    Args:
        data: 待校验的字节数据
        
    Returns:
        32位CRC校验值
    """
    return binascii.crc32(data) & 0xFFFFFFFF


@dataclass
class SubMessage:
    """
    子消息结构 (Msg)
    
    协议定义:
    | Msg_ID (2 bytes) | Dest_ID (2 bytes) | Data_Length (2 bytes) | Data | CRC_msg (4 bytes) |
    
    Attributes:
        msg_id: 消息标识，16位
        dest_id: 子消息级目标节点标识，16位
        data: 消息数据内容，字节类型
        data_length: 数据长度（自动计算，无需手动设置）
        crc_msg: 消息级CRC校验值（自动计算，无需手动设置）
    
    Example:
        >>> msg = SubMessage(msg_id=0x0001, dest_id=0x0002, data=b"Hello, Satellite!")
        >>> msg_bytes = msg.to_bytes()
        >>> parsed_msg = SubMessage.from_bytes(msg_bytes)
    """
    msg_id: int          # 16 bit 消息标识
    dest_id: int         # 16 bit 子消息级目标节点
    data: bytes          # 可变长度数据
    data_length: int = field(init=False, repr=False)
    crc_msg: int = field(default=0, repr=False)

    def __post_init__(self):
        """初始化后自动计算数据长度和CRC"""
        self.data_length = len(self.data)
        self.crc_msg = self._compute_crc()

    def _compute_crc(self) -> int:
        """
        计算消息级CRC
        
        CRC覆盖范围: Msg_ID(2字节) + Dest_ID(2字节) + Data_Length(2字节) + Data
        
        Returns:
            32位CRC校验值
        """
        # 打包: 大端模式 (big-endian)
        buf = struct.pack(">HHH", self.msg_id, self.dest_id, self.data_length)
        buf += self.data
        return calc_crc32(buf)

    def to_bytes(self) -> bytes:
        """
        将子消息序列化为字节
        
        Returns:
            完整的子消息字节序列
        """
        buf = struct.pack(">HHH", self.msg_id, self.dest_id, self.data_length)
        buf += self.data
        buf += struct.pack(">I", self.crc_msg)
        return buf

    @classmethod
    def from_bytes(cls, raw: bytes) -> "SubMessage":
        """
        从字节流解析子消息
        
        Args:
            raw: 包含子消息的字节数据
            
        Returns:
            解析后的SubMessage对象
            
        Raises:
            ValueError: 数据格式错误或CRC校验失败
        """
        if len(raw) < 10:  # 最小长度: 6字节头部 + 4字节CRC
            raise ValueError(f"SubMessage too short: {len(raw)} bytes, minimum 10 bytes required")
            
        # 解包头部
        msg_id, dest_id, data_len = struct.unpack(">HHH", raw[0:6])
        
        # 提取数据和CRC
        data = raw[6:6 + data_len]
        crc_msg = struct.unpack(">I", raw[6 + data_len:10 + data_len])[0]
        
        # 创建实例（跳过__post_init__避免重复计算CRC）
        instance = cls.__new__(cls)
        instance.msg_id = msg_id
        instance.dest_id = dest_id
        instance.data = data
        instance.data_length = data_len
        instance.crc_msg = crc_msg
        
        return instance

    def verify_crc(self) -> bool:
        """
        验证消息级CRC
        
        Returns:
            CRC校验是否通过
        """
        return self._compute_crc() == self.crc_msg


class TransferFrame:
    """
    统一传输帧结构 (Transfer Frame)
    
    协议定义:
    | Sync (4B) | Version+VCID (1B) | SCID (2B) | Frame_Count (2B) | 
    | Packet_Type (1B) | Dest_ID (2B) | Packet_ID (2B) | Packet_Length (2B) |
    | Payload | CRC (4B) |
    
    Payload结构:
    | Msg_Count (1B) | Msg_A | Msg_B | ... |
    
    Attributes:
        sync: 同步字，4字节，默认0xAABBCCDD
        version: 协议版本，4位
        scid: 航天器标识，16位
        vcid: 虚拟通道标识，4位
        frame_count: 帧计数器，16位
        packet_type: 数据包类型，8位
        dest_id: 目标节点标识，16位（0xFFFF表示广播）
        packet_id: 数据包标识，16位
        messages: 子消息列表
        crc: 帧级CRC校验值（自动计算）
    
    Example:
        >>> # 创建包含多个子消息的传输帧
        >>> msg1 = SubMessage(msg_id=0x0001, dest_id=0x0002, data=b"Msg1")
        >>> msg2 = SubMessage(msg_id=0x0002, dest_id=0x0003, data=b"Msg2")
        >>> 
        >>> frame = TransferFrame(
        ...     version=1,
        ...     scid=0x1234,
        ...     vcid=0,
        ...     frame_count=100,
        ...     packet_type=0x01,
        ...     dest_id=0x0002,
        ...     packet_id=0x0001,
        ...     messages=[msg1, msg2]
        ... )
        >>> 
        >>> frame_bytes = frame.to_bytes()
        >>> parsed_frame = TransferFrame.from_bytes(frame_bytes)
    """
    
    # 固定偏移量（字节位置）
    OFFSET_SYNC = 0
    OFFSET_VER_VCID = 4
    OFFSET_SCID = 5
    OFFSET_FRAME_COUNT = 7
    OFFSET_PKT_TYPE = 9
    OFFSET_DEST_ID = 10
    OFFSET_PKT_ID = 12
    OFFSET_PKT_LEN = 14
    HEADER_SIZE = 16  # Sync(4) + 固定头(12)

    def __init__(
        self, 
        version: int, 
        scid: int, 
        vcid: int, 
        frame_count: int,
        packet_type: int, 
        dest_id: int, 
        packet_id: int,
        messages: Optional[List[SubMessage]] = None, 
        sync: bytes = b"\xAA\xBB\xCC\xDD"
    ):
        """
        初始化传输帧
        
        Args:
            version: 协议版本 (0-15)
            scid: 航天器标识 (0-65535)
            vcid: 虚拟通道标识 (0-15)
            frame_count: 帧计数器 (0-65535)
            packet_type: 数据包类型 (0-255)
            dest_id: 目标节点标识 (0-65535), 0xFFFF表示广播
            packet_id: 数据包标识 (0-65535)
            messages: 子消息列表
            sync: 同步字，4字节
        """
        self.sync = sync
        self.version = version & 0x0F  # 限制为4位
        self.scid = scid & 0xFFFF      # 限制为16位
        self.vcid = vcid & 0x0F        # 限制为4位
        self.frame_count = frame_count & 0xFFFF  # 限制为16位
        self.packet_type = packet_type & 0xFF     # 限制为8位
        self.dest_id = dest_id & 0xFFFF           # 限制为16位
        self.packet_id = packet_id & 0xFFFF      # 限制为16位
        self.messages = messages or []
        self.crc = 0  # 将在to_bytes时计算

    def _serialize_header(self) -> bytes:
        """
        打包固定帧头（不含Sync和CRC）
        
        Returns:
            10字节的帧头数据
        """
        # Version和VCID合并为1字节: VVVV CCCC
        ver_vcid = ((self.version & 0x0F) << 4) | (self.vcid & 0x0F)
        
        buf = struct.pack(">B", ver_vcid)               # 1 byte: Version + VCID
        buf += struct.pack(">H", self.scid)             # 2 bytes: SCID
        buf += struct.pack(">H", self.frame_count)      # 2 bytes: Frame_Count
        buf += struct.pack(">B", self.packet_type)      # 1 byte: Packet_Type
        buf += struct.pack(">H", self.dest_id)          # 2 bytes: Dest_ID
        buf += struct.pack(">H", self.packet_id)        # 2 bytes: Packet_ID
        return buf                                      # 总计: 10 bytes

    def _serialize_payload(self) -> bytes:
        """
        打包载荷（Payload）
        
        结构: Msg_Count(1字节) + 多个Msg
        
        Returns:
            载荷字节数据
        """
        buf = struct.pack(">B", len(self.messages))  # 1 byte: 消息数量
        for msg in self.messages:
            buf += msg.to_bytes()
        return buf

    def to_bytes(self) -> bytes:
        """
        完整帧序列化
        
        自动计算Packet_Length和CRC
        
        Returns:
            完整的传输帧字节序列
        """
        header = self._serialize_header()
        payload = self._serialize_payload()
        packet_length = len(payload)
        
        # 拼接完整头部（包含Packet_Length）
        full_header = header + struct.pack(">H", packet_length)
        
        # CRC计算范围: Version ~ Payload（不含Sync和CRC自身）
        crc_data = full_header + payload
        self.crc = calc_crc32(crc_data)
        
        # 组装完整帧: Sync + Header + Payload + CRC
        return self.sync + full_header + payload + struct.pack(">I", self.crc)

    @classmethod
    def from_bytes(cls, raw: bytes) -> "TransferFrame":
        """
        从字节流解析传输帧
        
        Args:
            raw: 包含完整传输帧的字节数据
            
        Returns:
            解析后的TransferFrame对象
            
        Raises:
            ValueError: 数据长度不足或CRC校验失败
        """
        if len(raw) < cls.HEADER_SIZE:
            raise ValueError(f"Frame too short: {len(raw)} bytes, minimum {cls.HEADER_SIZE} bytes required")
            
        # 解析Sync
        sync = raw[cls.OFFSET_SYNC:4]
        
        # 解析Version和VCID
        ver_vcid = raw[cls.OFFSET_VER_VCID]
        version = (ver_vcid >> 4) & 0x0F
        vcid = ver_vcid & 0x0F
        
        # 解析SCID和Frame_Count
        scid, frame_count = struct.unpack(">HH", raw[cls.OFFSET_SCID:cls.OFFSET_FRAME_COUNT+2])
        
        # 解析Packet_Type
        packet_type = raw[cls.OFFSET_PKT_TYPE]
        
        # 解析Dest_ID, Packet_ID, Packet_Length
        dest_id, packet_id, packet_length = struct.unpack(">HHH", raw[cls.OFFSET_DEST_ID:cls.HEADER_SIZE])
        
        # 提取Payload和CRC
        payload_raw = raw[cls.HEADER_SIZE:cls.HEADER_SIZE + packet_length]
        crc_received = struct.unpack(">I", raw[cls.HEADER_SIZE + packet_length:cls.HEADER_SIZE + packet_length + 4])[0]
        
        # 验证帧级CRC
        crc_data = raw[4:cls.HEADER_SIZE + packet_length]  # 从Version到Payload
        if calc_crc32(crc_data) != crc_received:
            raise ValueError("Frame CRC verification failed")
            
        # 解析Payload中的子消息
        if len(payload_raw) < 1:
            messages = []
        else:
            msg_count = struct.unpack(">B", payload_raw[0:1])[0]
            messages = []
            offset = 1
            for _ in range(msg_count):
                if offset + 6 > len(payload_raw):
                    break
                # 读取Data_Length以定位完整的Msg
                data_len = struct.unpack(">H", payload_raw[offset+4:offset+6])[0]
                msg_total_len = 6 + data_len + 4  # 头部6字节 + 数据 + CRC 4字节
                msg_raw = payload_raw[offset:offset + msg_total_len]
                messages.append(SubMessage.from_bytes(msg_raw))
                offset += msg_total_len
            
        # 创建实例
        instance = cls(
            version=version,
            scid=scid,
            vcid=vcid,
            frame_count=frame_count,
            packet_type=packet_type,
            dest_id=dest_id,
            packet_id=packet_id,
            messages=messages,
            sync=sync
        )
        # 设置CRC值（已从帧中解析）
        instance.crc = crc_received
        return instance

    def verify_crc(self) -> bool:
        """
        验证帧级CRC
        
        Returns:
            CRC校验是否通过
        """
        header = self._serialize_header()
        payload = self._serialize_payload()
        packet_length = len(payload)
        full_header = header + struct.pack(">H", packet_length)
        crc_data = full_header + payload
        return calc_crc32(crc_data) == self.crc

    def get_total_length(self) -> int:
        """
        获取传输帧总长度
        
        Returns:
            完整的帧字节长度
        """
        payload_len = 1  # Msg_Count
        for msg in self.messages:
            payload_len += 10 + msg.data_length  # 10字节固定 + 数据长度
        return 4 + 12 + 2 + payload_len + 4  # Sync(4) + Header(12) + Packet_Length(2) + Payload + CRC(4)

    def __repr__(self) -> str:
        """返回传输帧的字符串表示"""
        return (
            f"TransferFrame("
            f"sync={self.sync.hex()}, "
            f"version={self.version}, "
            f"scid={self.scid}, "
            f"vcid={self.vcid}, "
            f"frame_count={self.frame_count}, "
            f"packet_type={self.packet_type}, "
            f"dest_id={self.dest_id}, "
            f"packet_id={self.packet_id}, "
            f"msg_count={len(self.messages)}, "
            f"crc={self.crc:08X}"
            f")"
        )
