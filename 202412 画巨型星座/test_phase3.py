"""Phase 3 功能测试：验证配置管理功能"""

import sys
import os
import math

# 确保能导入模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 60)
print("Phase 3: 配置管理 - 功能测试")
print("=" * 60)

# ======================== 测试 1: 导入模块 ========================
print("\n=== 测试 1: 导入模块 ===")
from server.config import AppConfig, ConstellationSetup
print("OK: 所有模块导入成功")

# ======================== 测试 2: 加载默认配置 ========================
print("\n=== 测试 2: 加载默认配置 ===")
config = AppConfig.load_default()
print(f"配置: {config}")
print(f"服务器: ws_host={config.server.ws_host}, ws_port={config.server.ws_port}")
print(f"递推: dt={config.propagation.dt}, buffer_capacity={config.propagation.buffer_capacity}")
print(f"星座: name='{config.constellation.name}', start={config.constellation.start_year}-{config.constellation.start_month}-{config.constellation.start_day}")
print(f"物理: mu={config.physics.mu}, RE={config.physics.RE}")
print(f"单位: deg_to_rad={config.units.deg_to_rad}")
print("OK: 默认配置加载成功")

# ======================== 测试 3: 配置验证 ========================
print("\n=== 测试 3: 配置验证 ===")
try:
    config.validate()
    print("OK: 配置验证通过")
except ValueError as e:
    print(f"FAIL: 配置验证失败: {e}")
    sys.exit(1)

# ======================== 测试 4: 计算 JD0 ========================
print("\n=== 测试 4: 计算 JD0 ===")
jd0 = config.compute_jd0()
print(f"起始儒略日 JD0 = {jd0}")

# 验证：2021-08-17 的儒略日应与旧代码一致
expected_jd0 = 2459446.0
assert abs(jd0 - expected_jd0) < 1.0, f"JD0 计算错误: 期望 {expected_jd0}, 得到 {jd0}"
print("OK: JD0 计算正确")

# ======================== 测试 5: 单位转换 ========================
print("\n=== 测试 5: 单位转换 ===")
assert config.units.hours_to_seconds == 3600
assert config.units.days_to_seconds == 86400
assert abs(config.units.deg_to_rad - math.pi / 180) < 1e-15

# 测试度转弧度
deg_55 = 55.0
rad_55 = deg_55 * config.units.deg_to_rad
expected_rad_55 = 55.0 * math.pi / 180
assert abs(rad_55 - expected_rad_55) < 1e-15
print("OK: 单位转换正确")

# ======================== 测试 6: 星座参数 ========================
print("\n=== 测试 6: 星座参数 ===")
params = config.constellation_params
print(f"轨道高度: {params.orbit_height / 1000:.0f} km")
print(f"轨道倾角: {params.inclination_deg} deg")
print(f"轨道面数: {params.plane_count}")
print(f"每轨道面卫星数: {params.satellites_per_plane}")
print(f"总卫星数: {params.total_satellites}")

assert params.orbit_height == 400000.0
assert params.inclination_deg == 55.0
assert params.plane_count == 20
assert params.satellites_per_plane == 15
assert params.total_satellites == 300
print("OK: 星座参数正确")

# ======================== 测试 7: ConstellationSetup ========================
print("\n=== 测试 7: ConstellationSetup ===")
setup = ConstellationSetup(config)
print(f"星座设置: {setup}")

# 验证轨道半径
expected_radius = config.physics.RE + config.constellation_params.orbit_height
assert abs(setup.orbit_radius - expected_radius) < 1e-6
print(f"轨道半径: {setup.orbit_radius / 1000:.0f} km")

# 验证倾角转换
expected_incl_rad = 55.0 * math.pi / 180
assert abs(setup.inclination_rad - expected_incl_rad) < 1e-15
print(f"轨道倾角: {math.degrees(setup.inclination_rad):.1f} deg")
print("OK: ConstellationSetup 创建成功")

# ======================== 测试 8: 轨道面 RAAN 计算 ========================
print("\n=== 测试 8: 轨道面 RAAN 计算 ===")
for plane_id in range(config.constellation_params.plane_count):
    raan = setup.compute_raan(plane_id)
    expected_raan = 2.0 * math.pi * plane_id / config.constellation_params.plane_count
    assert abs(raan - expected_raan) < 1e-15, f"RAAN 计算错误: plane_id={plane_id}"

print(f"RAAN 范围: 0 到 {math.degrees(setup.compute_raan(config.constellation_params.plane_count - 1)):.1f} deg")
print("OK: RAAN 计算正确")

# ======================== 测试 9: 卫星平近点角计算 ========================
print("\n=== 测试 9: 卫星平近点角计算 ===")
for plane_id in range(config.constellation_params.plane_count):
    for slot_id in range(config.constellation_params.satellites_per_plane):
        M = setup.compute_mean_anomaly(plane_id, slot_id)
        assert 0 <= M < 2.0 * math.pi or abs(M % (2.0 * math.pi)) < 1e-10, \
            f"平近点角超出范围: plane_id={plane_id}, slot_id={slot_id}, M={M}"

