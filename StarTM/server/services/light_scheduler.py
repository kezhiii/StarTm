"""
灯光调度服务

提供灯光调度计划的数据库操作和状态查询。
后端负责：计划持久化、执行状态更新、内存星座同步。
前端负责：基于播放帧时间戳的计划触发检查。
"""

from __future__ import annotations
from typing import Optional, Any, Dict, List
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy import select, update as sql_update


class LightScheduler:
    """
    灯光调度器。
    
    职责：
    - 提供计划的数据库查询和状态更新
    - 执行到期计划（更新 DB + 内存星座状态）
    - 供 API 层和 WebSocket 会话调用
    """
    
    def __init__(
        self,
        session_factory: async_sessionmaker,
        constellation: Any,
    ):
        self._session_factory = session_factory
        self._constellation = constellation
        self._last_checked_step = 0
    
    def reset(self) -> None:
        """重置调度器状态（仿真重置时调用）"""
        self._last_checked_step = 0
    
    async def check_and_execute(self, current_step: int, current_timestamp: str) -> List[dict]:
        """
        检查并执行到期的灯光计划。
        
        Args:
            current_step: 当前仿真步计数器
            current_timestamp: 当前仿真时间戳，如 "20210817053301"
        
        Returns:
            已执行的计划列表
        """
        if current_step <= self._last_checked_step:
            return []
        
        executed_schedules = []
        
        try:
            from ..db.repositories.schedule_repo import ScheduleRepository
            from ..db.repositories.satellite_repo import SatelliteRepository
            from ..db.models import LightSchedule
            
            async with self._session_factory() as session:
                schedule_repo = ScheduleRepository(session)
                sat_repo = SatelliteRepository(session)
                
                pending = await schedule_repo.get_pending()
                print(f"[LightScheduler] Step {current_step}: 发现 {len(pending)} 个待执行计划")
                
                for schedule in pending:
                    should_execute = False
                    
                    if schedule.schedule_type == "absolute":
                        if schedule.trigger_time and schedule.trigger_time <= current_timestamp:
                            should_execute = True
                            print(f"[LightScheduler] 绝对时间匹配: schedule={schedule.trigger_time} <= current={current_timestamp}")
                    elif schedule.schedule_type == "relative":
                        # 相对时间模式现在使用 trigger_time（由前端基于 current_timestamp 计算）
                        if schedule.trigger_time and schedule.trigger_time <= current_timestamp:
                            should_execute = True
                            print(f"[LightScheduler] 相对时间匹配: schedule={schedule.trigger_time} <= current={current_timestamp}")
                        elif schedule.trigger_step is not None and schedule.trigger_step <= current_step:
                            # 兼容旧数据：如果 trigger_time 为空但 trigger_step 存在
                            should_execute = True
                            print(f"[LightScheduler] 相对步匹配(旧): schedule_step={schedule.trigger_step} <= current_step={current_step}")
                    elif schedule.schedule_type == "wallclock":
                        from datetime import datetime
                        now = datetime.utcnow()
                        if schedule.trigger_at and schedule.trigger_at <= now:
                            should_execute = True
                            print(f"[LightScheduler] 真实时间匹配: schedule={schedule.trigger_at} <= current={now}")
                    
                    if should_execute:
                        print(f"[LightScheduler] 准备执行计划: id={schedule.id}, sat_id={schedule.sat_id}, cmd={schedule.command}")
                        
                        # 原子性标记为已执行（防止并发重复执行）
                        result = await session.execute(
                            sql_update(LightSchedule)
                            .where(LightSchedule.id == schedule.id, LightSchedule.executed == False)
                            .values(executed=True)
                            .execution_options(synchronize_session=None)
                        )
                        print(f"[LightScheduler] UPDATE executed rowcount={result.rowcount}")
                        if result.rowcount == 0:
                            print(f"[LightScheduler] 计划 {schedule.id} 已被其他实例执行，跳过")
                            continue
                        
                        command = schedule.command.lower()
                        light_state = command == "on"
                        
                        # 更新 satellites 表
                        from datetime import datetime
                        from ..db.models import Satellite
                        sat_result = await session.execute(
                            select(Satellite).where(Satellite.sat_id == schedule.sat_id)
                        )
                        sat = sat_result.scalars().first()
                        print(f"[LightScheduler] 查询卫星 {schedule.sat_id}: {'找到' if sat else '未找到'}")
                        if sat:
                            old_state = sat.light_state
                            sat.light_state = light_state
                            sat.updated_at = datetime.utcnow()
                            print(f"[LightScheduler] 卫星 {schedule.sat_id} light_state: {old_state} -> {light_state}")
                        else:
                            print(f"[LightScheduler] ⚠️ 警告: 卫星 {schedule.sat_id} 不在数据库中！")
                        
                        # 更新内存星座
                        if self._constellation:
                            try:
                                mem_sat = self._constellation.get_satellite(schedule.sat_id)
                                if mem_sat:
                                    mem_sat.set_light(light_state)
                                    print(f"[LightScheduler] 内存星座卫星 {schedule.sat_id} 已更新为 {light_state}")
                                else:
                                    print(f"[LightScheduler] ⚠️ 内存星座中未找到卫星 {schedule.sat_id}")
                            except (ValueError, AttributeError) as e:
                                print(f"[LightScheduler] 更新内存星座失败: {e}")
                        
                        executed_schedules.append({
                            "id": schedule.id,
                            "sat_id": schedule.sat_id,
                            "command": command,
                            "trigger_time": schedule.trigger_time,
                            "trigger_step": schedule.trigger_step,
                        })
                
                if executed_schedules:
                    print(f"[LightScheduler] 提交事务: {len(executed_schedules)} 个计划")
                    await session.commit()
                    print(f"[LightScheduler] 事务已提交")
                    
                    # 强制验证：重新查询 DB 确认 light_state 是否已持久化
                    for sched in executed_schedules:
                        verify_result = await session.execute(
                            select(Satellite).where(Satellite.sat_id == sched["sat_id"])
                        )
                        verify_sat = verify_result.scalars().first()
                        if verify_sat:
                            print(f"[LightScheduler] 验证 DB: sat_id={sched['sat_id']} light_state={verify_sat.light_state} (期望 {sched['command'] == 'on'})")
                        else:
                            print(f"[LightScheduler] ⚠️ 验证 DB: sat_id={sched['sat_id']} 不存在！")
                    
                    # 构建 TransferFrame 格式的日志
                    from ..protocol.transfer_frame import TransferFrame, SubMessage
                    from ..protocol.constants import PacketType, MsgType, LightCommand
                    
                    for sched in executed_schedules:
                        cmd_byte = LightCommand.TURN_ON if sched["command"] == "on" else LightCommand.TURN_OFF
                        state_byte = LightCommand.STATE_ON if sched["command"] == "on" else LightCommand.STATE_OFF
                        
                        # 构建子消息: [Command_Type(1B), Light_State(1B)]
                        payload = bytes([cmd_byte, state_byte])
                        
                        sub_msg = SubMessage(
                            msg_id=MsgType.LIGHT_CONTROL,
                            dest_id=sched["sat_id"],
                            data=payload
                        )
                        
                        frame = TransferFrame(
                            version=1,
                            scid=0x0001,
                            vcid=0,
                            frame_count=sched["id"] & 0xFFFF,
                            packet_type=PacketType.LIGHT_CONTROL,
                            dest_id=sched["sat_id"],
                            packet_id=sched["id"] & 0xFFFF,
                            messages=[sub_msg]
                        )
                        
                        print(f"[LightScheduler] 发送灯光控制帧: {frame}")
                    
                    print(f"[LightScheduler] 执行了 {len(executed_schedules)} 个灯光计划")
                else:
                    print(f"[LightScheduler] 本步无计划可执行")
        
        except Exception as e:
            import traceback
            print(f"[LightScheduler] 检查灯光计划失败: {e}")
            traceback.print_exc()
        
        self._last_checked_step = current_step
        return executed_schedules
