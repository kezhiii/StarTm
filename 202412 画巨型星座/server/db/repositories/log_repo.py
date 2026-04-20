"""
协议日志仓库

提供协议日志的 CRUD 和分页查询操作。
"""

from __future__ import annotations
from typing import Optional, List
from datetime import datetime
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func

from ..models import ProtocolLog


class LogRepository:
    """协议日志数据访问层"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_log(
        self,
        timestamp: datetime,
        client_addr: str,
        log_type: str,
        frame_data: Optional[str] = None,
        frame_details: Optional[dict] = None,
        messages: Optional[list] = None,
        crc_value: Optional[int] = None,
        crc_passed: Optional[bool] = None,
        result_success: Optional[bool] = None,
        result_details: Optional[dict] = None,
        session_id: Optional[str] = None,
    ) -> ProtocolLog:
        """创建一条协议日志"""
        log = ProtocolLog(
            timestamp=timestamp,
            client_addr=client_addr,
            log_type=log_type,
            frame_data=frame_data,
            frame_details=frame_details,
            messages=messages,
            crc_value=crc_value,
            crc_passed=crc_passed,
            result_success=result_success,
            result_details=result_details,
            session_id=session_id,
        )
        self.session.add(log)
        await self.session.commit()
        await self.session.refresh(log)
        return log

    async def get_by_id(self, log_id: int) -> Optional[ProtocolLog]:
        """根据 ID 获取日志"""
        result = await self.session.execute(select(ProtocolLog).where(ProtocolLog.id == log_id))
        return result.scalars().first()

    async def get_paginated(
        self,
        page: int = 1,
        page_size: int = 50,
        log_type: Optional[str] = None,
        client_addr: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> tuple[List[ProtocolLog], int]:
        """
        分页查询日志。

        Returns:
            (日志列表, 总记录数)
        """
        query = select(ProtocolLog)

        if log_type:
            query = query.where(ProtocolLog.log_type == log_type)
        if client_addr:
            query = query.where(ProtocolLog.client_addr == client_addr)
        if start_time:
            query = query.where(ProtocolLog.timestamp >= start_time)
        if end_time:
            query = query.where(ProtocolLog.timestamp <= end_time)

        query = query.order_by(ProtocolLog.timestamp.desc())

        # 获取总数
        count_query = select(func.count()).select_from(ProtocolLog)
        if log_type:
            count_query = count_query.where(ProtocolLog.log_type == log_type)
        if client_addr:
            count_query = count_query.where(ProtocolLog.client_addr == client_addr)
        if start_time:
            count_query = count_query.where(ProtocolLog.timestamp >= start_time)
        if end_time:
            count_query = count_query.where(ProtocolLog.timestamp <= end_time)

        total_result = await self.session.execute(count_query)
        total = total_result.scalar_one()

        # 分页
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.session.execute(query)
        logs = result.scalars().all()

        return logs, total

    async def delete_old_logs(self, before: datetime) -> int:
        """删除指定时间之前的日志，返回删除数量"""
        old_result = await self.session.execute(
            select(ProtocolLog).where(ProtocolLog.timestamp < before)
        )
        old_logs = old_result.scalars().all()
        count = 0
        for log in old_logs:
            await self.session.delete(log)
            count += 1
        if count > 0:
            await self.session.commit()
        return count
