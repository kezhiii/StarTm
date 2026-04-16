"""
统一启动入口

替代 start.py，使用面向对象架构启动所有服务。
支持优雅关闭、信号处理、资源清理。
"""

from __future__ import annotations
import os
import sys
import time
import signal
import threading
import asyncio
import logging
from typing import Optional
from http.server import HTTPServer
from socketserver import ThreadingMixIn

# 添加项目根目录到路径
DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(DIR)
if DIR not in sys.path:
    sys.path.insert(0, DIR)

from server.config import AppConfig, ConstellationSetup
from server.core import Constellation, PropagationState
from server.propagators import PerturbedOrbitPropagator
from server.services import PropagationService, CsvService, WsService
from server.api import CsvApiHandler
from server.core.exceptions import (
    ConfigError,
    ConfigFileNotFoundError,
    CsvFileNotFoundError,
    SatelliteError,
)


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """多线程 HTTP 服务器"""
    allow_reuse_address = True
    daemon_threads = True


class CacheControlHandler:
    """带缓存控制的 HTTP 请求处理器工厂"""

    @classmethod
    def create(cls, directory: str):
        """创建处理器类"""

        class Handler(__import__('http.server', fromlist=['SimpleHTTPRequestHandler']).SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=directory, **kwargs)

            def end_headers(self):
                self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
                self.send_header('Pragma', 'no-cache')
                self.send_header('Expires', '0')
                super().end_headers()

            def log_message(self, format, *args):
                print(f"[HTTP] {args[0]}")

        return Handler


