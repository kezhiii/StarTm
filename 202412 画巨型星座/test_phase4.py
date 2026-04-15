"""Phase 4 功能测试：验证服务层功能"""

import sys
import os
import json

# 确保能导入模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 60)
print("Phase 4: 服务层重构 - 功能测试")
print("=" * 60)

# ======================== 测试 1: 导入模块 ========================
print("\n=== 测试 1: 导入模块 ===")
from server.services import CsvService, WsService, PropagationService
from server.api import CsvApiHandler, WsConnectionHandler
from server.core import Constellation
from server.propagators import PerturbedOrbitPropagator
from server.config import AppConfig
print("OK: 所有模块导入成功")

# ======================== 测试 2: CsvService 加载 ========================
print("\n=== 测试 2: CsvService 加载 ===")
csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Output", "test_1.csv")
csv_service = CsvService(csv_path=csv_path)
print(f"CSV 服务: {csv_service}")
print(f"已加载: {csv_service.is_loaded}")

data = csv_service.load()
print(f"加载后: {csv_service}")
print(f"时间戳数: {data.meta.total_timestamps}")
print(f"卫星数: {data.meta.sat_count}")
print(f"总行数: {data.meta.total_rows}")
print(f"加载耗时: {data.meta.load_time_ms}ms")
print(f"格式: {data.meta.format}")
print(f"列名: {data.columns}")
assert data.meta.total_timestamps > 0
assert data.meta.sat_count > 0
assert len(data.columns) == 13
print("OK: CsvService 加载成功")

# ======================== 测试 3: CsvService 获取完整数据 ========================
print("\n=== 测试 3: CsvService 获取完整数据 ===")
full_data = csv_service.get_full_data(fmt="compact")
assert "meta" in full_data
assert "timestamps" in full_data
assert "data" in full_data
assert "columns" in full_data
assert len(full_data["data"]) == data.meta.total_timestamps
print(f"完整数据: {len(full_data['data'])} 帧")
print("OK: 获取完整数据成功")

# ======================== 测试 4: CsvService 对象格式转换 ========================
print("\n=== 测试 4: CsvService 对象格式转换 ===")
obj_data = csv_service.get_full_data(fmt="object")
assert obj_data["meta"]["format"] == "object"
assert len(obj_data["data"]) > 0
# 验证第一帧第一颗卫星是字典
first_sat = obj_data["data"][0][0]
assert isinstance(first_sat, dict)
assert "sat_id" in first_sat
assert "a" in first_sat
assert "X" in first_sat
print(f"对象格式: 第一帧第一颗卫星 sat_id={first_sat['sat_id']}, a={first_sat['a']}")
print("OK: 对象格式转换成功")

# ======================== 测试 5: CsvService 范围查询 ========================
print("\n=== 测试 5: CsvService 范围查询 ===")
range_data = csv_service.get_range(0, 5)
assert len(range_data["timestamps"]) == 5
assert len(range_data["data"]) == 5
print(f"范围查询 [0:5]: {len(range_data['timestamps'])} 帧")
print(f"时间戳: {range_data['timestamps'][:3]}...")

# 测试边界情况
range_data2 = csv_service.get_range(100, 105)
assert len(range_data2["timestamps"]) == 5
print(f"范围查询 [100:105]: {len(range_data2['timestamps'])} 帧")
print("OK: 范围查询成功")

# ======================== 测试 6: CsvService 错误处理 ========================
print("\n=== 测试 6: CsvService 错误处理 ===")

# 测试未加载时获取数据
try:
    empty_service = CsvService()
    empty_service.get_full_data()
    print("FAIL: 应该抛出 RuntimeError")
    sys.exit(1)
except RuntimeError as e:
    print(f"OK: 正确捕获未加载错误: {e}")

# 测试范围参数错误
try:
    csv_service.get_range(100, 50)
    print("FAIL: 应该抛出 ValueError")
    sys.exit(1)
except ValueError as e:
    print(f"OK: 正确捕获范围错误: {e}")

