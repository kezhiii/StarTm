"""
FastAPI 响应模型
"""

from pydantic import BaseModel
from typing import Any, List, Optional


class CsvMetaResponse(BaseModel):
    """CSV 元信息响应"""
    total_timestamps: int
    sat_count: int
    total_rows: int
    load_time_ms: float
    format: str


class CsvDataResponse(BaseModel):
    """CSV 数据响应"""
    meta: CsvMetaResponse
    columns: List[str]
    timestamps: List[str]
    data: List[List[Any]]


class CsvInfoResponse(BaseModel):
    """CSV 元信息端点响应"""
    meta: CsvMetaResponse
    columns: List[str]
    api_endpoints: dict


class ErrorResponse(BaseModel):
    """错误响应"""
    error: str
    code: int
