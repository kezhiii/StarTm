"""
轨道推进器抽象基类

定义轨道递推的标准接口，支持多种推进器实现。
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..core.satellite import Satellite
    from ..core.constellation import Constellation


class OrbitPropagator(ABC):
    """
    轨道推进器抽象基类。
    
    所有轨道递推引擎必须实现此接口。
    支持：
    - 单星递推
    - 星座批量递推
    - JIT 加速（可选）
    """
    
    @abstractmethod
    def propagate_satellite(self, satellite: Satellite, dt: float, step: int) -> Satellite:
        """
        递推单颗卫星状态。
        
        Args:
            satellite: 当前卫星状态
            dt: 时间步长 (秒)
            step: 当前步数（用于计算儒略日等）
        
        Returns:
            递推后的新卫星状态
        """
        pass
    
    @abstractmethod
    def propagate_constellation(self, constellation: Constellation, dt: float, step: int) -> Constellation:
        """
        递推整个星座。
        
        默认实现：逐个调用 propagate_satellite。
        子类可覆盖以使用批量/JIT 优化。
        
        Args:
            constellation: 当前星座状态
            dt: 时间步长 (秒)
            step: 当前步数
        
        Returns:
            递推后的新星座状态
        """
        for sat in constellation.satellites:
            constellation.update_orbit_elements(
                self.propagate_satellite(sat, dt, step).orbit_elements
            )
        return constellation
    
    @abstractmethod
    def get_name(self) -> str:
        """返回推进器名称"""
        pass
    
    def __repr__(self) -> str:
        return f"{self.__class__.__name__}({self.get_name()})"
