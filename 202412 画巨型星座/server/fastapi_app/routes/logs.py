"""
协议日志查询 API 路由

提供协议日志的分页查询和详情查看端点。
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import Optional

from server.db.session import get_session
from server.db.repositories.log_repo import LogRepository

router = APIRouter(prefix="/api/protocol-logs", tags=["protocol-logs"])


@router.get("")
async def get_protocol_logs(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=200, description="每页数量"),
    log_type: Optional[str] = Query(None, description="日志类型过滤"),
    client_addr: Optional[str] = Query(None, description="客户端地址过滤"),
    start_time: Optional[datetime] = Query(None, description="起始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    session: AsyncSession = Depends(get_session),
):
    """分页查询协议日志"""
    repo = LogRepository(session)
    logs, total = await repo.get_paginated(
        page=page,
        page_size=page_size,
        log_type=log_type,
        client_addr=client_addr,
        start_time=start_time,
        end_time=end_time,
    )
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "logs": [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat(),
                "client_addr": log.client_addr,
                "log_type": log.log_type,
                "crc_value": log.crc_value,
                "crc_passed": log.crc_passed,
                "result_success": log.result_success,
                "session_id": log.session_id,
            }
            for log in logs
        ],
    }


@router.get("/{log_id}")
async def get_protocol_log_detail(
    log_id: int,
    session: AsyncSession = Depends(get_session),
):
    """获取单条日志详情"""
    repo = LogRepository(session)
    log = await repo.get_by_id(log_id)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Log ID '{log_id}' not found"
        )
    
    return {
        "id": log.id,
        "timestamp": log.timestamp.isoformat(),
        "client_addr": log.client_addr,
        "log_type": log.log_type,
        "frame_data": log.frame_data,
        "frame_details": log.frame_details,
        "messages": log.messages,
        "crc_value": log.crc_value,
        "crc_passed": log.crc_passed,
        "result_success": log.result_success,
        "result_details": log.result_details,
        "session_id": log.session_id,
    }
