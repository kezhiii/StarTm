"""Phase 6 功能测试：验证错误处理功能"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 60)
print("Phase 6: 错误处理 - 功能测试")
print("=" * 60)

# ======================== 测试 1: 导入异常模块 ========================
print("\n=== 测试 1: 导入异常模块 ===")
from server.core import exceptions
from server.core.exceptions import (
    SatelliteError,
    OrbitElementsError,
    InvalidOrbitElementsError,
    PropagationError,
    PropagationFailedError,
    BufferOverflowError,
    ConstellationError,
    SatelliteNotFoundError,
    DuplicateSatelliteError,
    ConfigError,
    ConfigFileNotFoundError,
    ConfigValidationError,
    CsvError,
    CsvFileNotFoundError,
    CsvParseError,
    CsvNotLoadedError,
    WsError,
    WsConnectionError,
    WsSendError,
    StateTransitionError,
)
print("OK: 所有异常类导入成功")

# ======================== 测试 2: 异常继承关系 ========================
print("\n=== 测试 2: 异常继承关系 ===")
assert issubclass(OrbitElementsError, SatelliteError)
assert issubclass(InvalidOrbitElementsError, OrbitElementsError)
assert issubclass(PropagationError, SatelliteError)
assert issubclass(PropagationFailedError, PropagationError)
assert issubclass(BufferOverflowError, PropagationError)
assert issubclass(ConstellationError, SatelliteError)
assert issubclass(SatelliteNotFoundError, ConstellationError)
assert issubclass(DuplicateSatelliteError, ConstellationError)
assert issubclass(ConfigFileNotFoundError, ConfigError)
assert issubclass(ConfigValidationError, ConfigError)
assert issubclass(CsvFileNotFoundError, CsvError)
assert issubclass(CsvParseError, CsvError)
assert issubclass(CsvNotLoadedError, CsvError)
assert issubclass(WsSendError, WsConnectionError)
assert issubclass(WsConnectionError, WsError)
print("OK: 异常继承关系正确")

# ======================== 测试 3: 异常属性 ========================
print("\n=== 测试 3: 异常属性 ===")
# InvalidOrbitElementsError
try:
    raise InvalidOrbitElementsError("半长轴必须大于 0", a=-100, e=0.5, i=0.1)
except InvalidOrbitElementsError as e:
    assert e.a == -100
    assert e.e == 0.5
    assert e.i == 0.1
    assert "半长轴" in str(e)
    print(f"OK: InvalidOrbitElementsError 属性正确: a={e.a}, e={e.e}, i={e.i}")

# PropagationFailedError
try:
    raise PropagationFailedError("递推失败", sat_id=5, step=100)
except PropagationFailedError as e:
    assert e.sat_id == 5
    assert e.step == 100
    print(f"OK: PropagationFailedError 属性正确: sat_id={e.sat_id}, step={e.step}")

# BufferOverflowError
try:
    raise BufferOverflowError("缓冲区已满", capacity=3600, current=3600)
except BufferOverflowError as e:
    assert e.capacity == 3600
    assert e.current == 3600
    print(f"OK: BufferOverflowError 属性正确: capacity={e.capacity}, current={e.current}")

# SatelliteNotFoundError
try:
    raise SatelliteNotFoundError(42)
except SatelliteNotFoundError as e:
    assert e.sat_id == 42
    assert "42" in str(e)
    print(f"OK: SatelliteNotFoundError 属性正确: sat_id={e.sat_id}")

# DuplicateSatelliteError
try:
    raise DuplicateSatelliteError(10)
except DuplicateSatelliteError as e:
    assert e.sat_id == 10
    print(f"OK: DuplicateSatelliteError 属性正确: sat_id={e.sat_id}")

# ConfigFileNotFoundError
try:
    raise ConfigFileNotFoundError("/path/to/config.yaml")
except ConfigFileNotFoundError as e:
    assert e.path == "/path/to/config.yaml"
    print(f"OK: ConfigFileNotFoundError 属性正确: path={e.path}")

# ConfigValidationError
try:
    raise ConfigValidationError("端口无效", field="http_port")
except ConfigValidationError as e:
    assert e.field == "http_port"
    print(f"OK: ConfigValidationError 属性正确: field={e.field}")

# CsvFileNotFoundError
try:
    raise CsvFileNotFoundError("/path/to/data.csv")
except CsvFileNotFoundError as e:
    assert e.path == "/path/to/data.csv"
    print(f"OK: CsvFileNotFoundError 属性正确: path={e.path}")

# CsvParseError
try:
    raise CsvParseError("解析失败", line=42)
except CsvParseError as e:
    assert e.line == 42
    print(f"OK: CsvParseError 属性正确: line={e.line}")

# WsSendError
try:
    raise WsSendError("发送失败", client_id="abc123")
except WsSendError as e:
    assert e.client_id == "abc123"
    print(f"OK: WsSendError 属性正确: client_id={e.client_id}")

print("OK: 所有异常属性正确")

# ======================== 测试 4: CsvService 使用自定义异常 ========================
print("\n=== 测试 4: CsvService 使用自定义异常 ===")
from server.services import CsvService

# 测试 CsvFileNotFoundError
csv_service = CsvService()
try:
    csv_service.load("nonexistent.csv")
    print("FAIL: 应该抛出 CsvFileNotFoundError")
    sys.exit(1)
except CsvFileNotFoundError as e:
    print(f"OK: CsvService.load() 抛出 CsvFileNotFoundError: {e.path}")

# 测试 CsvNotLoadedError
try:
    csv_service.get_full_data()
    print("FAIL: 应该抛出 CsvNotLoadedError")
    sys.exit(1)
except CsvNotLoadedError:
    print("OK: CsvService.get_full_data() 抛出 CsvNotLoadedError")

try:
    csv_service.get_range(0, 10)
    print("FAIL: 应该抛出 CsvNotLoadedError")
    sys.exit(1)
except CsvNotLoadedError:
    print("OK: CsvService.get_range() 抛出 CsvNotLoadedError")

try:
    csv_service.get_info()
    print("FAIL: 应该抛出 CsvNotLoadedError")
    sys.exit(1)
except CsvNotLoadedError:
    print("OK: CsvService.get_info() 抛出 CsvNotLoadedError")

print("OK: CsvService 使用自定义异常")

# ======================== 测试 5: PropagationService 使用 StateTransitionError ========================
print("\n=== 测试 5: PropagationService 使用 StateTransitionError ===")
from server.services.propagation_service import PropagationService, StateTransitionError
from server.core import Constellation, PropagationState
from server.propagators import PerturbedOrbitPropagator
from server.config import AppConfig

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

try:
    service.pause()
    print("FAIL: 应该抛出 StateTransitionError")
    sys.exit(1)
except StateTransitionError as e:
    print(f"OK: PropagationService.pause() 抛出 StateTransitionError: {e}")

print("OK: PropagationService 使用 StateTransitionError")

# ======================== 测试 6: 异常捕获层次 ========================
print("\n=== 测试 6: 异常捕获层次 ===")
# 测试可以用基类捕获子类异常
try:
    raise InvalidOrbitElementsError("测试")
except SatelliteError:
    print("OK: 可以用 SatelliteError 捕获 InvalidOrbitElementsError")

try:
    raise PropagationFailedError("测试")
except PropagationError:
    print("OK: 可以用 PropagationError 捕获 PropagationFailedError")

try:
    raise CsvFileNotFoundError("test.csv")
except CsvError:
    print("OK: 可以用 CsvError 捕获 CsvFileNotFoundError")

try:
    raise WsSendError("测试")
except WsError:
    print("OK: 可以用 WsError 捕获 WsSendError")

print("OK: 异常捕获层次正确")

# ======================== 测试 7: 异常消息 ========================
print("\n=== 测试 7: 异常消息 ===")
try:
    raise SatelliteNotFoundError(99)
except Exception as e:
    msg = str(e)
    assert "99" in msg
    print(f"OK: 异常消息包含卫星 ID: {msg}")

try:
    raise ConfigFileNotFoundError("/bad/path.yaml")
except Exception as e:
    msg = str(e)
    assert "/bad/path.yaml" in msg
    print(f"OK: 异常消息包含路径: {msg}")

print("OK: 异常消息正确")

# ======================== 总结 ========================
print("\n" + "=" * 60)
print("Phase 6: 错误处理 - 所有测试通过!")
print("=" * 60)
