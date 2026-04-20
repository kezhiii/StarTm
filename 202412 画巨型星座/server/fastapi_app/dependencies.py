"""
FastAPI 依赖注入
"""

from typing import Optional
from fastapi import Depends, HTTPException, status

from server.services.csv_service import CsvService
from server.config.app_config import AppConfig


_csv_service: Optional[CsvService] = None
_config: Optional[AppConfig] = None


def init_dependencies(csv_service: CsvService, config: Optional[AppConfig] = None) -> None:
    """
    初始化依赖项（在应用启动时调用）
    
    Args:
        csv_service: CSV 服务实例
        config: 应用配置（可选）
    """
    global _csv_service, _config
    _csv_service = csv_service
    _config = config


def get_csv_service() -> CsvService:
    """获取 CSV 服务实例"""
    if _csv_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CSV 服务未初始化"
        )
    return _csv_service


def get_config() -> Optional[AppConfig]:
    """获取应用配置"""
    return _config