# 测试文件不存在
try:
    bad_service = CsvService()
    bad_service.load("nonexistent.csv")
    print("FAIL: 应该抛出 FileNotFoundError")
    sys.exit(1)
except FileNotFoundError as e:
    print(f"OK: 正确捕获文件不存在错误: {e}")

# ======================== 测试 7: CsvService 元信息查询 ========================
print("\n=== 测试 7: CsvService 元信息查询 ===")
info = csv_service.get_info()
assert "meta" in info
assert "columns" in info
assert "api_endpoints" in info
assert info["meta"]["total_timestamps"] == data.meta.total_timestamps
print(f"元信息: {info['meta']}")
print(f"API 端点: {info['api_endpoints']}")
print("OK: 元信息查询成功")

# ======================== 测试 8: CsvService 压缩 ========================
print("\n=== 测试 8: CsvService 压缩 ===")
full_data = csv_service.get_full_data()
compressed = csv_service.compress_json(full_data)
uncompressed_size = len(json.dumps(full_data, separators=(",", ":")).encode("utf-8"))
print(f"原始大小: {uncompressed_size} bytes")
print(f"压缩大小: {len(compressed)} bytes")
print(f"压缩率: {len(compressed)/uncompressed_size*100:.1f}%")
assert len(compressed) < uncompressed_size
print("OK: 压缩功能正常")

# ======================== 测试 9: CsvService repr ========================
print("\n=== 测试 9: CsvService repr ===")
repr_str = repr(csv_service)
print(f"CsvService repr: {repr_str}")
assert "CsvService" in repr_str
assert "test_1.csv" in repr_str
print("OK: repr 输出正确")

# ======================== 测试 10: WsService 创建 ========================
print("\n=== 测试 10: WsService 创建 ===")
config = AppConfig.load_default()
constellation = Constellation.from_input_files(
    config.get_center_oe_path(),
    config.get_deputy_oe_path()
)
propagator = PerturbedOrbitPropagator()
propagator.warmup_jit()

prop_service = PropagationService(
    constellation=constellation,
    propagator=propagator,
    buffer_capacity=100
)

ws_service = WsService(
    propagation_service=prop_service,
    host="0.0.0.0",
    port=8765,
    initial_push_seconds=5,
    compute_interval=10,
    push_interval=10
)
print(f"WS 服务: {ws_service}")
assert ws_service.host == "0.0.0.0"
assert ws_service.port == 8765
assert ws_service.client_count == 0
assert ws_service.is_running == False
print("OK: WsService 创建成功")

# ======================== 测试 11: WsConnectionHandler 创建 ========================
print("\n=== 测试 11: WsConnectionHandler 创建 ===")
ws_handler = WsConnectionHandler(ws_service)
print(f"WS 处理器: {ws_handler}")
print("OK: WsConnectionHandler 创建成功")

# ======================== 测试 12: CsvApiHandler 创建 ========================
print("\n=== 测试 12: CsvApiHandler 创建 ===")
CsvApiHandler.set_csv_service(csv_service)
print(f"CSV API 处理器: {CsvApiHandler._csv_service}")
assert CsvApiHandler._csv_service is csv_service
print("OK: CsvApiHandler 创建成功")

# ======================== 测试 13: PropagationService 与 WsService 集成 ========================
print("\n=== 测试 13: PropagationService 与 WsService 集成 ===")
# 递推一些数据
for i in range(10):
    prop_service.compute_step(dt=1.0)

print(f"递推 10 步后: {prop_service}")
print(f"缓冲区: {prop_service.buffer_length} 帧")

# 弹出数据
frames = prop_service.get_and_pop(5)
assert len(frames) == 5
print(f"弹出 5 帧: {len(frames)} 帧")

# 验证帧数据格式
frame = frames[0]
compact = frame.to_compact()
assert len(compact) == constellation.sat_count
print(f"帧格式: {len(compact)} 颗卫星 x {len(compact[0])} 列")
print("OK: PropagationService 与 WsService 集成成功")

# ======================== 总结 ========================
print("\n" + "=" * 60)
print("Phase 4: 服务层重构 - 所有测试通过!")
print("=" * 60)
