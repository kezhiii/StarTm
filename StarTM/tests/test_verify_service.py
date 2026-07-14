import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from server.services.verify_service import VerifyService
from server.protocol.transfer_frame import SubMessage


@pytest.fixture
def service():
    return VerifyService(num_satellites=22)


def test_set_neighbor_map(service):
    """Test setting neighbor topology"""
    neighbor_map = {
        0: [1, 2],
        1: [0, 3],
        2: [0, 3],
    }
    service.set_neighbor_map(neighbor_map)
    
    assert service.get_neighbors(0) == [1, 2]
    assert service.get_neighbors(1) == [0, 3]
    assert service.get_neighbors(2) == [0, 3]
    assert service.get_neighbors(5) == []


def test_store_and_get_submessage(service):
    """Test storing and retrieving submessages"""
    msg = SubMessage(
        msg_id=0,
        dest_id=0,
        data=bytes([0x01, 0x01]),
    )
    
    service.store_submessages(0, [msg])
    stored = service.get_stored_message(0, 0)
    
    assert stored is not None
    assert stored.msg_id == 0
    assert stored.dest_id == 0
    assert stored.data == bytes([0x01, 0x01])


def test_store_multiple_submessages(service):
    """Test storing multiple submessages for one satellite"""
    messages = [
        SubMessage(msg_id=0, dest_id=0, data=bytes([0x01, 0x01])),
        SubMessage(msg_id=1, dest_id=1, data=bytes([0x02, 0x00])),
        SubMessage(msg_id=2, dest_id=2, data=bytes([0x01, 0x01])),
    ]
    
    service.store_submessages(0, messages)
    
    assert service.get_stored_message(0, 0) is not None
    assert service.get_stored_message(0, 1) is not None
    assert service.get_stored_message(0, 2) is not None
    assert service.get_stored_message(0, 3) is None


def test_clear_and_reset(service):
    """Test clearing satellite data and full reset"""
    msg = SubMessage(msg_id=0, dest_id=0, data=bytes([0x01, 0x01]))
    service.store_submessages(0, [msg])
    service.set_neighbor_map({0: [1, 2]})
    
    service.clear_satellite_data(0)
    assert service.get_stored_message(0, 0) is None
    
    service.reset_all()
    assert service.get_neighbors(0) == []
