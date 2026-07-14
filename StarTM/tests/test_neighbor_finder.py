import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from server.services.neighbor_finder import NeighborFinder


@pytest.fixture
def finder():
    return NeighborFinder(neighbor_count=2)


def test_find_neighbors_basic(finder):
    """Test basic neighbor discovery"""
    positions = {
        0: (0.0, 0.0, 0.0),
        1: (1.0, 0.0, 0.0),
        2: (2.0, 0.0, 0.0),
        3: (10.0, 0.0, 0.0),
    }
    neighbors = finder.find_neighbors(positions)
    
    assert 0 in neighbors
    assert 1 in neighbors
    assert 2 in neighbors
    assert 3 in neighbors
    
    assert neighbors[0] == [1, 2]
    assert neighbors[1] == [0, 2]
    assert neighbors[2] == [1, 0]
    assert neighbors[3] == [2, 1]


def test_find_neighbors_3d(finder):
    """Test neighbor discovery in 3D space"""
    positions = {
        0: (0.0, 0.0, 0.0),
        1: (1.0, 1.0, 1.0),
        2: (10.0, 10.0, 10.0),
    }
    neighbors = finder.find_neighbors(positions)
    
    assert neighbors[0] == [1, 2]
    assert neighbors[1] == [0, 2]
    assert neighbors[2] == [1, 0]


def test_find_neighbors_single(finder):
    """Test with single satellite"""
    positions = {0: (0.0, 0.0, 0.0)}
    neighbors = finder.find_neighbors(positions)
    
    assert neighbors[0] == []


def test_find_neighbors_two(finder):
    """Test with two satellites"""
    positions = {
        0: (0.0, 0.0, 0.0),
        1: (5.0, 5.0, 5.0),
    }
    neighbors = finder.find_neighbors(positions)
    
    assert neighbors[0] == [1]
    assert neighbors[1] == [0]


def test_find_neighbors_custom_count():
    """Test with custom neighbor count"""
    finder = NeighborFinder(neighbor_count=3)
    positions = {
        0: (0.0, 0.0, 0.0),
        1: (1.0, 0.0, 0.0),
        2: (2.0, 0.0, 0.0),
        3: (3.0, 0.0, 0.0),
        4: (4.0, 0.0, 0.0),
    }
    neighbors = finder.find_neighbors(positions)
    
    assert len(neighbors[0]) == 3
    assert neighbors[0] == [1, 2, 3]


def test_find_neighbors_asymmetric():
    """Test that neighbor relationships can be asymmetric"""
    finder = NeighborFinder(neighbor_count=1)
    positions = {
        0: (0.0, 0.0, 0.0),
        1: (1.0, 0.0, 0.0),
        2: (1.1, 0.0, 0.0),
    }
    neighbors = finder.find_neighbors(positions)
    
    assert neighbors[0] == [1]
    assert neighbors[1] == [2]
    assert neighbors[2] == [1]