print("OK: 平近点角计算正确")

# ======================== 测试 10: 生成星座矩阵 ========================
print("\n=== 测试 10: 生成星座矩阵 ===")
import numpy as np

matrix = setup.generate_constellation_matrix()
print(f"矩阵形状: {matrix.shape}")
assert matrix.shape == (300, 6), f"矩阵形状错误: 期望 (300, 6), 得到 {matrix.shape}"

# 验证第一颗卫星 (plane=0, slot=0)
sat0 = matrix[0]
assert abs(sat0[0] - setup.orbit_radius) < 1e-6, f"a 错误: {sat0[0]}"
assert abs(sat0[1] - 0.0) < 1e-15, f"e 错误: {sat0[1]}"
assert abs(sat0[2] - setup.inclination_rad) < 1e-15, f"i 错误: {sat0[2]}"
assert abs(sat0[3] - 0.0) < 1e-15, f"RAAN 错误: {sat0[3]}"
assert abs(sat0[4] - 0.0) < 1e-15, f"omg 错误: {sat0[4]}"
assert abs(sat0[5] - 0.0) < 1e-15, f"M 错误: {sat0[5]}"

print(f"第一颗卫星: a={sat0[0]/1000:.0f}km, e={sat0[1]}, i={math.degrees(sat0[2]):.1f}deg")
print(f"最后一颗卫星: a={matrix[299,0]/1000:.0f}km, M={math.degrees(matrix[299,5]):.2f}deg")
print("OK: 星座矩阵生成正确")

# ======================== 测试 11: 索引转换 ========================
print("\n=== 测试 11: 索引转换 ===")
for plane_id in range(config.constellation_params.plane_count):
    for slot_id in range(config.constellation_params.satellites_per_plane):
        idx = setup.get_satellite_index(plane_id, slot_id)
        p, s = setup.get_plane_and_slot(idx)
        assert p == plane_id and s == slot_id, f"索引转换错误: ({plane_id}, {slot_id}) -> {idx} -> ({p}, {s})"

print("OK: 索引转换正确")

# ======================== 测试 12: 从文件加载星座矩阵 ========================
print("\n=== 测试 12: 从文件加载星座矩阵 ===")
center_path = config.get_center_oe_path()
deputy_path = config.get_deputy_oe_path()
print(f"主星文件: {center_path}")
print(f"从星文件: {deputy_path}")

if os.path.exists(center_path) and os.path.exists(deputy_path):
    setup.validate_paths(center_path, deputy_path)
    matrix_from_files = setup.generate_constellation_matrix_from_files(center_path, deputy_path)
    print(f"从文件加载的矩阵形状: {matrix_from_files.shape}")
    print(f"主星数量: 1, 从星数量: {matrix_from_files.shape[0] - 1}")
    print("OK: 从文件加载星座矩阵成功")
else:
    print("SKIP: 输入文件不存在（不影响核心功能）")

# ======================== 测试 13: 路径解析 ========================
print("\n=== 测试 13: 路径解析 ===")
input_path = config.get_input_path("test.txt")
assert "Input" in input_path and "test.txt" in input_path, f"路径解析错误: {input_path}"
print(f"输入路径: {input_path}")
print("OK: 路径解析正确")

# ======================== 测试 14: 配置 repr ========================
print("\n=== 测试 14: 配置 repr ===")
config_repr = repr(config)
print(f"AppConfig repr: {config_repr}")
assert "AppConfig" in config_repr
assert "Constellation" in config_repr

setup_repr = repr(setup)
print(f"ConstellationSetup repr: {setup_repr}")
assert "ConstellationSetup" in setup_repr
print("OK: repr 输出正确")

# ======================== 测试 15: 错误配置验证 ========================
print("\n=== 测试 15: 错误配置验证 ===")
# 测试无效端口
try:
    bad_config = AppConfig()
    bad_config.server.http_port = -1
    bad_config.validate()
    print("FAIL: 应该抛出 ValueError")
    sys.exit(1)
except ValueError as e:
    print(f"OK: 正确捕获无效端口错误: {e}")

# 测试无效时间步长
try:
    bad_config2 = AppConfig()
    bad_config2.propagation.dt = -1.0
    bad_config2.validate()
    print("FAIL: 应该抛出 ValueError")
    sys.exit(1)
except ValueError as e:
    print(f"OK: 正确捕获无效时间步长错误: {e}")

# 测试无效文件路径
try:
    setup.validate_paths("nonexistent.txt", "nonexistent2.txt")
    print("FAIL: 应该抛出 FileNotFoundError")
    sys.exit(1)
except FileNotFoundError as e:
    print(f"OK: 正确捕获文件不存在错误: {e}")

# ======================== 总结 ========================
print("\n" + "=" * 60)
print("Phase 3: 配置管理 - 所有测试通过!")
print("=" * 60)
