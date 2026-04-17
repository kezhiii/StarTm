"""
通信协议模块 (Communication Protocol Module)

实现统一传输帧结构（Transfer Frame）的编解码，用于卫星星座通信。

协议结构:
    Transfer Frame:
    - Sync (4 bytes): 同步字，用于帧同步
    - Version (4 bits): 协议版本
    - VCID (4 bits): 虚拟通道标识
    - SCID (2 bytes): 航天器标识
    - Frame_Count (2 bytes): 帧计数器
    - Packet_Type (1 byte): 数据包类型
    - Dest_ID (2 bytes): 目标节点标识
    - Packet_ID (2 bytes): 数据包标识
    - Packet_Length (2 bytes): 载荷长度
    - Payload: 有效载荷（包含多个子消息）
    - CRC (4 bytes): 循环冗余校验

    SubMessage (Msg):
    - Msg_ID (2 bytes): 消息标识
    - Dest_ID (2 bytes): 子消息目标节点
    - Data_Length (2 bytes): 数据长度
    - Data: 消息数据
    - CRC_msg (4 bytes): 消息级CRC

示例:
    >>> from server.protocol import TransferFrame, SubMessage
    >>> 
    >>> # 创建子消息
    >>> msg = SubMessage(msg_id=0x0001, dest_id=0x0002, data=b"Hello")
    >>> 
    >>> # 创建传输帧
    >>> frame = TransferFrame(
    ...     version=1,
    ...     scid=0x1234,
    ...     vcid=0,
    ...     frame_count=100,
    ...     packet_type=0x01,
    ...     dest_id=0x0002,
    ...     packet_id=0x0001,
    ...     messages=[msg]
    ... )
    >>> 
    >>> # 序列化为字节
    >>> frame_bytes = frame.to_bytes()
    >>> 
    >>> # 从字节解析
    >>> parsed_frame = TransferFrame.from_bytes(frame_bytes)
"""

from .transfer_frame import TransferFrame, SubMessage, calc_crc32
from .constants import PacketType, MsgType, LightCommand, LDPC_CODE_RATE, LDPC_BLOCK_SIZE, LDPC_PREAMBLE
from .ldpc_codec import LDPCCodec

__all__ = [
    "TransferFrame",
    "SubMessage",
    "calc_crc32",
    "PacketType",
    "MsgType",
    "LightCommand",
    "LDPC_CODE_RATE",
    "LDPC_BLOCK_SIZE",
    "LDPC_PREAMBLE",
    "LDPCCodec",
]
