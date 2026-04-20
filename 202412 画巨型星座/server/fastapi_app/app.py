"""
FastAPI 应用工厂

创建并配置 FastAPI 应用实例。
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from .routes.csv import router as csv_router
from .routes.config import router as config_router
from .routes.logs import router as logs_router
from .lifespan import lifespan
from .dependencies import init_dependencies
from ..services.csv_service import CsvService
from ..config.app_config import AppConfig


def create_app(
    csv_service: CsvService,
    config: AppConfig,
    web_dir: str = "web",
    db_enabled: bool = False,
) -> FastAPI:
    """
    创建 FastAPI 应用实例。

    Args:
        csv_service: CSV 服务实例
        config: 应用配置
        web_dir: 前端静态资源目录
        db_enabled: 是否启用数据库功能

    Returns:
        FastAPI 应用实例
    """
    app = FastAPI(
        title="巨型星座 3D 可视化系统",
        description="基于 Web 的巨型星座（卫星编队）3D 可视化系统，支持 CSV 历史数据回放和 WebSocket 实时数据流。",
        version="3.1",
        lifespan=lifespan if db_enabled else None,
    )

    # CORS 中间件
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
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

    # 根路径重定向到前端页面
    @app.get("/")
    async def root():
        return FileResponse(str(web_path / "index.html"))

    @app.get("/health")
    async def health_check():
        return {"status": "ok", "version": "3.1"}

    return app
