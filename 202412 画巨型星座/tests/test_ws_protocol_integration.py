"""
Test WebSocket protocol frame integration
"""
import pytest
import asyncio
import base64
from unittest.mock import AsyncMock, MagicMock, patch
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from server.protocol import TransferFrame, SubMessage, LDPCCodec
from server.protocol.constants import PacketType, MsgType, LightCommand

def test_protocol_frame_encoding_decoding():
    """Test that protocol frames can be encoded for WebSocket transport"""
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
        dest_id=0xFFFF,
        packet_id=0x0001,
        messages=[msg]
    )
    
    # LDPC encode
    codec = LDPCCodec()
    ldpc_bytes = frame.to_ldpc_bytes(codec)
    
    # Base64 encode for WebSocket transport
    transmitted = base64.b64encode(ldpc_bytes).decode('ascii')
    
    # Simulate receiving
    received_ldpc = base64.b64decode(transmitted)
    
    # LDPC decode
    decoded_frame = TransferFrame.from_ldpc_bytes(received_ldpc, codec)
    
    assert decoded_frame.packet_type == PacketType.LIGHT_CONTROL
    assert len(decoded_frame.messages) == 1
    assert decoded_frame.messages[0].dest_id == 3
    assert decoded_frame.messages[0].data == bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])

def test_protocol_frame_message_format():
    """Test the expected WebSocket message format for protocol frames"""
    msg = SubMessage(
        msg_id=MsgType.LIGHT_CONTROL,
        dest_id=7,
        data=bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
    )
    frame = TransferFrame(
        version=1,
        scid=0x0001,
        vcid=0,
        frame_count=200,
        packet_type=PacketType.LIGHT_CONTROL,
        dest_id=0xFFFF,
        packet_id=0x0002,
        messages=[msg]
    )
    
    codec = LDPCCodec()
    ldpc_bytes = frame.to_ldpc_bytes(codec)
    
    # Build WebSocket message
    import json
    ws_message = json.dumps({
        "type": "protocol_frame",
        "frame": base64.b64encode(ldpc_bytes).decode('ascii'),
        "use_ldpc": True,
    })
    
    # Parse message
    parsed = json.loads(ws_message)
    assert parsed["type"] == "protocol_frame"
    assert "frame" in parsed
    assert parsed["use_ldpc"] is True
    
    # Decode and verify
    raw_bytes = base64.b64decode(parsed["frame"])
    decoded_frame = TransferFrame.from_ldpc_bytes(raw_bytes, codec)
    assert decoded_frame.packet_type == PacketType.LIGHT_CONTROL

def test_protocol_handler_integration():
    """Test ProtocolHandler with real frame data"""
    from server.services.protocol_handler import ProtocolHandler
    from server.services.light_control import LightControlService
    
    light_service = LightControlService()
    handler = ProtocolHandler(light_service)
    
    msg = SubMessage(
        msg_id=MsgType.LIGHT_CONTROL,
        dest_id=10,
        data=bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
    )
    frame = TransferFrame(
        version=1,
        scid=0x0001,
        vcid=0,
        frame_count=300,
        packet_type=PacketType.LIGHT_CONTROL,
        dest_id=0xFFFF,
        packet_id=0x0003,
        messages=[msg]
    )
    
    codec = LDPCCodec()
    ldpc_bytes = frame.to_ldpc_bytes(codec)
    
    result = handler.handle_ldpc_frame(ldpc_bytes, codec)
    
    assert result["success"] is True
    assert result["type"] == "light_control"
    assert light_service.get_light(10) is True
