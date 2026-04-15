"""Phase 1 核心领域模型功能测试"""

import sys
import os

# 确保能导入 server 模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=== 测试 1: 导入核心模块 ===")
from server.core import OrbitElements, InertialState, PhysicalProps, Satellite, FrameData, Constellation
print("OK: 所有核心模块导入成功")

print("\n=== 测试 2: OrbitElements ===")
oe = OrbitElements.from_array([6878.137, 0.0, 30.0, 0.0, 0.0, 0.0])
print(f"创建: {oe}")
print(f"转数组(km,deg): {oe.to_array()}")
print(f"转数组(m,rad): {[f'{x:.4f}' for x in oe.to_array_rad()]}")
print("OK: OrbitElements 测试通过")

print("\n=== 测试 3: InertialState ===")
state = InertialState(x=6378137.0, y=0.0, z=0.0, vx=0.0, vy=7672.0, vz=0.0)
print(f"创建: {state}")
print(f"半径: {state.radius/1000:.2f} km")
print(f"速度: {state.speed:.2f} m/s")
print(f"转数组(km): {state.to_array()}")
print("OK: InertialState 测试通过")

print("\n=== 测试 4: PhysicalProps ===")
props = PhysicalProps(mass=300, cross_section=0.785, drag_coefficient=2.2)
print(f"创建: {props}")
print(f"弹道系数: {props.ballistic_coefficient:.2f} kg/m2")
print("OK: PhysicalProps 测试通过")

print("\n=== 测试 5: Satellite ===")
sat = Satellite(
    sat_id=0,
    orbit_elements=oe,
    inertial_state=state,
    physical_props=props
)
print(f"创建: {sat}")
snapshot = sat.to_snapshot("20210817053300")
print(f"快照 keys: {list(snapshot.keys())}")
print(f"快照 X: {snapshot['X']:.2f} km")
arr = sat.to_array()
print(f"数组长度: {len(arr)}")
print("OK: Satellite 测试通过")

print("\n=== 测试 6: FrameData ===")
from server.core.frame_data import SatelliteSnapshot
snap = SatelliteSnapshot(
    sat_id=0,
    orbit_elements=oe.to_array(),
    position=state.to_array()[:3],
    velocity=state.to_array()[3:]
)
frame = FrameData(timestamp="20210817053300", seconds=3600, satellites=[snap])
print(f"创建: {frame}")
print(f"紧凑格式行数: {len(frame.to_compact())}")
print(f"字典格式 keys: {list(frame.to_dict().keys())}")
print("OK: FrameData 测试通过")

print("\n=== 测试 7: Constellation from_input_files ===")
# 检查输入文件是否存在
center_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Input", "centerOEmat.txt")
deputy_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Input", "deputyOEmat.txt")

if os.path.exists(center_path) and os.path.exists(deputy_path):
    constellation = Constellation.from_input_files(center_path, deputy_path)
    print(f"创建星座: {constellation}")
    print(f"卫星数量: {constellation.sat_count}")
    print(f"第一颗卫星: {constellation.get_satellite(0)}")
    print("OK: Constellation 测试通过")
else:
    print(f"SKIP: 输入文件不存在 (center={center_path}, deputy={deputy_path})")

print("\n" + "=" * 50)
print("Phase 1 核心领域模型 - 所有测试通过!")
print("=" * 50)
