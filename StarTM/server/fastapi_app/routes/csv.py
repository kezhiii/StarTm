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
):
    """获取完整 CSV 数据"""
    if not csv_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CSV 数据未加载"
        )

    try:
        payload, compressed = csv_service.get_payload(format)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # 注意：返回新建 Response 时，注入的 response 参数上设置的头会被丢弃，
    # 必须把头放进返回值；否则浏览器把 gzip 字节当 JSON，前端只能走 test_1 兜底
    headers = {"Content-Type": "application/json"}
    if compressed:
        headers["Content-Encoding"] = "gzip"

    return Response(content=payload, media_type="application/json", headers=headers)


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
