import pytest
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from server.protocol.constants import PacketType, MsgType, LightCommand

def test_packet_type_constants():
    assert PacketType.TELEMETRY == 0x01
    assert PacketType.COMMAND == 0x02
    assert PacketType.LIGHT_CONTROL == 0x03
    assert PacketType.STATUS_REPORT == 0x04
    assert PacketType.VERIFY_REQUEST == 0xFE
    assert PacketType.VERIFY_RESPONSE == 0xFF

def test_msg_type_constants():
    assert MsgType.LIGHT_CONTROL == 0x0101
    assert MsgType.STATUS_REPORT == 0x0201
    assert MsgType.TELEMETRY == 0x0301
    assert MsgType.ERROR_REPORT == 0x0401

def test_light_command_constants():
    assert LightCommand.TURN_ON == 0x01
    assert LightCommand.TURN_OFF == 0x02
    assert LightCommand.STATE_OFF == 0x00
    assert LightCommand.STATE_ON == 0x01
