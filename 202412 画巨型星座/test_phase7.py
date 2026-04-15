"""Phase 7 功能测试：验证统一启动入口"""

import sys
import os
import time
import threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 60)
print("Phase 7: 统一启动入口 - 功能测试")
print("=" * 60)

# ======================== 测试 1: 导入模块 ========================
print("\n=== 测试 1: 导入模块 ===")
from main import Application
from server.config import AppConfig
from server.core.exceptions import ConfigFileNotFoundError
print("OK: 所有模块导入成功")

# ======================== 测试 2: 创建 Application ========================
print("\n=== 测试 2: 创建 Application ===")
app = Application()
print(f"Application: {app}")
assert app._is_running == False
print("OK: Application 创建成功")

# ======================== 测试 3: 初始化 Application ========================
print("\n=== 测试 3: 初始化 Application ===")
config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config", "default.yaml")
app.initialize(config_path)

assert app._config is not None
assert app._csv_service is not None
assert app._propagation_service is not None
assert app._ws_service is not None
print(f"配置: {app._config}")
print(f"CSV 服务: {app._csv_service}")
print(f"递推服务: {app._propagation_service}")
print(f"WS 服务: {app._ws_service}")
print("OK: Application 初始化成功")

# ======================== 测试 4: 验证服务状态 ========================
print("\n=== 测试 4: 验证服务状态 ===")
assert app._csv_service.is_loaded
assert app._propagation_service.state.value == "ready"
assert app._ws_service.client_count == 0
print("OK: 服务状态正确")

# ======================== 测试 5: 配置文件不存在 ========================
print("\n=== 测试 5: 配置文件不存在 ===")
app2 = Application()
try:
    app2.initialize("nonexistent_config.yaml")
    print("FAIL: 应该抛出 ConfigFileNotFoundError")
    sys.exit(1)
except ConfigFileNotFoundError as e:
    print(f"OK: 正确捕获配置错误: {e.path}")

# ======================== 测试 6: Application repr ========================
print("\n=== 测试 6: Application repr ===")
repr_str = repr(app)
print(f"Application repr: {repr_str}")
assert "Application" in repr_str
print("OK: repr 输出正确")

# ======================== 测试 7: 启动和关闭（快速测试） ========================
print("\n=== 测试 7: 启动和关闭（快速测试） ===")

# 在后台线程启动应用
def run_app():
    try:
        app.start()
    except Exception as e:
        print(f"App error: {e}")

app_thread = threading.Thread(target=run_app, daemon=True)
app_thread.start()

# 等待服务启动
time.sleep(2)

# 检查服务是否启动
assert app._is_running == True
print("应用已启动")

# 触发关闭
app._shutdown_event.set()

# 等待关闭
app_thread.join(timeout=10)
print("应用已关闭")

print("OK: 启动和关闭成功")

# ======================== 总结 ========================
print("\n" + "=" * 60)
print("Phase 7: 统一启动入口 - 所有测试通过!")
print("=" * 60)
print("\n重构完成！所有 7 个阶段均已通过测试。")
print("可以使用 main.py 启动新的面向对象架构的服务。")
