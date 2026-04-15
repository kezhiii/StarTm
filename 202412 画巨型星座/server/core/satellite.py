"""
卫星类

封装单颗卫星的完整状态和行为。
"""

from __future__ import annotations
from dataclasses import dataclass, field

from .orbit_elements import OrbitElements
from .inertial_state import InertialState
from .physical_props import PhysicalProps


@dataclass
class Satellite:
    """
    单颗卫星的状态和行为封装。
    
    属性:
        sat_id: 卫星编号
        orbit_elements: 轨道根数
        inertial_state: 惯性状态
        physical_props: 物理属性
        light_state: 灯光状态 (True=开灯, False=关灯)
    """
    sat_id: int
    orbit_elements: OrbitElements
    inertial_state: InertialState
    physical_props: PhysicalProps = field(default_factory=PhysicalProps.default)
    light_state: bool = False
    
    def to_snapshot(self, timestamp: str) -> dict:
        """
        生成用于前端传输的快照数据。
        
        Args:
            timestamp: 时间戳字符串 (如 "20210817053300")
        
        Returns:
            字典格式，兼容现有前端数据格式
        """
        oe = self.orbit_elements.to_array()  # [a(km), e, i(deg), ...]
        inertial = self.inertial_state.to_array()  # [X(km), Y(km), Z(km), ...]
        
        return {
            'timestamp': timestamp,
            'sat_id': self.sat_id,
            'a': oe[0],
            'e': oe[1],
            'i': oe[2],
            'OMG': oe[3],
            'omg': oe[4],
            'f': oe[5],
            'X': inertial[0],
            'Y': inertial[1],
            'Z': inertial[2],
            'Vx': inertial[3],
            'Vy': inertial[4],
            'Vz': inertial[5]
        }
    
    def to_array(self) -> list:
        """
        转换为紧凑数组格式（用于 WebSocket 传输）。
        
        Returns:
            [timestamp, sat_id, a, e, i, OMG, omg, f, X, Y, Z, Vx, Vy, Vz]
            注意：timestamp 由调用方填充
        """
        oe = self.orbit_elements.to_array()
        inertial = self.inertial_state.to_array()
        
        return [
            0,          # timestamp 占位符，由调用方填充
            self.sat_id,
            oe[0], oe[1], oe[2], oe[3], oe[4], oe[5],
            inertial[0], inertial[1], inertial[2],
            inertial[3], inertial[4], inertial[5]
        ]
    
    def update_orbit_elements(self, new_oe: OrbitElements) -> None:
        """更新轨道根数"""
        object.__setattr__(self, 'orbit_elements', new_oe)
    
    def update_inertial_state(self, new_state: InertialState) -> None:
        """更新惯性状态"""
        object.__setattr__(self, 'inertial_state', new_state)
    
    def toggle_light(self) -> bool:
        """切换灯光状态"""
        self.light_state = not self.light_state
        return self.light_state
    
    def __repr__(self) -> str:
        return f"Satellite(id={self.sat_id}, {self.orbit_elements})"
