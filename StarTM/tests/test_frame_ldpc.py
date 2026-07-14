import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from server.protocol import TransferFrame, SubMessage, LDPCCodec
from server.protocol.constants import PacketType

def test_frame_ldpc_roundtrip():
    """Test frame LDPC encode-decode roundtrip"""
    msg = SubMessage(msg_id=0x0101, dest_id=0x0003, data=b"\x01\x01")
    frame = TransferFrame(
        version=1,
        scid=0x0001,
        vcid=0,
        frame_count=100,
        packet_type=PacketType.LIGHT_CONTROL,
        dest_id=0x0003,
        packet_id=0x0001,
        messages=[msg]
    )
    
    codec = LDPCCodec()
    
    # Encode
    frame_bytes = frame.to_bytes()
    ldpc_data = codec.encode(frame_bytes)
    
    # Decode
    decoded_bytes = codec.decode(ldpc_data)
    
    # Parse frame
    decoded_frame = TransferFrame.from_bytes(decoded_bytes)
    
    assert decoded_frame.version == frame.version
    assert decoded_frame.scid == frame.scid
    assert decoded_frame.packet_type == frame.packet_type
    assert len(decoded_frame.messages) == 1
    assert decoded_frame.messages[0].data == b"\x01\x01"

def test_frame_to_ldpc_bytes():
    """Test TransferFrame direct LDPC output"""
    msg = SubMessage(msg_id=0x0101, dest_id=0x0001, data=b"\x01\x01")
    frame = TransferFrame(
        version=1,
        scid=0x0001,
        vcid=0,
        frame_count=1,
        packet_type=PacketType.LIGHT_CONTROL,
        dest_id=0x0001,
        packet_id=0x0001,
        messages=[msg]
    )
    
    ldpc_bytes = frame.to_ldpc_bytes()
    assert ldpc_bytes.startswith(b"\x55\xAA")  # LDPC_PREAMBLE
    
    # Decode should restore frame
    decoded_frame = TransferFrame.from_ldpc_bytes(ldpc_bytes)
    assert decoded_frame.packet_type == PacketType.LIGHT_CONTROL
    assert len(decoded_frame.messages) == 1
    assert decoded_frame.messages[0].dest_id == 0x0001
