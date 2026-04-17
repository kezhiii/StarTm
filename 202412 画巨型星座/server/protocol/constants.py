# server/protocol/constants.py
"""
通信协议常量定义

定义Packet_Type、Msg_ID、灯光控制命令等枚举常量。
"""

from enum import IntEnum


class PacketType(IntEnum):
    """数据包类型枚举"""
    TELEMETRY = 0x01        # 遥测数据
    COMMAND = 0x02          # 控制命令
    LIGHT_CONTROL = 0x03    # 灯光控制
    STATUS_REPORT = 0x04    # 状态报告
    VERIFY_REQUEST = 0xFE   # 校验请求（阶段2）
    VERIFY_RESPONSE = 0xFF  # 校验响应（阶段2）


class MsgType(IntEnum):
    """消息类型枚举（SubMessage.Msg_ID）"""
    LIGHT_CONTROL = 0x0101      # 灯光控制命令
    STATUS_REPORT = 0x0201      # 状态报告
    TELEMETRY = 0x0301          # 遥测数据
    ERROR_REPORT = 0x0401       # 错误报告
    VERIFY_REQUEST = 0x0501     # 互校验请求（阶段2）
    VERIFY_RESPONSE = 0x0502    # 互校验响应（阶段2）


class LightCommand(IntEnum):
    """灯光控制命令枚举"""
    TURN_ON = 0x01      # 开灯命令
    TURN_OFF = 0x02     # 关灯命令
    STATE_OFF = 0x00    # 灯光状态：灭
    STATE_ON = 0x01     # 灯光状态：亮


# LDPC配置
LDPC_CODE_RATE = 0.5        # LDPC码率
LDPC_BLOCK_SIZE = 256       # LDPC块大小（字节）
LDPC_PREAMBLE = b"\x55\xAA" # LDPC同步标识
