"""
CSV API 路由

迁移自 server/api/csv_api.py
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response
from typing import Optional

from server.fastapi_app.dependencies import get_csv_service
from server.services.csv_service import CsvService

router = APIRouter(prefix="/api", tags=["csv"])


@router.get("/csv-data")
async def get_csv_data(
    format: str = "compact",
    csv_service: CsvService = Depends(get_csv_service),
    response: Response = None,
):
    """获取完整 CSV 数据"""
    if not csv_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CSV 数据未加载"
        )

    try:
        data = csv_service.get_full_data(format)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    json_bytes = csv_service.compress_json(data)
    is_compressed = len(json_bytes) != len(data)

    if is_compressed:
        response.headers["Content-Encoding"] = "gzip"

    response.headers["Content-Type"] = "application/json"
    return Response(content=json_bytes, media_type="application/json")


@router.get("/csv-info")
async def get_csv_info(
    csv_service: CsvService = Depends(get_csv_service),
):
    """获取 CSV 元信息"""
    if not csv_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CSV 数据未加载"
        )

    return csv_service.get_info()


@router.get("/csv-range")
async def get_csv_range(
    start: int = 0,
    end: Optional[int] = None,
    csv_service: CsvService = Depends(get_csv_service),
):
    """获取指定范围数据"""
    if not csv_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CSV 数据未加载"
        )

    try:
        if end is None:
            end = len(csv_service.meta.total_timestamps) if csv_service.meta else 0
        data = csv_service.get_range(start, end)
        return data
    except (ValueError, IndexError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"参数错误: {e}")
