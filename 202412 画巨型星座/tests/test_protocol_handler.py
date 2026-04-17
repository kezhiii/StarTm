import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from server.services.protocol_handler import ProtocolHandler
from server.services.light_control import LightControlService
from server.protocol import TransferFrame, SubMessage, LDPCCodec
from server.protocol.constants import PacketType, MsgType, LightCommand

@pytest.fixture
def light_service():
    return LightControlService()

@pytest.fixture
def handler(light_service):
    return ProtocolHandler(light_service=light_service)

def test_handle_light_control_frame(handler, light_service):
    """Test handling light control frame"""
    msg = SubMessage(
        msg_id=MsgType.LIGHT_CONTROL,
        dest_id=3,
        data=bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
    )
    frame = TransferFrame(
        version=1,
        scid=0x0001,
        vcid=0,
        frame_count=100,
        packet_type=PacketType.LIGHT_CONTROL,
        dest_id=0xFFFF,  # broadcast
        packet_id=0x0001,
        messages=[msg]
    )
    
    frame_bytes = frame.to_bytes()
    result = handler.handle_frame(frame_bytes)
    
    assert result["success"] is True
    assert result["type"] == "light_control"
    assert light_service.get_light(3) is True

def test_handle_ldpc_encoded_frame(handler, light_service):
    """Test handling LDPC-encoded frame"""
    msg = SubMessage(
        msg_id=MsgType.LIGHT_CONTROL,
        dest_id=5,
        data=bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
    )
    frame = TransferFrame(
        version=1,
        scid=0x0001,
        vcid=0,
        frame_count=101,
        packet_type=PacketType.LIGHT_CONTROL,
        dest_id=0xFFFF,
        packet_id=0x0002,
        messages=[msg]
    )
    
    codec = LDPCCodec()
    ldpc_bytes = frame.to_ldpc_bytes(codec)
    result = handler.handle_ldpc_frame(ldpc_bytes, codec)
    
    assert result["success"] is True
    assert light_service.get_light(5) is True

def test_handle_unknown_packet_type(handler):
    """Test handling unknown packet type"""
    frame = TransferFrame(
        version=1,
        scid=0x0001,
        vcid=0,
        frame_count=102,
        packet_type=0x05,  # unknown type
        dest_id=0xFFFF,
        packet_id=0x0003,
        messages=[]
    )
    
    result = handler.handle_frame(frame.to_bytes())
    assert result["success"] is False
    assert "unknown" in result.get("error", "").lower()

def test_handle_invalid_satellite_id(handler):
    """Test handling invalid satellite ID"""
    msg = SubMessage(
        msg_id=MsgType.LIGHT_CONTROL,
        dest_id=99,  # invalid ID
        data=bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
    )
    frame = TransferFrame(
        version=1,
        scid=0x0001,
        vcid=0,
        frame_count=103,
        packet_type=PacketType.LIGHT_CONTROL,
        dest_id=0xFFFF,
        packet_id=0x0004,
        messages=[msg]
    )
    
    result = handler.handle_frame(frame.to_bytes())
    assert result["success"] is False

def test_handle_multiple_messages_in_frame(handler, light_service):
    """Test handling multiple messages in one frame"""
    messages = [
        SubMessage(
            msg_id=MsgType.LIGHT_CONTROL,
            dest_id=1,
            data=bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
        ),
        SubMessage(
            msg_id=MsgType.LIGHT_CONTROL,
            dest_id=2,
            data=bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
        ),
    ]
    frame = TransferFrame(
        version=1,
        scid=0x0001,
        vcid=0,
        frame_count=104,
        packet_type=PacketType.LIGHT_CONTROL,
        dest_id=0xFFFF,
        packet_id=0x0005,
        messages=messages
    )
    
    result = handler.handle_frame(frame.to_bytes())
    
    assert result["success"] is True
    assert light_service.get_light(1) is True
    assert light_service.get_light(2) is True
