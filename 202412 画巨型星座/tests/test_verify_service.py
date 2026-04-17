import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from server.services.verify_service import VerifyService
from server.protocol.transfer_frame import SubMessage, calc_crc32


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


def test_verify_responses_consistent(service):
    """Test verification when all neighbors agree"""
    data = bytes([0x01, 0x01])
    dest_id = 0
    
    crc_data = bytes([dest_id >> 8, dest_id & 0xFF, len(data) >> 8, len(data) & 0xFF]) + data
    crc = calc_crc32(crc_data)
    
    responses = [
        SubMessage(msg_id=0, dest_id=dest_id, data=data),
        SubMessage(msg_id=0, dest_id=dest_id, data=data),
    ]
    responses[0].crc_msg = crc
    responses[1].crc_msg = crc
    
    success, recovered_data, error = service.verify_responses(responses, dest_id, 0)
    
    assert success is True
    assert recovered_data == data
    assert error == ""


def test_verify_responses_inconsistent(service):
    """Test verification when neighbors disagree"""
    data1 = bytes([0x01, 0x01])
    data2 = bytes([0x02, 0x00])
    dest_id = 0
    
    crc_data1 = bytes([dest_id >> 8, dest_id & 0xFF, len(data1) >> 8, len(data1) & 0xFF]) + data1
    crc_data2 = bytes([dest_id >> 8, dest_id & 0xFF, len(data2) >> 8, len(data2) & 0xFF]) + data2
    crc1 = calc_crc32(crc_data1)
    crc2 = calc_crc32(crc_data2)
    
    responses = [
        SubMessage(msg_id=0, dest_id=dest_id, data=data1),
        SubMessage(msg_id=0, dest_id=dest_id, data=data2),
    ]
    responses[0].crc_msg = crc1
    responses[1].crc_msg = crc2
    
    success, recovered_data, error = service.verify_responses(responses, dest_id, 0)
    
    assert success is False
    assert recovered_data is None
    assert "mismatch" in error.lower()


def test_verify_responses_empty(service):
    """Test verification with no responses"""
    success, recovered_data, error = service.verify_responses([], 0, 0)
    
    assert success is False
    assert recovered_data is None
    assert "No responses" in error


def test_handle_verify_request(service):
    """Test handling verify request"""
    msg = SubMessage(msg_id=0, dest_id=0, data=bytes([0x01, 0x01]))
    service.store_submessages(0, [msg])
    
    responses = service.handle_verify_request(0, 0)
    
    assert len(responses) == 1
    assert responses[0].msg_id == 0
    assert responses[0].dest_id == 0
    assert responses[0].data == bytes([0x01, 0x01])


def test_handle_verify_request_not_found(service):
    """Test handling verify request for non-existent message"""
    responses = service.handle_verify_request(0, 99)
    
    assert len(responses) == 0


def test_clear_and_reset(service):
    """Test clearing satellite data and full reset"""
    msg = SubMessage(msg_id=0, dest_id=0, data=bytes([0x01, 0x01]))
    service.store_submessages(0, [msg])
    service.set_neighbor_map({0: [1, 2]})
    
    service.clear_satellite_data(0)
    assert service.get_stored_message(0, 0) is None
    
    service.reset_all()
    assert service.get_neighbors(0) == []


def test_verify_responses_majority_vote(service):
    """Test majority vote when 2 of 3 neighbors agree"""
    data_correct = bytes([0x01, 0x01])
    data_wrong = bytes([0x02, 0x00])
    dest_id = 0
    
    crc_data_correct = bytes([dest_id >> 8, dest_id & 0xFF, len(data_correct) >> 8, len(data_correct) & 0xFF]) + data_correct
    crc_data_wrong = bytes([dest_id >> 8, dest_id & 0xFF, len(data_wrong) >> 8, len(data_wrong) & 0xFF]) + data_wrong
    crc_correct = calc_crc32(crc_data_correct)
    crc_wrong = calc_crc32(crc_data_wrong)
    
    responses = [
        SubMessage(msg_id=0, dest_id=dest_id, data=data_correct),
        SubMessage(msg_id=0, dest_id=dest_id, data=data_correct),
        SubMessage(msg_id=0, dest_id=dest_id, data=data_wrong),
    ]
    responses[0].crc_msg = crc_correct
    responses[1].crc_msg = crc_correct
    responses[2].crc_msg = crc_wrong
    
    success, recovered_data, error = service.verify_responses(responses, dest_id, 0)
    
    assert success is True
    assert recovered_data == data_correct
