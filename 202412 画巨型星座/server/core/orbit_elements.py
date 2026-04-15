"""
轨道根数值对象 (开普勒六要素)

封装卫星轨道根数及其单位转换方法。
"""

from __future__ import annotations
import math
from dataclasses import dataclass


@dataclass(frozen=True)
class OrbitElements:
    """
    轨道根数 (开普勒六要素)
    
    所有角度以弧度为单位，长度以米为单位。
    """
    
    a: float    # 半长轴 (m)
    e: float    # 偏心率 (无量纲)
    i: float    # 倾角 (rad)
    OMG: float  # 升交点赤经 (rad)
    omg: float  # 近地点幅角 (rad)
    f: float    # 真近点角 (rad)
    
    @classmethod
    def from_array(cls, arr: list | tuple) -> OrbitElements:
        """
        从数组创建轨道根数。
        
        Args:
            arr: [a, e, i, OMG, omg, f]
                 输入格式：a(km), e(无量纲), i(deg), OMG(deg), omg(deg), f(deg)
        
        Returns:
            OrbitElements 实例（已转换为标准单位）
        """
        return cls(
            a=arr[0] * 1000.0,       # km → m
            e=arr[1],                 # 无量纲
            i=math.radians(arr[2]),   # deg → rad
            OMG=math.radians(arr[3]), # deg → rad
            omg=math.radians(arr[4]), # deg → rad
            f=math.radians(arr[5])    # deg → rad
        )
    
    @classmethod
    def from_array_rad(cls, arr: list | tuple) -> OrbitElements:
        """
        从数组创建轨道根数（角度已为弧度）。
        
        Args:
            arr: [a, e, i, OMG, omg, f]
                 输入格式：a(m), e(无量纲), i(rad), OMG(rad), omg(rad), f(rad)
        
        Returns:
            OrbitElements 实例
        """
        return cls(
            a=arr[0],
            e=arr[1],
            i=arr[2],
            OMG=arr[3],
            omg=arr[4],
            f=arr[5]
        )
    
    def to_array(self) -> list[float]:
        """
        转换为数组格式（用于前端传输）。
        
        Returns:
            [a(km), e, i(deg), OMG(deg), omg(deg), f(deg)]
        """
        return [
            self.a / 1000.0,          # m → km
            self.e,                    # 无量纲
            math.degrees(self.i),      # rad → deg
            math.degrees(self.OMG),    # rad → deg
            math.degrees(self.omg),    # rad → deg
            math.degrees(self.f)       # rad → deg
        ]
    
    def to_array_rad(self) -> list[float]:
        """
        转换为数组格式（角度保持弧度）。
        
        Returns:
            [a(m), e, i(rad), OMG(rad), omg(rad), f(rad)]
        """
        return [self.a, self.e, self.i, self.OMG, self.omg, self.f]
    
    def to_numpy(self):
        """
        转换为 numpy 数组（用于 JIT 计算）。
        
        Returns:
            numpy.ndarray: [a(m), e, i(rad), OMG(rad), omg(rad), f(rad)]
        """
        import numpy as np
        return np.array([self.a, self.e, self.i, self.OMG, self.omg, self.f])
    
    @classmethod
    def from_numpy(cls, arr) -> OrbitElements:
        """
        从 numpy 数组创建。
        
        Args:
            arr: numpy.ndarray [a(m), e, i(rad), OMG(rad), omg(rad), f(rad)]
        
        Returns:
            OrbitElements 实例
        """
        return cls(
            a=float(arr[0]),
            e=float(arr[1]),
            i=float(arr[2]),
            OMG=float(arr[3]),
            omg=float(arr[4]),
            f=float(arr[5])
        )
    
    def copy(self) -> OrbitElements:
        """创建副本"""
        return OrbitElements(
            a=self.a, e=self.e, i=self.i,
            OMG=self.OMG, omg=self.omg, f=self.f
        )
    
    def __repr__(self) -> str:
        return (
            f"OrbitElements(a={self.a/1000:.2f}km, e={self.e:.4f}, "
            f"i={math.degrees(self.i):.2f}deg, OMG={math.degrees(self.OMG):.2f}deg, "
            f"omg={math.degrees(self.omg):.2f}deg, f={math.degrees(self.f):.2f}deg)"
        )
