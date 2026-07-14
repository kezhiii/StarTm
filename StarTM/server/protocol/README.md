# 通信协议使用指南

## 概述

本项目实现了统一传输帧结构（Transfer Frame）通信协议，用于卫星星座间的数据传输。协议支持多子消息封装、CRC校验、帧同步等功能。

## 核心类

### 1. SubMessage - 子消息

子消息是传输帧的基本数据单元。

```python
from server.protocol import SubMessage

# 创建子消息
msg = SubMessage(
    msg_id=0x0001,        # 消息标识
    dest_id=0x0002,       # 目标节点标识
    data=b"Hello World"   # 消息数据
)

# 序列化为字节
msg_bytes = msg.to_bytes()

# 从字节解析
parsed_msg = SubMessage.from_bytes(msg_bytes)

# 验证CRC
is_valid = parsed_msg.verify_crc()
```

**结构:**
| 字段 | 长度 | 说明 |
|------|------|------|
| Msg_ID | 2 bytes | 消息标识 |
| Dest_ID | 2 bytes | 目标节点标识 |
| Data_Length | 2 bytes | 数据长度 |
| Data | N bytes | 消息数据 |
| CRC_msg | 4 bytes | 消息级CRC校验 |

### 2. TransferFrame - 传输帧

传输帧是完整的通信数据单元，可包含多个子消息。

```python
from server.protocol import TransferFrame, SubMessage

# 创建子消息
msg1 = SubMessage(msg_id=0x0001, dest_id=0x0002, data=b"Telemetry Data")
msg2 = SubMessage(msg_id=0x0002, dest_id=0x0003, data=b"Status Report")

# 创建传输帧
frame = TransferFrame(
    version=1,            # 协议版本 (0-15)
    scid=0x1234,          # 航天器标识 (0-65535)
    vcid=0,               # 虚拟通道标识 (0-15)
    frame_count=100,      # 帧计数器 (0-65535)
    packet_type=0x01,     # 数据包类型 (0-255)
    dest_id=0x0002,       # 目标节点标识 (0xFFFF为广播)
    packet_id=0x0001,     # 数据包标识 (0-65535)
    messages=[msg1, msg2] # 子消息列表
)

# 序列化为字节
frame_bytes = frame.to_bytes()

# 从字节解析
parsed_frame = TransferFrame.from_bytes(frame_bytes)

# 验证CRC
is_valid = parsed_frame.verify_crc()
```

**结构:**
| 字段 | 长度 | 说明 |
|------|------|------|
| Sync | 4 bytes | 同步字 (默认: 0xAABBCCDD) |
| Version | 4 bits | 协议版本 |
| VCID | 4 bits | 虚拟通道标识 |
| SCID | 2 bytes | 航天器标识 |
| Frame_Count | 2 bytes | 帧计数器 |
| Packet_Type | 1 byte | 数据包类型 |
| Dest_ID | 2 bytes | 目标节点标识 |
| Packet_ID | 2 bytes | 数据包标识 |
| Packet_Length | 2 bytes | 载荷长度 |
| Payload | N bytes | 有效载荷 (Msg_Count + 多个Msg) |
| CRC | 4 bytes | 帧级CRC校验 |

## 典型使用场景

### 场景1: 发送遥测数据

```python
import struct
from server.protocol import TransferFrame, SubMessage

# 打包遥测数据（模拟）
telemetry = {
    'satellite_id': 1,
    'timestamp': 1234567890,
    'position': (1000.5, 2000.3, 3000.7),
    'velocity': (7.8, 0.5, -2.1),
    'battery': 85.5
}

# 序列化遥测数据
data = struct.pack(
    '>IIdddddd',  # 大端模式: uint32, uint32, 6个double
    telemetry['satellite_id'],
    telemetry['timestamp'],
    *telemetry['position'],
    *telemetry['velocity'],
    telemetry['battery']
)

# 创建子消息
msg = SubMessage(
    msg_id=0x0101,  # 遥测消息类型
    dest_id=0x0001, # 地面站1
    data=data
)

# 创建传输帧
frame = TransferFrame(
    version=1,
    scid=0x0001,      # 卫星1
    vcid=0,           # 虚拟通道0
    frame_count=1000,
    packet_type=0x01, # 遥测数据包
    dest_id=0x0001,   # 地面站1
    packet_id=0x0101,
    messages=[msg]
)

# 发送帧（通过WebSocket、TCP等）
frame_bytes = frame.to_bytes()
# send(frame_bytes)
```

### 场景2: 接收并解析数据

```python
from server.protocol import TransferFrame

def handle_received_data(raw_bytes: bytes):
    """处理接收到的数据"""
    try:
        # 解析传输帧
        frame = TransferFrame.from_bytes(raw_bytes)
        
        print(f"收到帧: SCID={frame.scid:04X}, FrameCount={frame.frame_count}")
        print(f"目标: Dest_ID={frame.dest_id:04X}")
        print(f"包含 {len(frame.messages)} 条消息")
        
        # 处理每条子消息
        for msg in frame.messages:
            print(f"  消息 {msg.msg_id:04X} -> 目标 {msg.dest_id:04X}")
            print(f"  数据长度: {msg.data_length} bytes")
            
            # 验证消息CRC
            if msg.verify_crc():
                # 处理消息数据
                process_message(msg.msg_id, msg.data)
            else:
                print(f"  警告: 消息 {msg.msg_id:04X} CRC校验失败")
                
    except ValueError as e:
        print(f"帧解析失败: {e}")

def process_message(msg_id: int, data: bytes):
    """根据消息类型处理数据"""
    if msg_id == 0x0101:  # 遥测数据
        import struct
        sat_id, timestamp, px, py, pz, vx, vy, vz, battery = struct.unpack(
            '>IIdddddd', data
        )
        print(f"    卫星{sat_id}遥测: 位置=({px:.1f}, {py:.1f}, {pz:.1f})")
    elif msg_id == 0x0201:  # 状态报告
        print(f"    状态报告: {data.decode('utf-8')}")
    # ... 其他消息类型
```

