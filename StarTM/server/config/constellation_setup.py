"""
星座设置管理

提供星座参数配置、轨道根数计算和星座生成功能。
"""

from __future__ import annotations
import math
from typing import Optional

import numpy as np

from .app_config import AppConfig, ConstellationParamsConfig, PhysicsConfig


class ConstellationSetup:
    """
    星座设置管理器。

    职责：
    - 管理星座参数配置
    - 计算轨道面分布
    - 计算卫星槽位分布
    - 生成轨道根数矩阵
    - 提供星座参数查询
    """

    def __init__(
        self,
        app_config: AppConfig,
        params_config: Optional[ConstellationParamsConfig] = None,
        physics_config: Optional[PhysicsConfig] = None,
    ):
        """
        创建星座设置管理器。

        Args:
            app_config: 应用程序配置
            params_config: 星座参数配置（可选，默认使用 app_config 的）
            physics_config: 物理配置（可选，默认使用 app_config 的）
        """
        self._app_config = app_config
        self._params = params_config or app_config.constellation_params
        self._physics = physics_config or app_config.physics

    @property
    def params(self) -> ConstellationParamsConfig:
        """获取星座参数配置"""
        return self._params

    @property
    def physics(self) -> PhysicsConfig:
        """获取物理配置"""
        return self._physics

    @property
    def orbit_radius(self) -> float:
        """轨道半径 (m) = 地球半径 + 轨道高度"""
        return self._physics.RE + self._params.orbit_height

    @property
    def inclination_rad(self) -> float:
        """轨道倾角 (rad)"""
        return self._params.inclination_deg * self._app_config.units.deg_to_rad

    @property
    def plane_count(self) -> int:
        """轨道面数"""
        return self._params.plane_count

    @property
    def satellites_per_plane(self) -> int:
        """每轨道面卫星数"""
        return self._params.satellites_per_plane

    @property
    def total_satellites(self) -> int:
        """总卫星数"""
        return self._params.total_satellites

    def compute_raan(self, plane_id: int) -> float:
        """
        计算指定轨道面的升交点赤经。

        Args:
            plane_id: 轨道面 ID (0-based)

        Returns:
            升交点赤经 (rad)
        """
        return 2.0 * math.pi * plane_id / self.plane_count

    def compute_mean_anomaly(self, plane_id: int, slot_id: int) -> float:
        """
        计算指定卫星槽位的平近点角。

        Args:
            plane_id: 轨道面 ID (0-based)
            slot_id: 槽位 ID (0-based)

        Returns:
            平近点角 (rad)
        """
        # Walker 星座分布
        phase_offset = 2.0 * math.pi * self._params.phase_factor * plane_id / self.total_satellites
        slot_angle = 2.0 * math.pi * slot_id / self.satellites_per_plane
        return slot_angle + phase_offset

    def generate_orbit_elements(self, plane_id: int, slot_id: int) -> np.ndarray:
        """
        生成单颗卫星的初始轨道根数。

        Args:
            plane_id: 轨道面 ID (0-based)
            slot_id: 槽位 ID (0-based)

        Returns:
            numpy 数组 [a(m), e, i(rad), OMG(rad), omg(rad), M(rad)]
        """
        a = self.orbit_radius
        e = 0.0
        i = self.inclination_rad
        raan = self.compute_raan(plane_id)
        omg = 0.0
        M = self.compute_mean_anomaly(plane_id, slot_id)

        return np.array([a, e, i, raan, omg, M])

    def get_satellite_index(self, plane_id: int, slot_id: int) -> int:
        """
        获取卫星在矩阵中的索引。

        Args:
            plane_id: 轨道面 ID (0-based)
            slot_id: 槽位 ID (0-based)

        Returns:
            索引 (0-based)
        """
        return plane_id * self.satellites_per_plane + slot_id

    def get_plane_and_slot(self, index: int) -> tuple[int, int]:
        """
        从索引获取轨道面和槽位 ID。

        Args:
            index: 索引 (0-based)

        Returns:
            (plane_id, slot_id)
        """
        plane_id = index // self.satellites_per_plane
        slot_id = index % self.satellites_per_plane
        return plane_id, slot_id

    def __repr__(self) -> str:
        return (
            f"ConstellationSetup(planes={self.plane_count}, "
            f"sats_per_plane={self.satellites_per_plane}, "
            f"total={self.total_satellites}, "
            f"height={self._params.orbit_height/1000:.0f}km)"
        )
