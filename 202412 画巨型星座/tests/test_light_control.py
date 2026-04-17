import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from server.services.light_control import LightControlService
from server.protocol.constants import LightCommand

@pytest.fixture
def service():
    return LightControlService()

def test_set_light_on(service):
    """Test turning light on"""
    result = service.set_light(sat_id=3, command=LightCommand.TURN_ON)
    assert result is True
    assert service.get_light(3) is True

def test_set_light_off(service):
    """Test turning light off"""
    service.set_light(sat_id=5, command=LightCommand.TURN_ON)
    result = service.set_light(sat_id=5, command=LightCommand.TURN_OFF)
    assert result is True
    assert service.get_light(5) is False

def test_get_light_default_off(service):
    """Test default light state is off"""
    assert service.get_light(0) is False
    assert service.get_light(21) is False

def test_toggle_light(service):
    """Test toggling light"""
    service.set_light(sat_id=1, command=LightCommand.TURN_ON)
    service.toggle_light(sat_id=1)
    assert service.get_light(1) is False
    service.toggle_light(sat_id=1)
    assert service.get_light(1) is True

def test_get_all_states(service):
    """Test getting all satellite light states"""
    service.set_light(sat_id=1, command=LightCommand.TURN_ON)
    service.set_light(sat_id=3, command=LightCommand.TURN_ON)
    states = service.get_all_states()
    assert states[1] is True
    assert states[3] is True
    assert states[0] is False

def test_light_control_data_parsing(service):
    """Test parsing light control data"""
    data_on = bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
    result = service.parse_light_data(data_on)
    assert result == (LightCommand.TURN_ON, LightCommand.STATE_ON)
    
    data_off = bytes([LightCommand.TURN_OFF, LightCommand.STATE_OFF])
    result = service.parse_light_data(data_off)
    assert result == (LightCommand.TURN_OFF, LightCommand.STATE_OFF)

def test_apply_light_data(service):
    """Test parsing and applying light control data"""
    data_on = bytes([LightCommand.TURN_ON, LightCommand.STATE_ON])
    assert service.apply_light_data(sat_id=7, data=data_on) is True
    assert service.get_light(7) is True
    
    data_off = bytes([LightCommand.TURN_OFF, LightCommand.STATE_OFF])
    assert service.apply_light_data(sat_id=7, data=data_off) is True
    assert service.get_light(7) is False

def test_invalid_satellite_id(service):
    """Test invalid satellite ID raises error"""
    with pytest.raises(ValueError):
        service.set_light(sat_id=99, command=LightCommand.TURN_ON)
    
    with pytest.raises(ValueError):
        service.set_light(sat_id=-1, command=LightCommand.TURN_ON)

def test_reset_all(service):
    """Test resetting all lights"""
    service.set_light(sat_id=1, command=LightCommand.TURN_ON)
    service.set_light(sat_id=5, command=LightCommand.TURN_ON)
    service.reset_all()
    assert service.get_light(1) is False
    assert service.get_light(5) is False