### 场景3: 广播消息

```python
from server.protocol import TransferFrame, SubMessage

# 创建广播消息（dest_id = 0xFFFF）
broadcast_msg = SubMessage(
    msg_id=0x0301,      # 广播消息类型
    dest_id=0xFFFF,     # 广播地址
    data=b"System announcement: Maintenance scheduled at 12:00"
)

# 创建广播帧
broadcast_frame = TransferFrame(
    version=1,
    scid=0x0001,
    vcid=0,
    frame_count=2000,
    packet_type=0x03,   # 广播包类型
    dest_id=0xFFFF,     # 广播目标
    packet_id=0x0301,
    messages=[broadcast_msg]
)

# 所有节点都应接收此帧
frame_bytes = broadcast_frame.to_bytes()
```

### 场景4: 多消息封装

```python
from server.protocol import TransferFrame, SubMessage

# 创建不同类型的消息
messages = [
    SubMessage(msg_id=0x0101, dest_id=0x0001, data=b"Telemetry..."),
    SubMessage(msg_id=0x0201, dest_id=0x0001, data=b"Status..."),
    SubMessage(msg_id=0x0301, dest_id=0x0001, data=b"Command Ack..."),
    SubMessage(msg_id=0x0401, dest_id=0x0002, data=b"Error Report..."),
]

# 将所有消息封装到单个帧中
frame = TransferFrame(
    version=1,
    scid=0x0001,
    vcid=0,
    frame_count=3000,
    packet_type=0x04,   # 复合数据包
    dest_id=0x0001,
    packet_id=0x0401,
    messages=messages
)

# 一个帧传输多条消息，提高传输效率
frame_bytes = frame.to_bytes()
print(f"封装 {len(messages)} 条消息，总长度: {len(frame_bytes)} bytes")
```

## 错误处理

```python
from server.protocol import TransferFrame

def safe_parse_frame(raw_bytes: bytes) -> Optional[TransferFrame]:
    """安全解析帧，处理各种错误情况"""
    
    # 检查最小长度
    if len(raw_bytes) < TransferFrame.HEADER_SIZE:
        print(f"数据太短: {len(raw_bytes)} bytes")
        return None
    
    # 检查同步字
    if raw_bytes[0:4] != b'\xAA\xBB\xCC\xDD':
        print("同步字不匹配")
        return None
    
    try:
        frame = TransferFrame.from_bytes(raw_bytes)
        
        # 验证CRC
        if not frame.verify_crc():
            print("帧CRC校验失败")
            return None
        
        # 验证所有子消息
        for msg in frame.messages:
            if not msg.verify_crc():
                print(f"消息 {msg.msg_id:04X} CRC校验失败")
                # 可以选择继续处理或丢弃
        
        return frame
        
    except ValueError as e:
        print(f"解析错误: {e}")
        return None
```

## 与WebSocket服务集成

```python
# 在 ws_service.py 中使用通信协议

from server.protocol import TransferFrame, SubMessage

class WsService:
    async def send_protocol_frame(self, client_id: str, frame: TransferFrame):
        """发送协议帧给客户端"""
        frame_bytes = frame.to_bytes()
        # 转为base64或hex以便通过WebSocket传输
        import base64
        encoded = base64.b64encode(frame_bytes).decode('ascii')
        await self.send_to_client(client_id, encoded)
    
    async def handle_protocol_message(self, client_id: str, data: str):
        """处理收到的协议消息"""
        import base64
        try:
            # 解码base64
            frame_bytes = base64.b64decode(data)
            
            # 解析帧
            frame = TransferFrame.from_bytes(frame_bytes)
            
            # 处理消息
            for msg in frame.messages:
                await self.process_sub_message(client_id, msg)
                
        except Exception as e:
            print(f"协议消息处理失败: {e}")
    
    async def process_sub_message(self, client_id: str, msg: SubMessage):
        """处理单条子消息"""
        if msg.msg_id == 0x0101:  # 遥测数据
            await self.handle_telemetry(client_id, msg.data)
        elif msg.msg_id == 0x0201:  # 控制命令
            await self.handle_command(client_id, msg.data)
        # ... 其他消息类型
```

## 测试

运行测试脚本验证协议实现:

```bash
python server/protocol/test_protocol.py
```

测试覆盖:
- 子消息编解码
- 传输帧编解码
- 空载荷处理
- CRC错误检测
- 字段边界值

## 注意事项

1. **字节序**: 协议使用大端模式（Big-Endian）
2. **CRC计算**: 消息级CRC覆盖Msg_ID + Dest_ID + Data_Length + Data
3. **帧CRC计算**: 覆盖Version + SCID + VCID + Frame_Count + Packet_Type + Dest_ID + Packet_ID + Packet_Length + Payload
4. **广播地址**: Dest_ID = 0xFFFF 表示广播消息
5. **字段限制**: 
   - Version: 4位 (0-15)
   - VCID: 4位 (0-15)
   - SCID/Dest_ID/Packet_ID/Frame_Count: 16位 (0-65535)
   - Packet_Type: 8位 (0-255)
