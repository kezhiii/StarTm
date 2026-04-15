"""Phase 5 功能测试：验证状态管理功能"""

import sys
import os

# 确保能导入模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 60)
print("Phase 5: 状态管理 - 功能测试")
print("=" * 60)

# ======================== 测试 1: 导入模块 ========================
print("\n=== 测试 1: 导入模块 ===")
from server.core import PropagationState
from server.services.propagation_service import PropagationService, StateTransitionError
from server.core import Constellation
from server.propagators import PerturbedOrbitPropagator
from server.config import AppConfig
print("OK: 所有模块导入成功")

# ======================== 测试 2: PropagationState 枚举 ========================
print("\n=== 测试 2: PropagationState 枚举 ===")
assert PropagationState.IDLE.value == "idle"
assert PropagationState.INITIALIZING.value == "initializing"
assert PropagationState.READY.value == "ready"
assert PropagationState.RUNNING.value == "running"
assert PropagationState.PAUSED.value == "paused"
assert PropagationState.STOPPED.value == "stopped"
print("OK: 枚举值定义正确")

# ======================== 测试 3: 状态转换规则 ========================
print("\n=== 测试 3: 状态转换规则 ===")
# 合法转换
assert PropagationState.can_transition(PropagationState.IDLE, PropagationState.INITIALIZING)
assert PropagationState.can_transition(PropagationState.INITIALIZING, PropagationState.READY)
assert PropagationState.can_transition(PropagationState.READY, PropagationState.RUNNING)
assert PropagationState.can_transition(PropagationState.RUNNING, PropagationState.PAUSED)
assert PropagationState.can_transition(PropagationState.PAUSED, PropagationState.RUNNING)
assert PropagationState.can_transition(PropagationState.RUNNING, PropagationState.STOPPED)
assert PropagationState.can_transition(PropagationState.STOPPED, PropagationState.IDLE)

# 非法转换
assert not PropagationState.can_transition(PropagationState.IDLE, PropagationState.RUNNING)
assert not PropagationState.can_transition(PropagationState.READY, PropagationState.PAUSED)
assert not PropagationState.can_transition(PropagationState.PAUSED, PropagationState.IDLE)
assert not PropagationState.can_transition(PropagationState.STOPPED, PropagationState.RUNNING)
print("OK: 状态转换规则正确")

# ======================== 测试 4: 获取合法后续状态 ========================
print("\n=== 测试 4: 获取合法后续状态 ===")
idle_transitions = PropagationState.get_valid_transitions(PropagationState.IDLE)
assert PropagationState.INITIALIZING in idle_transitions
assert PropagationState.RUNNING not in idle_transitions

running_transitions = PropagationState.get_valid_transitions(PropagationState.RUNNING)
assert PropagationState.PAUSED in running_transitions
assert PropagationState.STOPPED in running_transitions
assert PropagationState.READY not in running_transitions
print("OK: 获取合法后续状态正确")

# ======================== 测试 5: PropagationService 初始状态 ========================
print("\n=== 测试 5: PropagationService 初始状态 ===")
config = AppConfig.load_default()
constellation = Constellation.from_input_files(
    config.get_center_oe_path(),
    config.get_deputy_oe_path()
)
propagator = PerturbedOrbitPropagator()
propagator.warmup_jit()

service = PropagationService(
    constellation=constellation,
    propagator=propagator,
    buffer_capacity=100
)
assert service.state == PropagationState.READY
assert service.is_running == False
assert service.is_paused == False
print(f"初始状态: {service.state}")
print("OK: 初始状态正确")

# ======================== 测试 6: 正常状态转换 ========================
print("\n=== 测试 6: 正常状态转换 ===")
# READY -> RUNNING
service.start()
assert service.state == PropagationState.RUNNING
assert service.is_running == True
print(f"start() -> {service.state}")

# RUNNING -> PAUSED
service.pause()
assert service.state == PropagationState.PAUSED
assert service.is_paused == True
print(f"pause() -> {service.state}")

