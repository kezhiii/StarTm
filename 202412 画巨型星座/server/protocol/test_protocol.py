"""
通信协议测试脚本

用于验证TransferFrame和SubMessage的编解码功能
"""

import sys
sys.path.insert(0, "E:\\project_code\\serproject\\202412 画巨型星座")

from server.protocol import TransferFrame, SubMessage, calc_crc32


def test_sub_message():
    """测试子消息的编解码"""
    print("=" * 60)
    print("测试 SubMessage 编解码")
    print("=" * 60)
    
    # 创建子消息
    original_data = b"Hello, Satellite!"
    msg = SubMessage(
        msg_id=0x0001,
        dest_id=0x0002,
        data=original_data
    )
    
    print(f"原始消息: msg_id={msg.msg_id}, dest_id={msg.dest_id}, data_length={msg.data_length}")
    print(f"原始数据: {msg.data}")
    print(f"消息CRC: {msg.crc_msg:08X}")
    
    # 序列化
    msg_bytes = msg.to_bytes()
    print(f"序列化后长度: {len(msg_bytes)} bytes")
    print(f"序列化数据 (hex): {msg_bytes.hex()}")
    
    # 反序列化
    parsed_msg = SubMessage.from_bytes(msg_bytes)
    print(f"\n解析后消息: msg_id={parsed_msg.msg_id}, dest_id={parsed_msg.dest_id}, data_length={parsed_msg.data_length}")
    print(f"解析后数据: {parsed_msg.data}")
    print(f"CRC校验: {'PASS' if parsed_msg.verify_crc() else 'FAIL'}")
    
    # 验证数据一致性
    assert msg.msg_id == parsed_msg.msg_id, "Msg_ID 不匹配"
    assert msg.dest_id == parsed_msg.dest_id, "Dest_ID 不匹配"
    assert msg.data == parsed_msg.data, "Data 不匹配"
    assert msg.verify_crc(), "CRC校验失败"
    
    print("\n[PASS] SubMessage 测试通过")
    print()


def test_transfer_frame():
    """测试传输帧的编解码"""
    print("=" * 60)
    print("测试 TransferFrame 编解码")
    print("=" * 60)
    
    # 创建多个子消息
    msg1 = SubMessage(msg_id=0x0001, dest_id=0x0002, data=b"Telemetry Data")
    msg2 = SubMessage(msg_id=0x0002, dest_id=0x0003, data=b"Status Report: OK")
    msg3 = SubMessage(msg_id=0x0003, dest_id=0xFFFF, data=b"Broadcast Message")
    
    # 创建传输帧
    frame = TransferFrame(
        version=1,
        scid=0x1234,
        vcid=0,
        frame_count=100,
        packet_type=0x01,
        dest_id=0x0002,
        packet_id=0x0001,
        messages=[msg1, msg2, msg3]
    )
    
    print(f"原始帧信息:")
    print(f"  Sync: {frame.sync.hex()}")
    print(f"  Version: {frame.version}")
    print(f"  SCID: {frame.scid:04X}")
    print(f"  VCID: {frame.vcid}")
    print(f"  Frame_Count: {frame.frame_count}")
    print(f"  Packet_Type: {frame.packet_type}")
    print(f"  Dest_ID: {frame.dest_id:04X}")
    print(f"  Packet_ID: {frame.packet_id:04X}")
    print(f"  消息数量: {len(frame.messages)}")
    print(f"  帧CRC: {frame.crc:08X}")
    print(f"  预计总长度: {frame.get_total_length()} bytes")
    
    # 序列化
    frame_bytes = frame.to_bytes()
    print(f"\n序列化后长度: {len(frame_bytes)} bytes")
    print(f"序列化数据 (hex): {frame_bytes.hex()}")
    
    # 反序列化
    parsed_frame = TransferFrame.from_bytes(frame_bytes)
    print(f"\n解析后帧信息:")
    print(f"  Sync: {parsed_frame.sync.hex()}")
    print(f"  Version: {parsed_frame.version}")
    print(f"  SCID: {parsed_frame.scid:04X}")
    print(f"  VCID: {parsed_frame.vcid}")
    print(f"  Frame_Count: {parsed_frame.frame_count}")
    print(f"  Packet_Type: {parsed_frame.packet_type}")
    print(f"  Dest_ID: {parsed_frame.dest_id:04X}")
    print(f"  Packet_ID: {parsed_frame.packet_id:04X}")
    print(f"  消息数量: {len(parsed_frame.messages)}")
    print(f"  帧CRC: {parsed_frame.crc:08X}")
    print(f"  CRC校验: {'PASS' if parsed_frame.verify_crc() else 'FAIL'}")
    
    # 验证帧字段
    assert frame.sync == parsed_frame.sync, "Sync 不匹配"
    assert frame.version == parsed_frame.version, "Version 不匹配"
    assert frame.scid == parsed_frame.scid, "SCID 不匹配"
    assert frame.vcid == parsed_frame.vcid, "VCID 不匹配"
    assert frame.frame_count == parsed_frame.frame_count, "Frame_Count 不匹配"
    assert frame.packet_type == parsed_frame.packet_type, "Packet_Type 不匹配"
    assert frame.dest_id == parsed_frame.dest_id, "Dest_ID 不匹配"
    assert frame.packet_id == parsed_frame.packet_id, "Packet_ID 不匹配"
    assert len(frame.messages) == len(parsed_frame.messages), "消息数量不匹配"
    assert parsed_frame.verify_crc(), "帧CRC校验失败"
    
    # 验证子消息
    for i, (orig_msg, parsed_msg) in enumerate(zip(frame.messages, parsed_frame.messages)):
        assert orig_msg.msg_id == parsed_msg.msg_id, f"消息{i} Msg_ID 不匹配"
        assert orig_msg.dest_id == parsed_msg.dest_id, f"消息{i} Dest_ID 不匹配"
        assert orig_msg.data == parsed_msg.data, f"消息{i} Data 不匹配"
        assert parsed_msg.verify_crc(), f"消息{i} CRC校验失败"
        print(f"  子消息 {i+1}: msg_id={parsed_msg.msg_id:04X}, dest_id={parsed_msg.dest_id:04X}, data='{parsed_msg.data.decode()}'")
    
    print("\n[PASS] TransferFrame 测试通过")
    print()


