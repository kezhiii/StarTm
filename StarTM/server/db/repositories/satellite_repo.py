"""
卫星数据仓库

提供卫星数据的 CRUD 和批量操作。
"""

from __future__ import annotations
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Satellite


class SatelliteRepository:
    """卫星数据访问层"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, sat_id: int) -> Optional[Satellite]:
        """根据卫星编号获取"""
        result = await self.session.execute(
            select(Satellite).where(Satellite.sat_id == sat_id)
        )
        return result.scalars().first()

    async def get_by_plane(self, plane_index: int) -> List[Satellite]:
        """获取指定轨道面的所有卫星"""
        result = await self.session.execute(
            select(Satellite)
            .where(Satellite.plane_index == plane_index)
            .order_by(Satellite.slot_index)
        )
        return result.scalars().all()

    async def get_all(self) -> List[Satellite]:
        """获取所有卫星"""
        result = await self.session.execute(
            select(Satellite).order_by(Satellite.plane_index, Satellite.slot_index)
        )
        return result.scalars().all()

    async def count(self) -> int:
        """获取卫星总数"""
        from sqlmodel import func
        result = await self.session.execute(
            select(func.count(Satellite.id))
        )
        return result.scalar() or 0

    async def create(self, satellite: Satellite) -> Satellite:
        """创建单颗卫星"""
        self.session.add(satellite)
        await self.session.commit()
        await self.session.refresh(satellite)
        return satellite

    async def create_many(self, satellites: List[Satellite]) -> int:
        """批量创建卫星"""
        self.session.add_all(satellites)
        await self.session.commit()
        return len(satellites)

    async def update_light_state(self, sat_id: int, light_state: bool) -> bool:
        """更新灯光状态"""
        satellite = await self.get_by_id(sat_id)
        if satellite is None:
            return False
        satellite.light_state = light_state
        satellite.updated_at = datetime.utcnow()
        await self.session.commit()
        await self.session.refresh(satellite)
        return True

    async def bulk_update_light_states(self, light_state_map: dict[int, bool]) -> int:
        """
        批量更新多颗卫星的灯光状态（单次 commit）。

        Args:
            light_state_map: {sat_id: light_state, ...}

        Returns:
            更新的记录数
        """
        from datetime import datetime
        from sqlmodel import update, col

        if not light_state_map:
            return 0

        sat_ids = list(light_state_map.keys())
        result = await self.session.execute(
            select(Satellite).where(Satellite.sat_id.in_(sat_ids))
        )
        satellites = result.scalars().all()

        count = 0
        now = datetime.utcnow()
        for sat in satellites:
            if sat.sat_id in light_state_map:
                sat.light_state = light_state_map[sat.sat_id]
                sat.updated_at = now
                count += 1

        if count > 0:
            await self.session.commit()
        return count

    async def update_orbit_elements(
        self,
        sat_id: int,
        semi_major_axis: float = None,
        eccentricity: float = None,
        inclination: float = None,
        raan: float = None,
        argument_of_perigee: float = None,
        true_anomaly: float = None,
    ) -> bool:
        """更新轨道根数"""
        satellite = await self.get_by_id(sat_id)
        if satellite is None:
            return False
        if semi_major_axis is not None:
            satellite.semi_major_axis = semi_major_axis
        if eccentricity is not None:
            satellite.eccentricity = eccentricity
        if inclination is not None:
            satellite.inclination = inclination
        if raan is not None:
            satellite.raan = raan
        if argument_of_perigee is not None:
            satellite.argument_of_perigee = argument_of_perigee
        if true_anomaly is not None:
            satellite.true_anomaly = true_anomaly
        satellite.updated_at = datetime.utcnow()
        await self.session.commit()
        await self.session.refresh(satellite)
        return True

    async def delete_all(self) -> int:
        """删除所有卫星数据（用于重新生成）"""
        result = await self.session.execute(select(Satellite))
        satellites = result.scalars().all()
        count = len(satellites)
        for sat in satellites:
            await self.session.delete(sat)
        await self.session.commit()
        return count

    async def get_all_as_dict(self) -> Dict[int, Dict[str, Any]]:
        """
        获取所有卫星为字典格式（用于 Constellation 初始化）。

        返回格式:
        {
            sat_id: {
                "orbit_elements": [a, e, i, raan, arg_perigee, true_anomaly],
                "physical_props": {"mass": ..., "cross_section": ..., "drag_coefficient": ...},
                "light_state": ...,
                "plane_index": ...,
                "slot_index": ...,
            },
            ...
        }
        """
        satellites = await self.get_all()
        result = {}
        for sat in satellites:
            result[sat.sat_id] = {
                "orbit_elements": [
                    sat.semi_major_axis,
                    sat.eccentricity,
                    sat.inclination,
                    sat.raan,
                    sat.argument_of_perigee,
                    sat.true_anomaly,
                ],
                "physical_props": {
                    "mass": sat.mass,
                    "cross_section": sat.cross_section,
                    "drag_coefficient": sat.drag_coefficient,
                },
                "light_state": sat.light_state,
                "plane_index": sat.plane_index,
                "slot_index": sat.slot_index,
            }
        return result