# PAUSED -> RUNNING
service.resume()
assert service.state == PropagationState.RUNNING
assert service.is_running == True
print(f"resume() -> {service.state}")

# RUNNING -> STOPPED
service.stop()
assert service.state == PropagationState.STOPPED
assert service.is_running == False
print(f"stop() -> {service.state}")
print("OK: 正常状态转换成功")

# ======================== 测试 7: 非法状态转换 ========================
print("\n=== 测试 7: 非法状态转换 ===")
# 创建新服务
service2 = PropagationService(
    constellation=constellation,
    propagator=propagator,
    buffer_capacity=100
)

# 尝试从 READY 直接 pause（非法）
try:
    service2.pause()
    print("FAIL: 应该抛出 StateTransitionError")
    sys.exit(1)
except StateTransitionError as e:
    print(f"OK: 正确捕获非法转换: {e}")

# 尝试从 READY 直接 reset（需要先 stop）
try:
    service2.reset()
    print("FAIL: 应该抛出 StateTransitionError")
    sys.exit(1)
except StateTransitionError as e:
    print(f"OK: 正确捕获 reset 非法转换: {e}")

# 正确的 reset 流程：先 stop，再 reset
service2.stop()
assert service2.state == PropagationState.STOPPED
service2.reset()
assert service2.state == PropagationState.READY
assert service2.current_step == 0
print(f"OK: 正确流程 stop() -> reset() -> {service2.state}")

# ======================== 测试 8: 递推时状态检查 ========================
print("\n=== 测试 8: 递推时状态检查 ===")
service3 = PropagationService(
    constellation=constellation,
    propagator=propagator,
    buffer_capacity=100
)

# 未启动时递推应该返回 False
result = service3.compute_step(dt=1.0)
assert result == False
print(f"READY 状态递推: {result}")

# 启动后递推应该成功
service3.start()
result = service3.compute_step(dt=1.0)
assert result == True
assert service3.current_step == 1
print(f"RUNNING 状态递推: {result}, step={service3.current_step}")

# 暂停后递推应该返回 False
service3.pause()
result = service3.compute_step(dt=1.0)
assert result == False
assert service3.current_step == 1  # 步数不变
print(f"PAUSED 状态递推: {result}, step={service3.current_step}")
print("OK: 递推状态检查正确")

# ======================== 测试 9: 完整状态周期 ========================
print("\n=== 测试 9: 完整状态周期 ===")
service4 = PropagationService(
    constellation=constellation,
    propagator=propagator,
    buffer_capacity=100
)

# READY -> RUNNING -> PAUSED -> RUNNING -> STOPPED -> IDLE -> READY
service4.start()
assert service4.state == PropagationState.RUNNING

service4.pause()
assert service4.state == PropagationState.PAUSED

service4.resume()
assert service4.state == PropagationState.RUNNING

service4.stop()
assert service4.state == PropagationState.STOPPED

# STOPPED -> IDLE -> READY (通过 reset)
service4.reset()
assert service4.state == PropagationState.READY
assert service4.current_step == 0
assert service4.buffer_length == 0
print("OK: 完整状态周期成功")

# ======================== 测试 10: PropagationState repr ========================
print("\n=== 测试 10: PropagationState repr ===")
state_repr = repr(PropagationState.RUNNING)
print(f"PropagationState repr: {state_repr}")
assert "PropagationState.RUNNING" in state_repr
print("OK: repr 输出正确")

# ======================== 测试 11: PropagationService repr 包含状态 ========================
print("\n=== 测试 11: PropagationService repr 包含状态 ===")
service5 = PropagationService(
    constellation=constellation,
    propagator=propagator,
    buffer_capacity=100
)
service5.start()
service_repr = repr(service5)
print(f"PropagationService repr: {service_repr}")
assert "state=running" in service_repr
print("OK: repr 包含状态信息")

# ======================== 总结 ========================
print("\n" + "=" * 60)
print("Phase 5: 状态管理 - 所有测试通过!")
print("=" * 60)
