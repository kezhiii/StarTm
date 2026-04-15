"""
轨道递推状态枚举

定义递推服务的状态机和状态转换规则。
"""

from __future__ import annotations
from enum import Enum
from typing import Set


_VALID_TRANSITIONS: dict = {
    "idle": {"initializing", "ready"},
    "initializing": {"ready", "stopped"},
    "ready": {"running", "stopped", "idle"},
    "running": {"paused", "stopped"},
    "paused": {"running", "stopped"},
    "stopped": {"idle", "initializing"},
}


class PropagationState(Enum):
    """
    轨道递推状态。

    状态转换图：
        IDLE → INITIALIZING → READY → RUNNING ↔ PAUSED → STOPPED → IDLE
    """
    IDLE = "idle"
    INITIALIZING = "initializing"
    READY = "ready"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"

    @classmethod
    def can_transition(cls, from_state: 'PropagationState', to_state: 'PropagationState') -> bool:
        """
        检查状态转换是否合法。
        """
        allowed = _VALID_TRANSITIONS.get(from_state.value, set())
        return to_state.value in allowed

    @classmethod
    def get_valid_transitions(cls, state: 'PropagationState') -> Set['PropagationState']:
        """
        获取指定状态的合法后续状态。
        """
        allowed_values = _VALID_TRANSITIONS.get(state.value, set())
        return {cls(v) for v in allowed_values}

    def __repr__(self) -> str:
        return f"PropagationState.{self.name}"
