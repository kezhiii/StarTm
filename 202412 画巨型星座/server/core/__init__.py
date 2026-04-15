"""
核心领域模型模块

提供卫星、星座、轨道根数、惯性状态等核心领域对象。
"""

from .orbit_elements import OrbitElements
from .inertial_state import InertialState
from .physical_props import PhysicalProps
from .satellite import Satellite
from .frame_data import FrameData, SatelliteSnapshot
from .constellation import Constellation
from .propagation_state import PropagationState
from . import exceptions

__all__ = [
    'OrbitElements',
    'InertialState',
    'PhysicalProps',
    'Satellite',
    'FrameData',
    'SatelliteSnapshot',
    'Constellation',
    'PropagationState',
    'exceptions',
]
