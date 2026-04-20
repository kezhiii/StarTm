"""
FastAPI 入口点

使用 FastAPI 替代原有的 HTTP 服务器（server.py + csv_api.py）。
WebSocket 服务保持独立运行（后续 Phase 3 整合）。
"""

from __future__ import annotations
import os
import sys
import threading
import asyncio
import signal

DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(DIR)
if DIR not in sys.path:
    sys.path.insert(0, DIR)

import uvicorn

from server.config import AppConfig, ConstellationSetup
from server.core import Constellation, PropagationState
from server.propagators import PerturbedOrbitPropagator
from server.services import PropagationService, CsvService, WsService
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
    - 创建 FastAPI 应用（HTTP + 静态文件 + CSV API）
    - 启动 uvicorn 服务器
    - 保持 WebSocket 服务独立运行（Phase 3 整合）
    """

    def __init__(self, config_path: str = None):
        self._config: AppConfig = None
        self._csv_service: CsvService = None
        self._ws_service: WsService = None
        self._ws_loop: asyncio.AbstractEventLoop = None
        self._ws_thread: threading.Thread = None
        self._shutdown_event = threading.Event()
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

        # 创建协议日志记录器
        from server.services.protocol_logger import ProtocolLogger
        protocol_logger = ProtocolLogger(log_dir="log")

        # 创建 WebSocket 服务
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

        self._ws_service = WsService(
            propagation_service_factory=create_propagation_service_factory,
            host=self._config.server.ws_host,
            port=self._config.server.ws_port,
            constellation=light_control_constellation,
            protocol_logger=protocol_logger,
        )
        print(f"[FastAPI-App] WebSocket 服务初始化成功")

        # 创建 FastAPI 应用
        self._fastapi_app = create_app(
            csv_service=self._csv_service,
            config=self._config,
            web_dir=os.path.join(DIR, "web"),
        )
        print("[FastAPI-App] FastAPI 应用创建成功")

    def start(self) -> None:
        """启动所有服务"""
        if self._config is None:
            raise RuntimeError("应用程序未初始化")

        print("\n" + "=" * 60)
        print("巨型星座 3D 可视化系统 - FastAPI 模式启动")
        print("=" * 60)

        # 注册信号处理器
        self._register_signal_handlers()

        # 启动 WebSocket 服务器（独立线程）
        self._start_ws_server()

        # 启动 FastAPI 服务器（主线程，uvicorn）
        self._start_fastapi_server()

    def _start_fastapi_server(self) -> None:
        """启动 FastAPI 服务器（uvicorn）"""
        uvicorn.run(
            self._fastapi_app,
            host="0.0.0.0",
            port=self._config.server.http_port,
            log_level="info",
        )

    def _start_ws_server(self) -> None:
        """启动 WebSocket 服务器（独立线程）"""
        def run_ws_loop():
            self._ws_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._ws_loop)
            try:
                self._ws_loop.run_until_complete(self._ws_service.start())
                while not self._shutdown_event.is_set():
                    self._ws_loop.run_until_complete(asyncio.sleep(1))
            except Exception as e:
                print(f"[FastAPI-App] WebSocket 服务器错误: {e}")
            finally:
                self._ws_loop.run_until_complete(self._ws_service.stop())
                self._ws_loop.close()

        self._ws_thread = threading.Thread(target=run_ws_loop, daemon=True)
        self._ws_thread.start()
        print(f"[FastAPI-App] WebSocket 服务器已启动: ws://{self._config.server.ws_host}:{self._config.server.ws_port}")

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

        if self._ws_service:
            self._shutdown_event.set()
            if self._ws_loop and self._ws_loop.is_running():
                self._ws_loop.call_soon_threadsafe(self._ws_loop.stop)
            if self._ws_thread and self._ws_thread.is_alive():
                self._ws_thread.join(timeout=5)
                print("[FastAPI-App] WebSocket 服务已停止")

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
