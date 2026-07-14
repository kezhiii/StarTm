"""
卫星邻星关系仓库

提供邻星关系的 CRUD 和批量操作。
"""

from __future__ import annotations
from typing import List, Dict
from datetime import datetime
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import SatelliteNeighbor


class NeighborRepository:
    """卫星邻星关系数据访问层"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_neighbors(self, sat_id: int) -> List[SatelliteNeighbor]:
        """获取指定卫星的所有邻星"""
        result = await self.session.execute(
            select(SatelliteNeighbor)
            .where(SatelliteNeighbor.sat_id == sat_id)
            .order_by(SatelliteNeighbor.distance_km)
        )
        return result.scalars().all()

    async def get_neighbor_ids(self, sat_id: int) -> List[int]:
        """获取指定卫星的邻星编号列表"""
        neighbors = await self.get_neighbors(sat_id)
        return [n.neighbor_id for n in neighbors]

    async def get_all_neighbor_map(self) -> Dict[int, List[int]]:
        """
        获取所有卫星的邻星关系映射。

        返回格式:
        {
            sat_id: [neighbor_id_1, neighbor_id_2, ...],
            ...
        }
        """
        result = await self.session.execute(select(SatelliteNeighbor))
        neighbors = result.scalars().all()

        neighbor_map: Dict[int, List[int]] = {}
        for n in neighbors:
            if n.sat_id not in neighbor_map:
                neighbor_map[n.sat_id] = []
            neighbor_map[n.sat_id].append(n.neighbor_id)

        return neighbor_map

    async def upsert_neighbor(
        self,
        sat_id: int,
        neighbor_id: int,
        distance_km: float,
    ) -> SatelliteNeighbor:
        """
        添加或更新邻星关系（存在则更新距离，不存在则创建）。
        """
        result = await self.session.execute(
            select(SatelliteNeighbor).where(
                SatelliteNeighbor.sat_id == sat_id,
                SatelliteNeighbor.neighbor_id == neighbor_id,
            )
        )
        existing = result.scalars().first()

        if existing:
            existing.distance_km = distance_km
            existing.calculated_at = datetime.utcnow()
            await self.session.commit()
            await self.session.refresh(existing)
            return existing
        else:
            neighbor = SatelliteNeighbor(
                sat_id=sat_id,
                neighbor_id=neighbor_id,
                distance_km=distance_km,
            )
            self.session.add(neighbor)
            await self.session.commit()
            await self.session.refresh(neighbor)
            return neighbor

    async def upsert_many(
        self,
        neighbor_map: Dict[int, List[int]],
        distances: Dict[tuple, float] = None,
    ) -> int:
        """
        批量添加或更新邻星关系。

        Args:
            neighbor_map: {sat_id: [neighbor_id_1, neighbor_id_2, ...], ...}
            distances: {(sat_id, neighbor_id): distance_km, ...} 可选

        Returns:
            创建/更新的记录数
        """
        # 先清空现有关系
        await self.delete_all()

        count = 0
        for sat_id, neighbors in neighbor_map.items():
            for neighbor_id in neighbors:
                dist_key = (sat_id, neighbor_id)
                distance = distances.get(dist_key, 0.0) if distances else 0.0

                neighbor = SatelliteNeighbor(
                    sat_id=sat_id,
                    neighbor_id=neighbor_id,
                    distance_km=distance,
                )
                self.session.add(neighbor)
                count += 1

        await self.session.commit()
        return count

    async def delete_all(self) -> int:
        """删除所有邻星关系"""
        result = await self.session.execute(select(SatelliteNeighbor))
        neighbors = result.scalars().all()
        count = len(neighbors)
        for n in neighbors:
            await self.session.delete(n)
        if count > 0:
            await self.session.commit()
        return count

    async def delete_by_sat(self, sat_id: int) -> int:
        """删除指定卫星的所有邻星关系"""
        result = await self.session.execute(
            select(SatelliteNeighbor).where(SatelliteNeighbor.sat_id == sat_id)
        )
        neighbors = result.scalars().all()
        count = len(neighbors)
        for n in neighbors:
            await self.session.delete(n)
        if count > 0:
            await self.session.commit()
        return count
