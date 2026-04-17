"""
端到端集成测试

测试完整的灯光控制流程：
地面站 → LDPC编码 → TransferFrame → WebSocket → 协议解析 → 灯光控制
"""

import base64
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from server.protocol import TransferFrame, SubMessage, LDPCCodec
from server.protocol.constants import PacketType, MsgType, LightCommand
from server.services.protocol_handler import ProtocolHandler
from server.services.light_control import LightControlService


class TestEndToEndLightControl:
    """End-to-end light control tests"""
    
    @pytest.fixture
    def codec(self):
        return LDPCCodec()
    
    @pytest.fixture
    def light_service(self):
        return LightControlService()
    
    @pytest.fixture
    def handler(self, light_service):
        return ProtocolHandler(light_service=light_service)
    
    def test_ground_station_to_satellite(self, codec, handler, light_service):
        """Simulate ground station sending light control frame to satellite"""
        # 1. Ground station creates light control message
        msg = SubMessage(
            msg_id=MsgType.LIGHT_CONTROL,
            dest_id=7,
            data=bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
        )
        
        # 2. Create transfer frame
        frame = TransferFrame(
            version=1,
            scid=0x0001,
            vcid=0,
            frame_count=1000,
            packet_type=PacketType.LIGHT_CONTROL,
            dest_id=0xFFFF,
            packet_id=0x0001,
            messages=[msg]
        )
        
        # 3. LDPC encode
        frame_bytes = frame.to_bytes()
        ldpc_data = codec.encode(frame_bytes)
        
        # 4. Simulate WebSocket transport (base64 encode)
        transmitted = base64.b64encode(ldpc_data).decode('ascii')
        
        # 5. Receiver decodes
        received_ldpc = base64.b64decode(transmitted)
        
        # 6. Protocol handling
        result = handler.handle_ldpc_frame(received_ldpc, codec)
        
        # 7. Verify light state
        assert result["success"] is True
        assert light_service.get_light(7) is True
    
    def test_multiple_satellites_single_frame(self, codec, handler, light_service):
        """Control multiple satellites with single frame"""
        messages = [
            SubMessage(
                msg_id=MsgType.LIGHT_CONTROL,
                dest_id=i,
                data=bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
            )
            for i in range(1, 6)
        ]
        
        frame = TransferFrame(
            version=1,
            scid=0x0001,
            vcid=0,
            frame_count=1001,
            packet_type=PacketType.LIGHT_CONTROL,
            dest_id=0xFFFF,
            packet_id=0x0002,
            messages=messages
        )
        
        ldpc_data = codec.encode(frame.to_bytes())
        result = handler.handle_ldpc_frame(ldpc_data, codec)
        
        assert result["success"] is True
        for i in range(1, 6):
            assert light_service.get_light(i) is True
    
    def test_turn_off_after_turn_on(self, codec, handler, light_service):
        """Turn on then turn off"""
        # Turn on
        msg_on = SubMessage(
            msg_id=MsgType.LIGHT_CONTROL,
            dest_id=10,
            data=bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
        )
        frame_on = TransferFrame(
            version=1, scid=0x0001, vcid=0, frame_count=1002,
            packet_type=PacketType.LIGHT_CONTROL, dest_id=0xFFFF,
            packet_id=0x0003, messages=[msg_on]
        )
        handler.handle_ldpc_frame(codec.encode(frame_on.to_bytes()), codec)
        assert light_service.get_light(10) is True
        
        # Turn off
        msg_off = SubMessage(
            msg_id=MsgType.LIGHT_CONTROL,
            dest_id=10,
            data=bytes([LightCommand.TURN_OFF, LightCommand.STATE_OFF])
        )
        frame_off = TransferFrame(
            version=1, scid=0x0001, vcid=0, frame_count=1003,
            packet_type=PacketType.LIGHT_CONTROL, dest_id=0xFFFF,
            packet_id=0x0004, messages=[msg_off]
        )
        handler.handle_ldpc_frame(codec.encode(frame_off.to_bytes()), codec)
        assert light_service.get_light(10) is False
    
    def test_corrupted_frame_detected(self, codec, handler):
        """Test that corrupted frames are detected"""
        msg = SubMessage(
            msg_id=MsgType.LIGHT_CONTROL,
            dest_id=3,
            data=bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
        )
        frame = TransferFrame(
            version=1, scid=0x0001, vcid=0, frame_count=1004,
            packet_type=PacketType.LIGHT_CONTROL, dest_id=0xFFFF,
            packet_id=0x0005, messages=[msg]
        )
        
        ldpc_data = bytearray(codec.encode(frame.to_bytes()))
        # Corrupt data
        if len(ldpc_data) > 20:
            ldpc_data[15] ^= 0xFF
        
        result = handler.handle_ldpc_frame(bytes(ldpc_data), codec)
        assert result["success"] is False
        assert "error" in result
    
    def test_websocket_message_format(self, codec, handler, light_service):
        """Test WebSocket message format for protocol frames"""
        import json
        
        msg = SubMessage(
            msg_id=MsgType.LIGHT_CONTROL,
            dest_id=15,
            data=bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
        )
        frame = TransferFrame(
            version=1, scid=0x0001, vcid=0, frame_count=1005,
            packet_type=PacketType.LIGHT_CONTROL, dest_id=0xFFFF,
            packet_id=0x0006, messages=[msg]
        )
        
        # Build WebSocket message (simulating what ground station sends)
        ldpc_bytes = codec.encode(frame.to_bytes())
        ws_message = json.dumps({
            "type": "protocol_frame",
            "frame": base64.b64encode(ldpc_bytes).decode('ascii'),
            "use_ldpc": True,
        })
        
        # Parse message (simulating what server does)
        parsed = json.loads(ws_message)
        raw_bytes = base64.b64decode(parsed["frame"])
        
        result = handler.handle_ldpc_frame(raw_bytes, codec)
        
        assert result["success"] is True
        assert light_service.get_light(15) is True
    
    def test_broadcast_to_all_satellites(self, codec, handler, light_service):
        """Test broadcast frame to all 22 satellites"""
        messages = [
            SubMessage(
                msg_id=MsgType.LIGHT_CONTROL,
                dest_id=i,
                data=bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
            )
            for i in range(22)
        ]
        
        frame = TransferFrame(
            version=1,
            scid=0x0001,
            vcid=0,
            frame_count=1006,
            packet_type=PacketType.LIGHT_CONTROL,
            dest_id=0xFFFF,
            packet_id=0x0007,
            messages=messages
        )
        
        ldpc_data = codec.encode(frame.to_bytes())
        result = handler.handle_ldpc_frame(ldpc_data, codec)
        
        assert result["success"] is True
        for i in range(22):
            assert light_service.get_light(i) is True
