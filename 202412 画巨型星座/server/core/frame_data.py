"""
帧数据值对象

封装某一时刻所有卫星的状态快照。
"""

from __future__ import annotations
from dataclasses import dataclass, field


@dataclass(frozen=True)
class SatelliteSnapshot:
    """
    单颗卫星的快照数据（用于前端传输）。
    """
    
    sat_id: int
    orbit_elements: list  # [a(km), e, i(deg), OMG(deg), omg(deg), f(deg)]
    position: list        # [X(km), Y(km), Z(km)]
    velocity: list        # [Vx(km/s), Vy(km/s), Vz(km/s)]


@dataclass
class FrameData:
    """
    一帧数据：所有卫星在某一时刻的状态。
    
    属性:
        timestamp: 时间戳字符串 (如 "20210817053300")
        seconds: 从起始时间经过的秒数
        satellites: 卫星快照列表
    """
    timestamp: str
    seconds: int = 0
    satellites: list = field(default_factory=list)
    
    @property
    def sat_count(self) -> int:
        """卫星数量"""
        return len(self.satellites)
    
    def to_compact(self) -> list:
        """
        转换为紧凑数组格式（用于 WebSocket 传输）。
        
        Returns:
            List of [timestamp, sat_id, a, e, i, OMG, omg, f, X, Y, Z, Vx, Vy, Vz]
        """
        result = []
        for snap in self.satellites:
            row = [
                self.timestamp,
                snap.sat_id,
                *snap.orbit_elements,
                *snap.position,
                *snap.velocity
            ]
            result.append(row)
        return result
    
    def to_dict(self) -> dict:
        """
        转换为字典格式（用于 CSV API 传输）。
        
        Returns:
            {
                'timestamp': str,
                'sats': [{'sat_id': int, 'a': float, ...}, ...]
            }
        """
        sats = []
        for snap in self.satellites:
            sat = {
                'sat_id': snap.sat_id,
                'a': snap.orbit_elements[0],
                'e': snap.orbit_elements[1],
                'i': snap.orbit_elements[2],
                'OMG': snap.orbit_elements[3],
                'omg': snap.orbit_elements[4],
                'f': snap.orbit_elements[5],
                'X': snap.position[0],
                'Y': snap.position[1],
                'Z': snap.position[2],
                'Vx': snap.velocity[0],
                'Vy': snap.velocity[1],
                'Vz': snap.velocity[2]
            }
            sats.append(sat)
        
        return {
            'timestamp': self.timestamp,
            'sats': sats
        }
    
    def __repr__(self) -> str:
        return f"FrameData(timestamp={self.timestamp}, satellites={self.sat_count})"
