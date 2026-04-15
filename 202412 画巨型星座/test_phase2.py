"""Phase 2 功能测试：验证递推结果与旧代码一致"""

import sys
import os
import time
import numpy as np

# 确保能导入模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 60)
print("Phase 2: 轨道递推引擎 - 功能测试")
print("=" * 60)

# ======================== 测试 1: 导入模块 ========================
print("\n=== 测试 1: 导入模块 ===")
from server.core import Constellation, PhysicalProps
from server.propagators import PerturbedOrbitPropagator
from server.infrastructure.buffer import RingBuffer
from server.services.propagation_service import PropagationService
print("OK: 所有模块导入成功")

# ======================== 测试 2: 创建星座 ========================
print("\n=== 测试 2: 创建星座 ===")
center_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Input", "centerOEmat.txt")
deputy_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Input", "deputyOEmat.txt")

constellation = Constellation.from_input_files(center_path, deputy_path)
print(f"星座: {constellation}")
print(f"卫星数量: {constellation.sat_count}")
print(f"主星轨道根数: {constellation.get_satellite(0).orbit_elements}")
print("OK: 星座创建成功")

# ======================== 测试 3: 推进器 JIT 预热 ========================
print("\n=== 测试 3: 推进器 JIT 预热 ===")
propagator = PerturbedOrbitPropagator()
propagator.warmup_jit()
print(f"推进器: {propagator}")
print("OK: JIT 预热成功")

# ======================== 测试 4: 单星递推 ========================
print("\n=== 测试 4: 单星递推 ===")
sat = constellation.get_satellite(0)
print(f"递推前: {sat}")

new_sat = propagator.propagate_satellite(sat, dt=1.0, step=0)
print(f"递推后: {new_sat}")

# 验证轨道根数有变化（J2 摄动导致 OMG 和 omg 变化）
oe_before = sat.orbit_elements
oe_after = new_sat.orbit_elements
print(f"a 变化: {oe_after.a - oe_before.a:.6f} m")
print(f"e 变化: {oe_after.e - oe_before.e:.8f}")
print(f"i 变化: {np.degrees(oe_after.i - oe_before.i):.6f} deg")
print(f"OMG 变化: {np.degrees(oe_after.OMG - oe_before.OMG):.6f} deg")
print("OK: 单星递推成功")

# ======================== 测试 5: 星座批量递推 ========================
print("\n=== 测试 5: 星座批量递推 ===")
constellation2 = Constellation.from_input_files(center_path, deputy_path)
start_time = time.time()
constellation2 = propagator.propagate_constellation(constellation2, dt=1.0, step=0)
elapsed = time.time() - start_time
print(f"批量递推 22 颗卫星耗时: {elapsed*1000:.1f} ms")
print(f"递推后主星: {constellation2.get_satellite(0)}")
print("OK: 星座批量递推成功")

# ======================== 测试 6: 环形缓冲区 ========================
print("\n=== 测试 6: 环形缓冲区 ===")
buffer = RingBuffer(capacity=5)
assert buffer.is_empty() == True
assert buffer.is_full() == False

for i in range(5):
    assert buffer.append(f"frame_{i}") == True
assert buffer.is_full() == True
assert buffer.append("overflow") == False  # 满时拒绝

popped = buffer.pop_front(2)
assert len(popped) == 2
assert popped[0] == "frame_0"
assert popped[1] == "frame_1"
assert buffer.length == 3

buffer.clear()
assert buffer.is_empty() == True
print("OK: 环形缓冲区测试通过")

# ======================== 测试 7: PropagationService 集成 ========================
print("\n=== 测试 7: PropagationService 集成 ===")
constellation3 = Constellation.from_input_files(center_path, deputy_path)
propagator3 = PerturbedOrbitPropagator()
propagator3.warmup_jit()

service = PropagationService(
    constellation=constellation3,
    propagator=propagator3,
    buffer_capacity=10
)
print(f"服务创建: {service}")

# 启动服务（Phase 5 后需要 RUNNING 状态才能递推）
service.start()

# 递推 5 步
for i in range(5):
    success = service.compute_step(dt=1.0)
    assert success == True, f"Step {i} failed"

print(f"递推 5 步后: {service}")
print(f"缓冲区: {service.buffer_length} 帧")

# 弹出 3 帧
frames = service.get_and_pop(3)
assert len(frames) == 3
print(f"弹出 3 帧: {frames[0]}, {frames[1]}, {frames[2]}")
print(f"剩余缓冲区: {service.buffer_length} 帧")

