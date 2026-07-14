"""
FastAPI 依赖注入

使用 app.state 存储共享服务，避免全局可变状态。
"""

from typing import Optional
from fastapi import Depends, HTTPException, Request, status

from server.services.csv_service import CsvService
from server.config.app_config import AppConfig


def init_dependencies(csv_service: CsvService, config: Optional[AppConfig] = None) -> None:
    """
    初始化依赖项（在应用启动时调用，实际存储到 app.state）。

    注意：此函数仅为向后兼容保留。实际依赖通过 app.state 获取。
    """
    pass


def get_csv_service(request: Request) -> CsvService:
    """获取 CSV 服务实例"""
    csv_service: Optional[CsvService] = request.app.state.csv_service
    if csv_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CSV 服务未初始化"
        )
    return csv_service


def get_config(request: Request) -> Optional[AppConfig]:
    """获取应用配置"""
    return getattr(request.app.state, "config", None)
