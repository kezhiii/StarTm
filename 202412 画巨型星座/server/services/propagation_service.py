"""
轨道递推服务

编排星座、推进器、缓冲区，提供流式轨道递推功能。
"""

from __future__ import annotations
import time
from typing import Optional, List, Callable

from ..core.constellation import Constellation
from ..core.frame_data import FrameData
from ..core.propagation_state import PropagationState
from ..propagators.base import OrbitPropagator
from ..infrastructure.buffer import RingBuffer


class StateTransitionError(Exception):
    """状态转换错误"""
    pass


class PropagationService:
    """
    轨道递推服务。
    
    职责：
    - 管理星座状态
    - 使用推进器递推轨道
    - 将结果缓存到环形缓冲区
    - 提供流式数据弹出接口
    - 支持暂停/恢复控制
    - 状态机管理
    """
    
    def __init__(
        self,
        constellation: Constellation,
        propagator: OrbitPropagator,
        buffer: Optional[RingBuffer] = None,
        buffer_capacity: int = 3600,
    ):
        """
        创建递推服务。
        
        Args:
            constellation: 星座实例
            propagator: 轨道推进器
            buffer: 自定义缓冲区（可选）
            buffer_capacity: 缓冲区容量（默认 3600 秒）
        """
        self._constellation = constellation
        self._propagator = propagator
        self._buffer = buffer or RingBuffer(capacity=buffer_capacity)
        self._current_step = 0
        self._state = PropagationState.READY
    
    @property
    def constellation(self) -> Constellation:
        """获取星座实例"""
        return self._constellation
    
    @property
    def propagator(self) -> OrbitPropagator:
        """获取推进器"""
        return self._propagator
    
    @property
    def current_step(self) -> int:
        """当前递推步数"""
        return self._current_step
    
    @property
    def state(self) -> PropagationState:
        """当前状态"""
        return self._state
    
    @property
    def is_running(self) -> bool:
        """是否正在运行"""
        return self._state == PropagationState.RUNNING
    
    @property
    def is_paused(self) -> bool:
        """是否已暂停"""
        return self._state == PropagationState.PAUSED
    
    @property
    def buffer_length(self) -> int:
        """缓冲区当前数据量"""
        return self._buffer.length
    
    def _transition_to(self, new_state: PropagationState) -> None:
        """
        转换到新状态。
        
        Args:
            new_state: 目标状态
            
        Raises:
            StateTransitionError: 非法状态转换
        """
        if not PropagationState.can_transition(self._state, new_state):
            raise StateTransitionError(
                f"非法状态转换: {self._state} -> {new_state}。"
                f"允许的转换: {PropagationState.get_valid_transitions(self._state)}"
            )
        self._state = new_state
    
    def compute_step(self, dt: float = 1.0) -> bool:
        """
        递推一步。
        
        Args:
            dt: 时间步长 (秒)，默认 1 秒
        
        Returns:
            是否成功递推（缓冲区满时返回 False）
        """
        if self._state != PropagationState.RUNNING:
            return False
        
        if self._buffer.is_full():
            return False
        
        # 递推星座
        self._constellation = self._propagator.propagate_constellation(
            self._constellation, dt, self._current_step
        )
        
        # 生成时间戳
        timestamp = self._seconds_to_timestamp(self._current_step + 1)
        
        # 生成帧数据
        frame = self._constellation.get_snapshot(timestamp)
        frame.seconds = self._current_step + 1
        
        # 存入缓冲区
        self._buffer.append(frame)
        self._current_step += 1
        
        return True
    
    def get_and_pop(self, n_seconds: int) -> List[FrameData]:
        """
        获取并弹出前 N 秒数据。
        
        Args:
            n_seconds: 弹出秒数
        
        Returns:
            FrameData 列表
        """
        return self._buffer.pop_front(n_seconds)
    
    def has_data(self, n_seconds: int) -> bool:
        """
        检查是否有 N 秒数据。
        
        Args:
            n_seconds: 需要的秒数
        
        Returns:
            是否有足够数据
        """
        return self._buffer.length >= n_seconds
    
    def start(self) -> None:
        """启动递推"""
        self._transition_to(PropagationState.RUNNING)
    
    def pause(self) -> None:
        """暂停递推"""
        self._transition_to(PropagationState.PAUSED)
    
    def resume(self) -> None:
        """恢复递推"""
        self._transition_to(PropagationState.RUNNING)
    
    def stop(self) -> None:
        """停止递推"""
        self._transition_to(PropagationState.STOPPED)
    
    def reset(self) -> None:
        """
        重置服务状态。
        
        必须先停止服务才能重置。
        """
        if self._state == PropagationState.RUNNING or self._state == PropagationState.PAUSED:
            self._transition_to(PropagationState.STOPPED)
        
        if self._state == PropagationState.READY:
            raise StateTransitionError(
                f"无法重置: 当前状态为 {self._state}。请先停止服务。"
            )
        
        if self._state == PropagationState.STOPPED:
            self._state = PropagationState.IDLE
        
        if self._state == PropagationState.IDLE:
            self._transition_to(PropagationState.READY)
        
        self._current_step = 0
        self._buffer.clear()
    
    def warmup_jit(self) -> None:
        """
        预热 JIT 编译器。
        
        如果推进器支持 JIT 预热，调用它。
        """
        if hasattr(self._propagator, 'warmup_jit'):
            self._propagator.warmup_jit()
    
    def _seconds_to_timestamp(self, total_seconds: int) -> str:
        """
        将秒偏移转换为时间戳字符串。
        
        Args:
            total_seconds: 从起始时间经过的秒数
        
        Returns:
            时间戳字符串 (如 "20210817053301")
        """
        # 默认起始时间：2021-08-17
        start_year, start_month, start_day = 2021, 8, 17
        
        days_offset = total_seconds // 86400
        seconds_in_day = total_seconds % 86400
        hour = seconds_in_day // 3600
        minute = (seconds_in_day % 3600) // 60
        second = seconds_in_day % 60
        day = start_day + days_offset
        month = start_month
        year = start_year
        
        days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        if (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0):
            days_in_month[1] = 29
        
        while day > days_in_month[month - 1]:
            day -= days_in_month[month - 1]
            month += 1
            if month > 12:
                month = 1
                year += 1
        
        return f"{year}{month:02d}{day:02d}{hour:02d}{minute:02d}{second:02d}"
    
    def __repr__(self) -> str:
        return (
            f"PropagationService(propagator={self._propagator.get_name()}, "
            f"state={self._state.value}, step={self._current_step}, "
            f"buffer={self._buffer.length}/{self._buffer.capacity})"
        )