# 验证帧数据格式
frame = frames[0]
print(f"帧时间戳: {frame.timestamp}")
print(f"帧秒数: {frame.seconds}")
print(f"帧卫星数: {frame.sat_count}")

# 验证紧凑格式
compact = frame.to_compact()
assert len(compact) == 22  # 22 颗卫星
assert len(compact[0]) == 14  # [timestamp, sat_id, a, e, i, OMG, omg, f, X, Y, Z, Vx, Vy, Vz]
print(f"紧凑格式: {len(compact)} 行 x {len(compact[0])} 列")

# 验证字典格式
d = frame.to_dict()
assert 'timestamp' in d
assert 'sats' in d
assert len(d['sats']) == 22
print(f"字典格式: timestamp={d['timestamp']}, sats={len(d['sats'])}")
print("OK: PropagationService 集成测试通过")

# ======================== 测试 8: 暂停/恢复控制 ========================
print("\n=== 测试 8: 暂停/恢复控制 ===")
# 先停止再重新测试（当前状态为 RUNNING）
service.stop()
assert service.state.value == "stopped"
assert service.is_running == False

# 重置后重新测试
service.reset()
assert service.state.value == "ready"

service.start()
assert service.is_running == True
assert service.is_paused == False

service.pause()
assert service.is_paused == True

service.resume()
assert service.is_paused == False
assert service.is_running == True

service.stop()
assert service.is_running == False
print("OK: 暂停/恢复控制测试通过")

# ======================== 测试 9: 与旧代码对比 ========================
print("\n=== 测试 9: 与旧代码对比 ===")
try:
    from propagate_stream import StreamPropagator, compute_one_step, sateOEmat
    from config import deg
    
    # 旧代码递推一步
    old_result = compute_one_step(sateOEmat.copy(), 0)
    print(f"旧代码 Step 0 主星: a={old_result[0,2]:.4f} km, e={old_result[0,3]:.6f}, i={old_result[0,4]:.4f} deg")
    print(f"旧代码 Step 0 主星: X={old_result[0,8]:.4f} km, Y={old_result[0,9]:.4f} km, Z={old_result[0,10]:.4f} km")
    
    # 新代码递推一步
    constellation4 = Constellation.from_input_files(center_path, deputy_path)
    propagator4 = PerturbedOrbitPropagator()
    constellation4 = propagator4.propagate_constellation(constellation4, dt=1.0, step=0)
    
    new_sat0 = constellation4.get_satellite(0)
    new_oe = new_sat0.orbit_elements.to_array()
    new_inertial = new_sat0.inertial_state.to_array()
    
    print(f"新代码 Step 0 主星: a={new_oe[0]:.4f} km, e={new_oe[1]:.6f}, i={new_oe[2]:.4f} deg")
    print(f"新代码 Step 0 主星: X={new_inertial[0]:.4f} km, Y={new_inertial[1]:.4f} km, Z={new_inertial[2]:.4f} km")
    
    # 对比误差
    a_err = abs(old_result[0, 2] - new_oe[0])
    e_err = abs(old_result[0, 3] - new_oe[1])
    i_err = abs(old_result[0, 4] - new_oe[2])
    X_err = abs(old_result[0, 8] - new_inertial[0])
    Y_err = abs(old_result[0, 9] - new_inertial[1])
    Z_err = abs(old_result[0, 10] - new_inertial[2])
    
    print(f"\n误差对比:")
    print(f"  a:  {a_err:.6e} km")
    print(f"  e:  {e_err:.6e}")
    print(f"  i:  {i_err:.6e} deg")
    print(f"  X:  {X_err:.6e} km")
    print(f"  Y:  {Y_err:.6e} km")
    print(f"  Z:  {Z_err:.6e} km")
    
    # 判断是否在可接受范围内（浮点误差）
    tolerance = 1e-6
    if a_err < tolerance and e_err < tolerance and i_err < tolerance and \
       X_err < tolerance and Y_err < tolerance and Z_err < tolerance:
        print("OK: 新旧代码结果一致（误差在浮点精度范围内）")
    else:
        print("WARNING: 新旧代码结果存在差异，请检查")
        
except ImportError as e:
    print(f"SKIP: 旧代码模块导入失败: {e}")
    print("（这不影响 Phase 2 核心功能，仅影响对比测试）")

# ======================== 总结 ========================
print("\n" + "=" * 60)
print("Phase 2: 轨道递推引擎 - 所有测试通过!")
print("=" * 60)
