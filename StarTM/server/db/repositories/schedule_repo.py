"""
灯光调度计划仓库

提供灯光调度计划的 CRUD 和查询操作。
"""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import LightSchedule


class ScheduleRepository:
    """灯光调度计划数据访问层"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, schedule: LightSchedule) -> LightSchedule:
        """创建新的调度计划"""
        self.session.add(schedule)
        await self.session.commit()
        await self.session.refresh(schedule)
        return schedule

    async def get_by_id(self, schedule_id: int) -> Optional[LightSchedule]:
        """根据 ID 获取调度计划"""
        result = await self.session.execute(
            select(LightSchedule).where(LightSchedule.id == schedule_id)
        )
        return result.scalars().first()

    async def get_all(self) -> List[LightSchedule]:
        """获取所有调度计划"""
        result = await self.session.execute(
            select(LightSchedule).order_by(LightSchedule.created_at)
        )
        return list(result.scalars().all())

    async def get_pending(self) -> List[LightSchedule]:
        """获取所有未执行的调度计划"""
        result = await self.session.execute(
            select(LightSchedule).where(LightSchedule.executed == False).order_by(LightSchedule.created_at)
        )
        return list(result.scalars().all())

    async def get_by_satellite(self, sat_id: int) -> List[LightSchedule]:
        """获取指定卫星的所有调度计划"""
        result = await self.session.execute(
            select(LightSchedule).where(LightSchedule.sat_id == sat_id).order_by(LightSchedule.created_at)
        )
        return list(result.scalars().all())

    async def mark_executed(self, schedule_id: int) -> bool:
        """标记调度计划为已执行"""
        schedule = await self.get_by_id(schedule_id)
        if schedule is None:
            return False
        schedule.executed = True
        await self.session.commit()
        return True

    async def delete(self, schedule_id: int) -> bool:
        """删除调度计划"""
        schedule = await self.get_by_id(schedule_id)
        if schedule is None:
            return False
        await self.session.delete(schedule)
        await self.session.commit()
        return True

    async def delete_by_satellite(self, sat_id: int) -> int:
        """删除指定卫星的所有调度计划"""
        result = await self.session.execute(
            select(LightSchedule).where(LightSchedule.sat_id == sat_id)
        )
        schedules = result.scalars().all()
        count = len(schedules)
        for schedule in schedules:
            await self.session.delete(schedule)
        await self.session.commit()
        return count

    async def cleanup_executed(self, older_than_hours: int = 24) -> int:
        """清理已过期的已执行调度计划"""
        from datetime import datetime, timedelta
        cutoff = datetime.utcnow() - timedelta(hours=older_than_hours)
        result = await self.session.execute(
            select(LightSchedule).where(
                LightSchedule.executed == True,
                LightSchedule.created_at < cutoff,
            )
        )
        schedules = result.scalars().all()
        count = len(schedules)
        for schedule in schedules:
            await self.session.delete(schedule)
        await self.session.commit()
        return count
