"""
卫星物理属性值对象

封装卫星的物理特性，用于轨道摄动计算。
"""

from __future__ import annotations
from dataclasses import dataclass


@dataclass(frozen=True)
class PhysicalProps:
    """
    卫星物理属性
    
    用于大气阻力、太阳光压等摄动计算。
    """
    
    mass: float = 300.0           # 质量 (kg)
    cross_section: float = 0.785  # 横截面积 (m²)，默认 π*(0.5)²
    drag_coefficient: float = 2.2 # 阻力系数 (无量纲)
    
    @property
    def ballistic_coefficient(self) -> float:
        """
        弹道系数 (kg/m²)
        
        B = m / (Cd * A)
        值越大，大气阻力影响越小。
        """
        return self.mass / (self.drag_coefficient * self.cross_section)
    
    @classmethod
    def default(cls) -> PhysicalProps:
        """创建默认物理属性"""
        return cls()
    
    def __repr__(self) -> str:
        return (
            f"PhysicalProps(mass={self.mass}kg, A={self.cross_section}m2, "
            f"Cd={self.drag_coefficient}, B={self.ballistic_coefficient:.2f}kg/m2)"
        )
