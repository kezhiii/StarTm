"""
FastAPI 应用工厂

创建并配置 FastAPI 应用实例。
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from typing import Optional, Callable

from .routes.csv import router as csv_router
from .routes.config import router as config_router
from .routes.logs import router as logs_router
from .routes.constellation import router as constellation_router
from .routes.schedules import router as schedules_router
from .ws.router import router as ws_router
from .ws.manager import ConnectionManager
from .lifespan import lifespan
from .dependencies import init_dependencies
from ..services.csv_service import CsvService
from ..services.propagation_service import PropagationService
from ..config.app_config import AppConfig


def create_app(
    csv_service: CsvService,
    config: AppConfig,
    web_dir: str = "web",
    db_enabled: bool = False,
    constellation: Optional[object] = None,
    propagation_service_factory: Optional[Callable[[], PropagationService]] = None,
    protocol_logger: Optional[object] = None,
) -> FastAPI:
    """
    创建 FastAPI 应用实例。

    Args:
        csv_service: CSV 服务实例
        config: 应用配置
        web_dir: 前端静态资源目录
        db_enabled: 是否启用数据库功能
        constellation: 星座实例（用于启动时同步到数据库）
        propagation_service_factory: 传播服务工厂函数（用于 WebSocket）
        protocol_logger: 协议日志记录器

    Returns:
        FastAPI 应用实例
    """
    app = FastAPI(
        title="巨型星座 3D 可视化系统",
        description="基于 Web 的巨型星座（卫星编队）3D 可视化系统，支持 CSV 历史数据回放和 WebSocket 实时数据流。",
        version="3.1",
        lifespan=lifespan if db_enabled else None,
    )
    app.state.constellation = constellation if db_enabled else None
    app.state.csv_service = csv_service
    app.state.config = config

    # CORS 中间件
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,  # 不能与 allow_origins=["*"] 同时使用 True
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 初始化依赖注入
    init_dependencies(csv_service, config)

    # 注册路由
    app.include_router(csv_router)
    if db_enabled:
        app.include_router(config_router)
        app.include_router(logs_router)
        app.include_router(constellation_router)
        app.include_router(schedules_router)

    # WebSocket 管理器（如果提供了工厂函数）
    if propagation_service_factory:
        ws_manager = ConnectionManager(
            propagation_service_factory=propagation_service_factory,
            constellation=constellation,
            protocol_logger=protocol_logger,
        )
        app.state.ws_manager = ws_manager
        print(f"[App] WebSocket 管理器已初始化（最大 {ConnectionManager.MAX_CLIENTS} 客户端）")

    # 注册 WebSocket 路由
    app.include_router(ws_router)

    # 静态文件服务
    web_path = Path(web_dir)
    if web_path.exists():
        app.mount(
            "/web",
            StaticFiles(directory=str(web_path), html=True),
            name="web",
        )

    # Output 目录（CSV 数据文件）
    output_path = Path("Output")
    if output_path.exists():
        app.mount(
            "/Output",
            StaticFiles(directory=str(output_path)),
            name="output",
        )

    # sim 目录（飞行模拟仿真系统主界面）
    sim_path = Path("../sim")
    if sim_path.exists():
        app.mount(
            "/sim",
            StaticFiles(directory=str(sim_path), html=True),
            name="sim",
        )

    # sim-data 目录（飞行模拟仿真系统数据文件，三类自描述 CSV）
    simdata_path = Path("../sim-data")
    if simdata_path.exists():
        app.mount(
            "/sim-data",
            StaticFiles(directory=str(simdata_path)),
            name="sim-data",
        )

    # 根路径重定向到前端页面
    @app.get("/")
    async def root():
        return FileResponse(str(web_path / "index.html"))

    @app.get("/health")
    async def health_check():
        return {"status": "ok", "version": "3.1"}

    return app
