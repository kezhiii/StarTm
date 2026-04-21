"""
灯光调度计划 API 路由

提供灯光调度计划的批量创建、查询和删除端点。
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, ValidationError
from typing import Optional, List
from datetime import datetime

from server.db.session import get_session
from server.db.models import LightSchedule
from server.db.repositories.schedule_repo import ScheduleRepository

router = APIRouter(prefix="/api/light-schedules", tags=["light-schedules"])


class ScheduleCreateRequest(BaseModel):
    sat_ids: List[int]  # 批量卫星编号
    schedule_type: str  # "absolute", "relative", or "wallclock"
    trigger_time: Optional[str] = None  # 仿真绝对时间戳
    trigger_at: Optional[datetime] = None  # 真实时间（UTC），用于 wallclock 模式
    offset_seconds: Optional[int] = None
    current_step: Optional[int] = None  # 前端传入的当前仿真步（相对时间计算用）
    command: str  # "on" or "off"
    duration_seconds: Optional[int] = None  # 灯光持续时长（秒），None表示永久


class ScheduleResponse(BaseModel):
    id: int
    sat_id: int
    schedule_type: str
    trigger_time: Optional[str] = None
    trigger_step: Optional[int] = None
    trigger_at: Optional[datetime] = None
    command: str
    duration_seconds: Optional[int] = None
    executed: bool
    created_at: datetime


@router.get("", response_model=list[ScheduleResponse])
async def list_schedules(session=Depends(get_session)):
    """获取所有灯光调度计划"""
    repo = ScheduleRepository(session)
    schedules = await repo.get_all()
    return [
        ScheduleResponse(
            id=s.id,
            sat_id=s.sat_id,
            schedule_type=s.schedule_type,
            trigger_time=s.trigger_time,
            trigger_step=s.trigger_step,
            command=s.command,
            duration_seconds=s.duration_seconds,
            executed=s.executed,
            created_at=s.created_at,
        )
        for s in schedules
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_schedule(
    raw_request: Request,
    session=Depends(get_session),
):
    """批量创建灯光调度计划"""
    import json
    body = await raw_request.body()
    print(f"[API] 收到原始请求: {body.decode()}")
    
    try:
        request = ScheduleCreateRequest(**json.loads(body))
        print(f"[API] 解析成功: {request.dict()}")
    except (json.JSONDecodeError, ValidationError) as e:
        print(f"[API] 请求解析失败: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    
    if request.command not in ("on", "off"):
        raise HTTPException(status_code=400, detail="command must be 'on' or 'off'")

    if not request.sat_ids:
        raise HTTPException(status_code=400, detail="sat_ids cannot be empty")

    if request.schedule_type == "absolute":
        if not request.trigger_time:
            raise HTTPException(status_code=400, detail="trigger_time is required for absolute schedule")
    elif request.schedule_type == "relative":
        # 相对时间模式：前端已计算好 trigger_time（基于当前播放时间戳 + 偏移）
        if not request.trigger_time:
            raise HTTPException(status_code=400, detail="trigger_time is required for relative schedule")
    elif request.schedule_type == "wallclock":
        if not request.trigger_at:
            raise HTTPException(status_code=400, detail="trigger_at is required for wallclock schedule")
    else:
        raise HTTPException(status_code=400, detail="schedule_type must be 'absolute', 'relative', or 'wallclock'")

    repo = ScheduleRepository(session)
    created_schedules = []

    for sat_id in request.sat_ids:
        # 创建主计划
        if request.schedule_type == "absolute":
            schedule = LightSchedule(
                sat_id=sat_id,
                schedule_type="absolute",
                trigger_time=request.trigger_time,
                command=request.command,
                duration_seconds=request.duration_seconds,
            )
        elif request.schedule_type == "wallclock":
            schedule = LightSchedule(
                sat_id=sat_id,
                schedule_type="wallclock",
                trigger_at=request.trigger_at,
                command=request.command,
                duration_seconds=request.duration_seconds,
            )
        else:
            # 相对时间模式：前端已计算好 trigger_time，直接存储
            schedule = LightSchedule(
                sat_id=sat_id,
                schedule_type="relative",
                trigger_time=request.trigger_time,
                command=request.command,
                duration_seconds=request.duration_seconds,
            )

        created = await repo.create(schedule)
        created_schedules.append(
            ScheduleResponse(
                id=created.id,
                sat_id=created.sat_id,
                schedule_type=created.schedule_type,
                trigger_time=created.trigger_time,
                trigger_step=created.trigger_step,
                trigger_at=created.trigger_at,
                command=created.command,
                duration_seconds=created.duration_seconds,
                executed=created.executed,
                created_at=created.created_at,
            )
        )

        # 如果命令是 on 且有时长，自动创建对应的 off 计划
        if request.command == "on" and request.duration_seconds is not None and request.duration_seconds > 0:
            if request.schedule_type == "absolute" or request.schedule_type == "relative":
                # 解析时间戳并加上时长
                from datetime import datetime, timedelta
                try:
                    dt = datetime.strptime(request.trigger_time, "%Y%m%d%H%M%S")
                    off_dt = dt + timedelta(seconds=request.duration_seconds)
                    off_trigger_time = off_dt.strftime("%Y%m%d%H%M%S")
                    off_schedule = LightSchedule(
                        sat_id=sat_id,
                        schedule_type=request.schedule_type,
                        trigger_time=off_trigger_time,
                        command="off",
                    )
                    await repo.create(off_schedule)
                    print(f"[API] 自动关灯计划: trigger_time={off_trigger_time} (duration={request.duration_seconds}s)")
                except ValueError as e:
                    print(f"[API] 无法解析时间戳 {request.trigger_time}: {e}")
            elif request.schedule_type == "wallclock":
                from datetime import timedelta
                off_schedule = LightSchedule(
                    sat_id=sat_id,
                    schedule_type="wallclock",
                    trigger_at=request.trigger_at + timedelta(seconds=request.duration_seconds),
                    command="off",
                )
                await repo.create(off_schedule)

    return {"schedules": created_schedules, "count": len(created_schedules)}


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: int, session=Depends(get_session)):
    """删除灯光调度计划"""
    repo = ScheduleRepository(session)
    deleted = await repo.delete(schedule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Schedule {schedule_id} not found")
    return {"message": f"Schedule {schedule_id} deleted"}
