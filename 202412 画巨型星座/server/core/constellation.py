"""
星座类

管理多颗卫星的集合，提供批量操作接口。
"""

from __future__ import annotations
import os
from typing import Optional, Dict, Any, List
from datetime import datetime

import numpy as np

from .satellite import Satellite
from .orbit_elements import OrbitElements
from .inertial_state import InertialState
from .physical_props import PhysicalProps
from .frame_data import FrameData, SatelliteSnapshot


class Constellation:
    """
    星座管理：多颗卫星的集合。
    
    属性:
        name: 星座名称
        satellites: 卫星列表（按 sat_id 排序）
        physical_props: 默认物理属性（所有卫星共用）
    """
    
    def __init__(self, name: str = "Constellation", physical_props: Optional[PhysicalProps] = None):
        self.name = name
        self._satellites: dict[int, Satellite] = {}
        self.physical_props = physical_props or PhysicalProps.default()
        # 邻星关系（运行时维护，不直接存储在 Constellation 中）
        self._neighbor_map: Dict[int, List[int]] = {}
    
    @property
    def satellites(self) -> list[Satellite]:
        """获取按 sat_id 排序的卫星列表"""
        return [self._satellites[k] for k in sorted(self._satellites.keys())]
    
    @property
    def sat_count(self) -> int:
        """卫星数量"""
        return len(self._satellites)
    
    @property
    def neighbor_map(self) -> Dict[int, List[int]]:
        """获取邻星关系映射"""
        return self._neighbor_map.copy()
    
    def set_neighbor_map(self, neighbor_map: Dict[int, List[int]]) -> None:
        """设置邻星关系映射"""
        self._neighbor_map = neighbor_map
    
    @classmethod
    def from_input_files(
        cls,
        center_oe_path: str,
        deputy_oe_path: str,
        physical_props: Optional[PhysicalProps] = None,
        name: str = "Constellation"
    ) -> Constellation:
        """
        从输入文件创建星座。
        
        Args:
            center_oe_path: 主星轨道根数文件路径 (Input/centerOEmat.txt)
            deputy_oe_path: 从星轨道根数文件路径 (Input/deputyOEmat.txt)
            physical_props: 物理属性
            name: 星座名称
        
        Returns:
            Constellation 实例
        """
        constellation = cls(name=name, physical_props=physical_props)
        
        # 读取主星轨道根数
        center_oe = np.loadtxt(center_oe_path)
        # 格式: [a(km), e, i(deg), OMG(deg), omg(deg), f(deg)]
        center_sat = Satellite(
            sat_id=0,
            orbit_elements=OrbitElements.from_array(center_oe.tolist()),
            inertial_state=InertialState(x=0, y=0, z=0, vx=0, vy=0, vz=0),  # 初始值，后续计算
            physical_props=physical_props or PhysicalProps.default()
        )
        constellation.add_satellite(center_sat)
        
        # 读取从星轨道根数
        deputy_oe = np.loadtxt(deputy_oe_path)
        # 格式: 每列一颗卫星 [a, e, i, OMG, omg, f]
        for idx in range(deputy_oe.shape[1]):
            sat_oe = deputy_oe[:, idx]
            sat = Satellite(
                sat_id=idx + 1,
                orbit_elements=OrbitElements.from_array(sat_oe.tolist()),
                inertial_state=InertialState(x=0, y=0, z=0, vx=0, vy=0, vz=0),
                physical_props=physical_props or PhysicalProps.default()
            )
            constellation.add_satellite(sat)
        
        return constellation
    
    @classmethod
    async def from_db(
        cls,
        satellite_repo,
        neighbor_repo=None,
        name: str = "Constellation",
    ) -> Optional[Constellation]:
        """
        从数据库创建星座。
        
        Args:
            satellite_repo: SatelliteRepository 实例
            neighbor_repo: NeighborRepository 实例（可选）
            name: 星座名称
        
        Returns:
            Constellation 实例，如果 DB 无数据则返回 None
        """
        sat_data = await satellite_repo.get_all_as_dict()
        if not sat_data:
            return None
        
        constellation = cls(name=name)
        
        for sat_id, data in sorted(sat_data.items()):
            oe = OrbitElements.from_array_rad(data["orbit_elements"])
            pp_data = data["physical_props"]
            pp = PhysicalProps(
                mass=pp_data["mass"],
                cross_section=pp_data["cross_section"],
                drag_coefficient=pp_data["drag_coefficient"],
            )
            sat = Satellite(
                sat_id=sat_id,
                orbit_elements=oe,
                inertial_state=InertialState(x=0, y=0, z=0, vx=0, vy=0, vz=0),
                physical_props=pp,
                light_state=data["light_state"],
            )
            constellation.add_satellite(sat)
        
        # 加载邻星关系
        if neighbor_repo:
            neighbor_map = await neighbor_repo.get_all_neighbor_map()
            constellation.set_neighbor_map(neighbor_map)
        
        return constellation
    
    async def save_to_db(self, satellite_repo, neighbor_repo=None) -> Dict[str, int]:
        """
        将星座数据保存到数据库。
        
        Args:
            satellite_repo: SatelliteRepository 实例
            neighbor_repo: NeighborRepository 实例（可选）
        
        Returns:
            {"satellites": N, "neighbors": M} 保存数量
        """
        from ..db.models import Satellite as DBSatellite
        
        satellites_to_save = []
        for sat in self.satellites:
            oe = sat.orbit_elements
            db_sat = DBSatellite(
                sat_id=sat.sat_id,
                semi_major_axis=oe.a,
                eccentricity=oe.e,
                inclination=oe.i,
                raan=oe.OMG,
                argument_of_perigee=oe.omg,
                true_anomaly=oe.f,
                mass=sat.physical_props.mass,
                cross_section=sat.physical_props.cross_section,
                drag_coefficient=sat.physical_props.drag_coefficient,
                plane_index=0,
                slot_index=sat.sat_id,
                light_state=sat.light_state,
            )
            satellites_to_save.append(db_sat)
        
        sat_count = await satellite_repo.create_many(satellites_to_save)
        
        neighbor_count = 0
        if neighbor_repo and self._neighbor_map:
            neighbor_count = await neighbor_repo.upsert_many(self._neighbor_map)
        
        return {"satellites": sat_count, "neighbors": neighbor_count}
    
    async def sync_light_state_to_db(self, satellite_repo) -> None:
        """
        同步所有卫星的灯光状态到数据库。
        
        Args:
            satellite_repo: SatelliteRepository 实例
        """
        for sat in self.satellites:
            await satellite_repo.update_light_state(sat.sat_id, sat.light_state)
    
    def add_satellite(self, satellite: Satellite) -> None:
        """添加卫星"""
        self._satellites[satellite.sat_id] = satellite
    
    def remove_satellite(self, sat_id: int) -> bool:
        """
        移除卫星。
        
        Returns:
            是否成功移除
        """
        if sat_id in self._satellites:
            del self._satellites[sat_id]
            return True
        return False
    
    def get_satellite(self, sat_id: int) -> Optional[Satellite]:
        """获取指定卫星"""
        return self._satellites.get(sat_id)
    
    def get_snapshot(self, timestamp: str) -> FrameData:
        """
        获取当前所有卫星的快照。
        
        Args:
            timestamp: 时间戳字符串
        
        Returns:
            FrameData 实例
        """
        snapshots = []
        for sat in self.satellites:
            oe = sat.orbit_elements.to_array()
            inertial = sat.inertial_state.to_array()
            snapshots.append(SatelliteSnapshot(
                sat_id=sat.sat_id,
                orbit_elements=oe,
                position=inertial[:3],
                velocity=inertial[3:]
            ))
        
        return FrameData(
            timestamp=timestamp,
            satellites=snapshots
        )
    
    def get_numpy_matrix(self) -> np.ndarray:
        """
        获取所有卫星的轨道根数矩阵（用于 JIT 计算）。
        
        Returns:
            numpy.ndarray: shape (N, 6), [a(m), e, i(rad), OMG(rad), omg(rad), f(rad)]
        """
        matrix = np.zeros((self.sat_count, 6))
        for i, sat in enumerate(self.satellites):
            matrix[i] = sat.orbit_elements.to_numpy()
        return matrix
    
    def update_from_numpy_matrix(self, matrix: np.ndarray) -> None:
        """
        从 numpy 矩阵更新所有卫星的轨道根数。
        
        Args:
            matrix: shape (N, 6), [a(m), e, i(rad), OMG(rad), omg(rad), f(rad)]
        """
        for i, sat in enumerate(self.satellites):
            if i < matrix.shape[0]:
                new_oe = OrbitElements.from_numpy(matrix[i])
                sat.update_orbit_elements(new_oe)
    
    def update_inertial_states(self, states: list[InertialState]) -> None:
        """
        批量更新所有卫星的惯性状态。
        
        Args:
            states: 惯性状态列表（按 sat_id 排序）
        """
        for sat, state in zip(self.satellites, states):
            sat.update_inertial_state(state)
    
    def apply_light_control(self, commands: list) -> list:
        """
        批量应用灯光控制指令。
        
        Args:
            commands: [{"sat_id": 0, "command": "on"}, {"sat_id": 3, "command": "off"}, ...]
        
        Returns:
            [{"sat_id": 0, "success": True, "light_state": True}, ...]
        """
        results = []
        for cmd in commands:
            sat_id = cmd.get("sat_id")
            command = cmd.get("command", "").lower()
            
            sat = self.get_satellite(sat_id)
            if sat is None:
                results.append({
                    "sat_id": sat_id,
                    "success": False,
                    "error": f"Satellite {sat_id} not found",
                })
                continue
            
            if command == "on":
                sat.light_state = True
            elif command == "off":
                sat.light_state = False
            else:
                results.append({
                    "sat_id": sat_id,
                    "success": False,
                    "error": f"Unknown command: {command}",
                })
                continue
            
            results.append({
                "sat_id": sat_id,
                "success": True,
                "light_state": sat.light_state,
            })
            
            print(f"[Constellation] 卫星{sat_id} 灯光: {'开' if sat.light_state else '关'}")
        
        return results
    
    def __repr__(self) -> str:
        return f"Constellation(name={self.name!r}, satellites={self.sat_count})"