class Application:
    """
    应用程序主类。

    职责：
    - 加载配置
    - 创建和初始化所有服务
    - 启动所有服务器
    - 处理优雅关闭
    """

    def __init__(self, config_path: Optional[str] = None):
        self._config: Optional[AppConfig] = None
        self._csv_service: Optional[CsvService] = None
        self._ws_service: Optional[WsService] = None
        self._http_server: Optional[HTTPServer] = None
        self._csv_api_server: Optional[HTTPServer] = None
        self._ws_loop: Optional[asyncio.AbstractEventLoop] = None
        self._ws_thread: Optional[threading.Thread] = None
        self._shutdown_event = threading.Event()
        self._is_running = False

    def initialize(self, config_path: Optional[str] = None) -> None:
        """
        初始化应用程序。

        Args:
            config_path: 配置文件路径（可选）
        """
        print("[App] 正在初始化...")

        # 1. 加载配置
        if config_path is None:
            config_path = os.path.join(DIR, "config", "default.yaml")

        try:
            self._config = AppConfig.load(config_path)
        except FileNotFoundError as e:
            raise ConfigFileNotFoundError(config_path) from e

        print(f"[App] 配置加载成功: {self._config}")

        # 2. 设置日志
        self._setup_logging()

        # 3. 创建 CSV 服务
        csv_path = os.path.join(DIR, self._config.csv.default_path)
        if not os.path.exists(csv_path):
            print(f"[App] 警告: CSV 文件不存在: {csv_path}，将跳过 CSV 服务")
        else:
            self._csv_service = CsvService(csv_path=csv_path, compress=self._config.csv.compress)
            self._csv_service.load()
            print(f"[App] CSV 服务初始化成功: {self._csv_service}")

        # 4. 创建星座和递推服务
        constellation_setup = ConstellationSetup(self._config)
        constellation = Constellation.from_input_files(
            self._config.get_center_oe_path(),
            self._config.get_deputy_oe_path()
        )
        print(f"[App] 星座初始化成功: {constellation}")

        propagator = PerturbedOrbitPropagator()
        propagator.warmup_jit()

        # 5. 创建 WebSocket 服务（多客户端版本）
        # 关键修复：每个客户端必须拥有完全独立的 Constellation 对象
        def create_propagation_service_factory():
            """为每个 WebSocket 客户端创建独立的传播服务"""
            # 关键修复：每个客户端独立加载星座数据，避免状态共享
            client_constellation = Constellation.from_input_files(
                self._config.get_center_oe_path(),
                self._config.get_deputy_oe_path()
            )
            return PropagationService(
                constellation=client_constellation,  # 每个客户端独立的星座对象
                propagator=PerturbedOrbitPropagator(),
                buffer_capacity=self._config.propagation.buffer_capacity,
            )
        
        self._ws_service = WsService(
            propagation_service_factory=create_propagation_service_factory,
            host=self._config.server.ws_host,
            port=self._config.server.ws_port,
        )
        print(f"[App] WebSocket 服务初始化成功: {self._ws_service}")

        # 6. 设置 API 处理器
        if self._csv_service:
            CsvApiHandler.set_csv_service(self._csv_service)

        print("[App] 初始化完成")

    def start(self) -> None:
        """启动所有服务"""
        if self._config is None:
            raise RuntimeError("应用程序未初始化，请先调用 initialize()")

        print("\n" + "=" * 60)
        print("巨型星座 3D 可视化系统 - 启动中")
        print("=" * 60)

        # 注册信号处理器
        self._register_signal_handlers()

        # 1. 启动 HTTP 服务器（静态资源）
        self._start_http_server()

        # 2. 启动 CSV API 服务器
        self._start_csv_api_server()

        # 3. 启动 WebSocket 服务器
        self._start_ws_server()

        self._is_running = True

        print("\n" + "=" * 60)
        print("所有服务已启动!")
        print("=" * 60)
        print(f"前端页面: http://localhost:{self._config.server.http_port}/web/index.html")
        print(f"HTTP 端口:    {self._config.server.http_port} (前端静态资源)")
        print(f"CSV API:      {self._config.server.csv_api_port} (CSV 预处理 API)")
        print(f"WebSocket:    {self._config.server.ws_port} (实时轨道递推)")
        print("\n按 Ctrl+C 停止所有服务")
        print("=" * 60)

        # 等待关闭信号
        try:
            while not self._shutdown_event.is_set():
                self._shutdown_event.wait(timeout=1)
        except KeyboardInterrupt:
            pass
        finally:
            self.shutdown()

    def shutdown(self) -> None:
        """优雅关闭所有服务"""
        if not self._is_running:
            return

        print("\n[App] 正在停止服务...")
        self._is_running = False

        # 1. 停止 WebSocket 服务（多客户端版本）
        if self._ws_service:
            # 新架构：WsService 自动管理所有客户端会话
            asyncio.run_coroutine_threadsafe(self._ws_service.stop(), self._ws_loop)
            print("[App] WebSocket 服务已停止")

        # 2. 停止 WebSocket 事件循环
        if self._ws_loop and self._ws_loop.is_running():
            self._ws_loop.call_soon_threadsafe(self._ws_loop.stop)
        if self._ws_thread and self._ws_thread.is_alive():
            self._ws_thread.join(timeout=5)
            print("[App] WebSocket 事件循环已停止")

        # 3. 停止 CSV API 服务器
        if self._csv_api_server:
            self._csv_api_server.shutdown()
            print("[App] CSV API 服务器已停止")

        # 4. 停止 HTTP 服务器
        if self._http_server:
            self._http_server.shutdown()
            print("[App] HTTP 服务器已停止")

        print("[App] 所有服务已停止")

    def _setup_logging(self) -> None:
        """设置日志"""
        logging.basicConfig(
            level=getattr(logging, self._config.logging.level, logging.INFO),
            format=self._config.logging.format,
        )

    def _start_http_server(self) -> None:
        """启动 HTTP 服务器"""
        handler = CacheControlHandler.create(DIR)
        self._http_server = ThreadedHTTPServer(
            ("", self._config.server.http_port),
            handler
        )
        http_thread = threading.Thread(
            target=self._http_server.serve_forever,
            daemon=True
        )
        http_thread.start()
        print(f"[App] HTTP 服务器已启动: http://localhost:{self._config.server.http_port}")

    def _start_csv_api_server(self) -> None:
        """启动 CSV API 服务器"""
        if self._csv_service is None:
            print("[App] 跳过 CSV API 服务器（CSV 服务未初始化）")
            return

        from server.api.csv_api import CsvApiHandler

        self._csv_api_server = ThreadedHTTPServer(
            ("", self._config.server.csv_api_port),
            CsvApiHandler
        )
        csv_api_thread = threading.Thread(
            target=self._csv_api_server.serve_forever,
            daemon=True
        )
        csv_api_thread.start()
        print(f"[App] CSV API 服务器已启动: http://localhost:{self._config.server.csv_api_port}")

    def _start_ws_server(self) -> None:
        """启动 WebSocket 服务器（多客户端版本）"""
        def run_ws_loop():
            self._ws_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._ws_loop)
            try:
                self._ws_loop.run_until_complete(self._ws_service.start())
                # 保持运行直到停止事件
                while not self._shutdown_event.is_set():
                    self._ws_loop.run_until_complete(asyncio.sleep(1))
            except Exception as e:
                print(f"[App] WebSocket 服务器错误: {e}")
            finally:
                self._ws_loop.run_until_complete(self._ws_service.stop())
                self._ws_loop.close()

        self._ws_thread = threading.Thread(target=run_ws_loop, daemon=True)
        self._ws_thread.start()
        print(f"[App] WebSocket 服务器已启动: ws://{self._config.server.ws_host}:{self._config.server.ws_port}")

    def _register_signal_handlers(self) -> None:
        """注册信号处理器"""
        def signal_handler(signum, frame):
            sig_name = signal.Signals(signum).name
            print(f"\n[App] 收到信号 {sig_name}，正在关闭...")
            self._shutdown_event.set()

        try:
            signal.signal(signal.SIGINT, signal_handler)
            signal.signal(signal.SIGTERM, signal_handler)
            if hasattr(signal, 'SIGHUP'):
                signal.signal(signal.SIGHUP, signal_handler)
        except (ValueError, OSError):
            # 信号处理器只能在主线程注册
            pass

    def __repr__(self) -> str:
        return f"Application(config={self._config}, running={self._is_running})"


def main(config_path: Optional[str] = None) -> None:
    """
    主函数。

    Args:
        config_path: 配置文件路径（可选）
    """
    app = Application()

    try:
        app.initialize(config_path)
        app.start()
    except ConfigError as e:
        print(f"[App] 配置错误: {e}")
        sys.exit(1)
    except SatelliteError as e:
        print(f"[App] 卫星错误: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[App] 未知错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
