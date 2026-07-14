"""
惯性状态值对象 (ECI 坐标系)

封装卫星在地心惯性坐标系中的位置和速度。
"""

from __future__ import annotations
import math
from dataclasses import dataclass


@dataclass(frozen=True)
class InertialState:
    """
    惯性状态 (ECI 坐标系)
    
    位置以米为单位，速度以米/秒为单位。
    """
    
    x: float   # 位置 X (m)
    y: float   # 位置 Y (m)
    z: float   # 位置 Z (m)
    vx: float  # 速度 Vx (m/s)
    vy: float  # 速度 Vy (m/s)
    vz: float  # 速度 Vz (m/s)
    
    @property
    def position(self) -> tuple[float, float, float]:
        """位置向量 (x, y, z)"""
        return (self.x, self.y, self.z)
    
    @property
    def velocity(self) -> tuple[float, float, float]:
        """速度向量 (vx, vy, vz)"""
        return (self.vx, self.vy, self.vz)
    
    @property
    def radius(self) -> float:
        """地心距离 (m)"""
        return math.sqrt(self.x**2 + self.y**2 + self.z**2)
    
    @property
    def speed(self) -> float:
        """速度大小 (m/s)"""
        return math.sqrt(self.vx**2 + self.vy**2 + self.vz**2)
    
    @classmethod
    def from_array(cls, arr: list | tuple) -> InertialState:
        """
        从数组创建惯性状态。
        
        Args:
            arr: [X(km), Y(km), Z(km), Vx(km/s), Vy(km/s), Vz(km/s)]
        
        Returns:
            InertialState 实例（已转换为标准单位）
        """
        return cls(
            x=arr[0] * 1000.0,
            y=arr[1] * 1000.0,
            z=arr[2] * 1000.0,
            vx=arr[3] * 1000.0,
            vy=arr[4] * 1000.0,
            vz=arr[5] * 1000.0
        )
    
    @classmethod
    def from_array_m(cls, arr: list | tuple) -> InertialState:
        """
        从数组创建惯性状态（单位已为 m 和 m/s）。
        
        Args:
            arr: [X(m), Y(m), Z(m), Vx(m/s), Vy(m/s), Vz(m/s)]
        
        Returns:
            InertialState 实例
        """
        return cls(
            x=arr[0], y=arr[1], z=arr[2],
            vx=arr[3], vy=arr[4], vz=arr[5]
        )
    
    def to_array(self) -> list[float]:
        """
        转换为数组格式（用于前端传输）。
        
        Returns:
            [X(km), Y(km), Z(km), Vx(km/s), Vy(km/s), Vz(km/s)]
        """
        return [
            self.x / 1000.0,
            self.y / 1000.0,
            self.z / 1000.0,
            self.vx / 1000.0,
            self.vy / 1000.0,
            self.vz / 1000.0
        ]
    
    def to_array_m(self) -> list[float]:
        """
        转换为数组格式（保持 m 和 m/s 单位）。
        
        Returns:
            [X(m), Y(m), Z(m), Vx(m/s), Vy(m/s), Vz(m/s)]
        """
        return [self.x, self.y, self.z, self.vx, self.vy, self.vz]
    
    def to_numpy(self):
        """
        转换为 numpy 数组（用于 JIT 计算）。
        
        Returns:
            numpy.ndarray: [X(m), Y(m), Z(m), Vx(m/s), Vy(m/s), Vz(m/s)]
        """
        import numpy as np
        return np.array([self.x, self.y, self.z, self.vx, self.vy, self.vz])
    
    @classmethod
    def from_numpy(cls, arr) -> InertialState:
        """
        从 numpy 数组创建。
        
        Args:
            arr: numpy.ndarray [X(m), Y(m), Z(m), Vx(m/s), Vy(m/s), Vz(m/s)]
        
        Returns:
            InertialState 实例
        """
        return cls(
            x=float(arr[0]), y=float(arr[1]), z=float(arr[2]),
            vx=float(arr[3]), vy=float(arr[4]), vz=float(arr[5])
        )
    
    def copy(self) -> InertialState:
        """创建副本"""
        return InertialState(
            x=self.x, y=self.y, z=self.z,
            vx=self.vx, vy=self.vy, vz=self.vz
        )
    
    def __repr__(self) -> str:
        return (
            f"InertialState(pos=({self.x/1000:.2f}, {self.y/1000:.2f}, {self.z/1000:.2f})km, "
            f"vel=({self.vx/1000:.4f}, {self.vy/1000:.4f}, {self.vz/1000:.4f})km/s)"
        )