def test_empty_frame():
    """测试空载荷的传输帧"""
    print("=" * 60)
    print("测试空载荷 TransferFrame")
    print("=" * 60)
    
    frame = TransferFrame(
        version=1,
        scid=0x1234,
        vcid=0,
        frame_count=0,
        packet_type=0x00,
        dest_id=0xFFFF,
        packet_id=0x0000,
        messages=[]  # 空消息列表
    )
    
    print(f"空帧信息: scid={frame.scid:04X}, dest_id={frame.dest_id:04X}")
    
    frame_bytes = frame.to_bytes()
    print(f"序列化长度: {len(frame_bytes)} bytes")
    
    parsed_frame = TransferFrame.from_bytes(frame_bytes)
    print(f"解析后: 消息数量={len(parsed_frame.messages)}")
    
    assert len(parsed_frame.messages) == 0, "空载荷应包含0条消息"
    assert parsed_frame.verify_crc(), "空帧CRC校验失败"
    
    print("\n[PASS] 空载荷测试通过")
    print()


def test_crc_error_detection():
    """测试CRC错误检测"""
    print("=" * 60)
    print("测试 CRC 错误检测")
    print("=" * 60)
    
    msg = SubMessage(msg_id=0x0001, dest_id=0x0002, data=b"Test Data")
    frame = TransferFrame(
        version=1,
        scid=0x1234,
        vcid=0,
        frame_count=1,
        packet_type=0x01,
        dest_id=0x0002,
        packet_id=0x0001,
        messages=[msg]
    )
    
    frame_bytes = frame.to_bytes()
    
    # 模拟数据损坏（修改一个字节）
    corrupted_bytes = bytearray(frame_bytes)
    corrupted_bytes[20] ^= 0xFF  # 翻转Payload中的一个字节
    
    try:
        TransferFrame.from_bytes(bytes(corrupted_bytes))
        print("[FAIL] 错误: 损坏的数据应触发CRC校验失败")
        return False
    except ValueError as e:
        print(f"[PASS] CRC错误被正确检测: {e}")
    
    print("\n[PASS] CRC错误检测测试通过")
    print()


def test_frame_limits():
    """测试字段边界值"""
    print("=" * 60)
    print("测试字段边界值")
    print("=" * 60)
    
    # 测试最大值
    frame = TransferFrame(
        version=15,      # 4位最大值
        scid=0xFFFF,     # 16位最大值
        vcid=15,         # 4位最大值
        frame_count=0xFFFF,  # 16位最大值
        packet_type=0xFF,    # 8位最大值
        dest_id=0xFFFF,      # 16位最大值
        packet_id=0xFFFF,    # 16位最大值
        messages=[]
    )
    
    frame_bytes = frame.to_bytes()
    parsed_frame = TransferFrame.from_bytes(frame_bytes)
    
    assert parsed_frame.version == 15, "Version 应为15"
    assert parsed_frame.scid == 0xFFFF, "SCID 应为0xFFFF"
    assert parsed_frame.vcid == 15, "VCID 应为15"
    assert parsed_frame.frame_count == 0xFFFF, "Frame_Count 应为0xFFFF"
    assert parsed_frame.dest_id == 0xFFFF, "Dest_ID 应为0xFFFF"
    
    print(f"边界值测试通过: version={parsed_frame.version}, scid={parsed_frame.scid:04X}")
    print("\n[PASS] 边界值测试通过")
    print()


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("通信协议测试套件")
    print("=" * 60 + "\n")
    
    try:
        test_sub_message()
        test_transfer_frame()
        test_empty_frame()
        test_crc_error_detection()
        test_frame_limits()
        
        print("=" * 60)
        print("[SUCCESS] 所有测试通过！")
        print("=" * 60)
        return True
    except Exception as e:
        print("\n" + "=" * 60)
        print(f"[FAILED] 测试失败: {e}")
        print("=" * 60)
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
