"""
邻居发现服务

基于实时3D空间距离计算卫星邻居关系。
为每颗卫星找到最近的N颗邻居，用于互校验流程。
"""

from __future__ import annotations
import math
from typing import Dict, List, Optional, Tuple


class NeighborFinder:
    """
    基于距离的邻居发现器
    
    计算所有卫星之间的欧氏距离矩阵，
    为每颗卫星选择最近的N颗邻居。
    """
    
    def __init__(self, neighbor_count: int = 2):
        """
        初始化邻居发现器
        
        Args:
            neighbor_count: 每颗卫星的邻居数量
        """
        self._neighbor_count = neighbor_count
    
    def find_neighbors(
        self,
        positions: Dict[int, Tuple[float, float, float]],
        exclude_self: bool = True,
    ) -> Dict[int, List[int]]:
        """
        基于3D位置计算邻居关系
        
        Args:
            positions: {sat_id: (x, y, z), ...} 卫星位置字典
            exclude_self: 是否排除自身
            
        Returns:
            {sat_id: [neighbor_id_1, neighbor_id_2, ...], ...}
        """
        sat_ids = list(positions.keys())
        neighbors: Dict[int, List[int]] = {}
        
        for sat_id in sat_ids:
            if sat_id not in positions:
                continue
            
            x1, y1, z1 = positions[sat_id]
            distances = []
            
            for other_id in sat_ids:
                if exclude_self and other_id == sat_id:
                    continue
                if other_id not in positions:
                    continue
                
                x2, y2, z2 = positions[other_id]
                dist = math.sqrt(
                    (x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2
                )
                distances.append((other_id, dist))
            
            # 按距离排序，取最近的N颗
            distances.sort(key=lambda item: item[1])
            neighbor_ids = [item[0] for item in distances[:self._neighbor_count]]
            neighbors[sat_id] = neighbor_ids
        
        return neighbors
    
    def find_neighbors_from_constellation(
        self,
        constellation,
        neighbor_count: Optional[int] = None,
    ) -> Dict[int, List[int]]:
        """
        从Constellation对象通过轨道根数计算位置并计算邻居
        
        Args:
            constellation: Constellation实例
            neighbor_count: 覆盖默认邻居数量
            
        Returns:
            {sat_id: [neighbor_id_1, neighbor_id_2, ...], ...}
        """
        count = neighbor_count or self._neighbor_count
        
        # 从轨道根数计算惯性坐标系位置
        from orbitElementsToInertiastate import OrbitElementsToInertiastate
        
        positions: Dict[int, Tuple[float, float, float]] = {}
        for sat in constellation.satellites:
            oe_array = sat.orbit_elements.to_numpy()
            inertial = OrbitElementsToInertiastate(oe_array)
            positions[sat.sat_id] = (inertial[0], inertial[1], inertial[2])
        
        # 临时覆盖邻居数量
        original_count = self._neighbor_count
        self._neighbor_count = count
        result = self.find_neighbors(positions)
        self._neighbor_count = original_count
        
        return result
