import struct
import binascii
from typing import List, Optional
from dataclasses import dataclass, field

# ================= 辅助函数 =================
def calc_crc32(data: bytes) -> int:
    """CRC32 计算（占位，实际部署需替换为协议指定多项式）"""
    return binascii.crc32(data) & 0xFFFFFFFF

# ================= 子消息结构 (Msg) =================
@dataclass
class SubMessage:
    msg_id: int          # 16 bit
    dest_id: int         # 16 bit (子消息级目标节点)
    data: bytes          # 可变长度
    data_length: int = field(init=False, repr=False)
    crc_msg: int = field(default=0, repr=False)

    def __post_init__(self):
        self.data_length = len(self.data)
        self.crc_msg = self._compute_crc()

    def _compute_crc(self) -> int:
        # CRC覆盖: Msg_ID(2) + Dest_ID(2) + Data_Length(2) + Data
        buf = struct.pack(">HHH", self.msg_id, self.dest_id, self.data_length)
        buf += self.data
        return calc_crc32(buf)

    def to_bytes(self) -> bytes:
        buf = struct.pack(">HHH", self.msg_id, self.dest_id, self.data_length)
        buf += self.data
        buf += struct.pack(">I", self.crc_msg)
        return buf

    @classmethod
    def from_bytes(cls, raw: bytes) -> "SubMessage":
        msg_id, dest_id, data_len = struct.unpack(">HHH", raw[0:6])
        data = raw[6:6 + data_len]
        crc_msg = struct.unpack(">I", raw[6 + data_len:10 + data_len])[0]
        return cls(msg_id=msg_id, dest_id=dest_id, data=data, crc_msg=crc_msg)

# ================= 传输帧结构 (Transfer Frame) =================
class TransferFrame:
    # 固定偏移量 (字节)
    OFFSET_SYNC = 0
    OFFSET_VER_VCID = 4
    OFFSET_SCID = 5
    OFFSET_FRAME_COUNT = 7
    OFFSET_PKT_TYPE = 9
    OFFSET_DEST_ID = 10
    OFFSET_PKT_ID = 12
    OFFSET_PKT_LEN = 14
    HEADER_SIZE = 16  # Sync(4) + 固定头(12)

    def __init__(self, version: int, scid: int, vcid: int, frame_count: int,
                 packet_type: int, dest_id: int, packet_id: int,
                 messages: List[SubMessage] = None, 
                 sync: bytes = b"\xAA\xBB\xCC\xDD"):
        self.sync = sync
        self.version = version & 0x0F
        self.scid = scid & 0xFFFF
        self.vcid = vcid & 0x0F
        self.frame_count = frame_count
        self.packet_type = packet_type
        self.dest_id = dest_id & 0xFFFF
        self.packet_id = packet_id
        self.messages = messages or []
        self.crc = 0

    def _serialize_header(self) -> bytes:
        """打包固定帧头 (不含 Sync 和 CRC)"""
        ver_vcid = ((self.version & 0x0F) << 4) | (self.vcid & 0x0F)
        buf = struct.pack(">B", ver_vcid)               # 1 byte
        buf += struct.pack(">H", self.scid)             # 2 bytes
        buf += struct.pack(">H", self.frame_count)      # 2 bytes
        buf += struct.pack(">B", self.packet_type)      # 1 byte
        buf += struct.pack(">H", self.dest_id)          # 2 bytes
        buf += struct.pack(">H", self.packet_id)        # 2 bytes
        return buf                                      # Total: 10 bytes

    def _serialize_payload(self) -> bytes:
        """打包 Payload: Msg_Count(8bit) + 多个 Msg"""
        buf = struct.pack(">B", len(self.messages))
        for msg in self.messages:
            buf += msg.to_bytes()
        return buf

    def to_bytes(self) -> bytes:
        """完整帧序列化（自动计算 Packet_Length 与 CRC）"""
        header = self._serialize_header()
        payload = self._serialize_payload()
        packet_length = len(payload)
        
        # 拼接完整头部
        full_header = header + struct.pack(">H", packet_length)
        
        # CRC 计算范围: Version ~ Payload (不含 Sync 与 CRC 自身)
        crc_data = full_header + payload
        self.crc = calc_crc32(crc_data)
        
        return self.sync + full_header + payload + struct.pack(">I", self.crc)

    @classmethod
    def from_bytes(cls, raw: bytes) -> "TransferFrame":
        """从字节流解析帧"""
        if len(raw) < cls.HEADER_SIZE:
            raise ValueError("Frame too short")
            
        sync = raw[cls.OFFSET_SYNC:4]
        ver_vcid = raw[cls.OFFSET_VER_VCID]
        version = (ver_vcid >> 4) & 0x0F
        vcid = ver_vcid & 0x0F
        scid, frame_count = struct.unpack(">HH", raw[cls.OFFSET_SCID:cls.OFFSET_FRAME_COUNT+2])
        packet_type = raw[cls.OFFSET_PKT_TYPE]
        dest_id, packet_id, packet_length = struct.unpack(">HHH", raw[cls.OFFSET_DEST_ID:cls.HEADER_SIZE])
        
        payload_raw = raw[cls.HEADER_SIZE:cls.HEADER_SIZE + packet_length]
        crc_received = struct.unpack(">I", raw[cls.HEADER_SIZE + packet_length:cls.HEADER_SIZE + packet_length + 4])[0]
        
        # 验证 CRC
        crc_data = raw[4:cls.HEADER_SIZE + packet_length]
        if calc_crc32(crc_data) != crc_received:
            raise ValueError("Frame CRC verification failed")
            
        # 解析 Payload
        msg_count = struct.unpack(">B", payload_raw[0:1])[0]
        messages = []
        offset = 1
        for _ in range(msg_count):
            if offset + 6 > len(payload_raw):
                break
            # 读取 Data_Length 以定位 CRC_msg
            data_len = struct.unpack(">H", payload_raw[offset+4:offset+6])[0]
            msg_total_len = 6 + data_len + 4
            msg_raw = payload_raw[offset:offset + msg_total_len]
            messages.append(SubMessage.from_bytes(msg_raw))
            offset += msg_total_len
            
        return cls(
            version=version, scid=scid, vcid=vcid, frame_count=frame_count,
            packet_type=packet_type, dest_id=dest_id, packet_id=packet_id,
            messages=messages, sync=sync
        )