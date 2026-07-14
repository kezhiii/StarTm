"""
FastAPI 入口点

使用 FastAPI 替代原有的 HTTP 服务器（server.py + csv_api.py）。
WebSocket 已整合到 FastAPI 应用中（Phase 3）。
"""

from __future__ import annotations
import os
import sys
import signal

DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(DIR)
if DIR not in sys.path:
    sys.path.insert(0, DIR)

import uvicorn

from server.config import AppConfig, ConstellationSetup
from server.core import Constellation, PropagationState
from server.propagators import PerturbedOrbitPropagator
from server.services import PropagationService, CsvService
from server.core.exceptions import (
    ConfigError,
    ConfigFileNotFoundError,
    CsvFileNotFoundError,
    SatelliteError,
)
from server.fastapi_app.app import create_app


class FastAPIApplication:
    """
    FastAPI 版本的应用程序主类。

    职责：
    - 加载配置
    - 创建 FastAPI 应用（HTTP + WebSocket + 静态文件 + CSV API）
    - 启动 uvicorn 服务器
    """

    def __init__(self, config_path: str = None):
        self._config: AppConfig = None
        self._csv_service: CsvService = None
        self._fastapi_app = None

    def initialize(self, config_path: str = None) -> None:
        """初始化应用程序"""
        print("[FastAPI-App] 正在初始化...")

        if config_path is None:
            config_path = os.path.join(DIR, "config", "default.yaml")

        try:
            self._config = AppConfig.load(config_path)
        except FileNotFoundError as e:
            raise ConfigFileNotFoundError(config_path) from e

        print(f"[FastAPI-App] 配置加载成功")

        # 创建 CSV 服务
        csv_path = os.path.join(DIR, self._config.csv.default_path)
        if not os.path.exists(csv_path):
            print(f"[FastAPI-App] 警告: CSV 文件不存在: {csv_path}")
        else:
            self._csv_service = CsvService(csv_path=csv_path, compress=self._config.csv.compress)
            self._csv_service.load()
            print(f"[FastAPI-App] CSV 服务初始化成功")

        # 创建灯光控制星座
        light_control_constellation = Constellation.from_input_files(
            self._config.get_center_oe_path(),
            self._config.get_deputy_oe_path(),
        )
        print(f"[FastAPI-App] 灯光控制星座初始化成功")

        # 创建协议日志记录器（启用 DB 双写）
        from server.services.protocol_logger import ProtocolLogger
        protocol_logger = ProtocolLogger(log_dir="log", db_enabled=True)

        # 创建传播服务工厂（每个 WebSocket 客户端独立实例）
        def create_propagation_service_factory():
            client_constellation = Constellation.from_input_files(
                self._config.get_center_oe_path(),
                self._config.get_deputy_oe_path()
            )
            return PropagationService(
                constellation=client_constellation,
                propagator=PerturbedOrbitPropagator(),
                buffer_capacity=self._config.propagation.buffer_capacity,
            )

        # 创建 FastAPI 应用（包含 WebSocket 整合）
        self._fastapi_app = create_app(
            csv_service=self._csv_service,
            config=self._config,
            web_dir=os.path.join(DIR, "web"),
            db_enabled=True,
            constellation=light_control_constellation,
            propagation_service_factory=create_propagation_service_factory,
            protocol_logger=protocol_logger,
        )
        print("[FastAPI-App] FastAPI 应用创建成功")

    def start(self) -> None:
        """启动所有服务"""
        if self._config is None:
            raise RuntimeError("应用程序未初始化")

        print("\n" + "=" * 60)
        print("巨型星座 3D 可视化系统 - FastAPI 模式启动")
        print("=" * 60)
        print(f"HTTP:      http://0.0.0.0:{self._config.server.http_port}")
        print(f"WebSocket: ws://0.0.0.0:{self._config.server.http_port}/ws/<client_id>")
        print("=" * 60)

        # 注册信号处理器
        self._register_signal_handlers()

        # 启动 FastAPI 服务器（uvicorn，单进程单事件循环）
        self._start_fastapi_server()

    def _start_fastapi_server(self) -> None:
        """启动 FastAPI 服务器（uvicorn）"""
        uvicorn.run(
            self._fastapi_app,
            host="0.0.0.0",
            port=self._config.server.http_port,
            log_level="info",
        )

    def _register_signal_handlers(self) -> None:
        """注册信号处理器"""
        def signal_handler(signum, frame):
            sig_name = signal.Signals(signum).name
            print(f"\n[FastAPI-App] 收到信号 {sig_name}，正在关闭...")
            self.shutdown()

        try:
            signal.signal(signal.SIGINT, signal_handler)
            signal.signal(signal.SIGTERM, signal_handler)
            if hasattr(signal, 'SIGHUP'):
                signal.signal(signal.SIGHUP, signal_handler)
        except (ValueError, OSError):
            pass

    def shutdown(self) -> None:
        """优雅关闭"""
        print("\n[FastAPI-App] 正在停止服务...")
        print("[FastAPI-App] 所有服务已停止")

    def __repr__(self) -> str:
        return f"FastAPIApplication(config={self._config})"


def main(config_path: str = None) -> None:
    """主函数"""
    app = FastAPIApplication(config_path)

    try:
        app.initialize(config_path)
        app.start()
    except ConfigError as e:
        print(f"[FastAPI-App] 配置错误: {e}")
        sys.exit(1)
    except SatelliteError as e:
        print(f"[FastAPI-App] 卫星错误: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[FastAPI-App] 未知错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
