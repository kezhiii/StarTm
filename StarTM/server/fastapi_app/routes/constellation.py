"""
星座管理 API 路由

提供卫星查询、灯光控制、邻星关系管理等端点。
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from server.db.session import get_session
from server.db.repositories.satellite_repo import SatelliteRepository
from server.db.repositories.neighbor_repo import NeighborRepository
from server.db.models import Satellite as SatelliteModel

router = APIRouter(prefix="/api/satellites", tags=["satellites"])


@router.get("")
async def get_all_satellites(
    page: int = 1,
    page_size: int = 50,
    plane_index: Optional[int] = None,
    session: AsyncSession = Depends(get_session),
):
    """分页查询所有卫星"""
    repo = SatelliteRepository(session)

    if plane_index is not None:
        satellites = await repo.get_by_plane(plane_index)
    else:
        satellites = await repo.get_all()

    total = len(satellites)
    start = (page - 1) * page_size
    end = start + page_size
    page_sats = satellites[start:end]

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "satellites": [
            {
                "sat_id": s.sat_id,
                "semi_major_axis": s.semi_major_axis,
                "eccentricity": s.eccentricity,
                "inclination": s.inclination,
                "raan": s.raan,
                "argument_of_perigee": s.argument_of_perigee,
                "true_anomaly": s.true_anomaly,
                "mass": s.mass,
                "cross_section": s.cross_section,
                "drag_coefficient": s.drag_coefficient,
                "plane_index": s.plane_index,
                "slot_index": s.slot_index,
                "light_state": s.light_state,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            }
            for s in page_sats
        ],
    }


@router.get("/neighbors/all")
async def get_all_neighbor_map(
    session: AsyncSession = Depends(get_session),
):
    """获取所有卫星的邻星关系映射"""
    repo = NeighborRepository(session)
    neighbor_map = await repo.get_all_neighbor_map()

    return {
        "neighbor_map": neighbor_map,
        "total_relations": sum(len(v) for v in neighbor_map.values()),
    }


@router.get("/plane/{plane_index}")
async def get_satellites_by_plane(
    plane_index: int,
    session: AsyncSession = Depends(get_session),
):
    """获取指定轨道面的所有卫星"""
    repo = SatelliteRepository(session)
    satellites = await repo.get_by_plane(plane_index)

    return {
        "plane_index": plane_index,
        "count": len(satellites),
        "satellites": [
            {
                "sat_id": s.sat_id,
                "slot_index": s.slot_index,
                "light_state": s.light_state,
            }
            for s in satellites
        ],
    }


@router.get("/{sat_id}")
async def get_satellite(
    sat_id: int,
    session: AsyncSession = Depends(get_session),
):
    """获取单颗卫星详情（含邻星）"""
    sat_repo = SatelliteRepository(session)
    neighbor_repo = NeighborRepository(session)

    satellite = await sat_repo.get_by_id(sat_id)
    if satellite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Satellite {sat_id} not found",
        )

    neighbors = await neighbor_repo.get_neighbors(sat_id)

    return {
        "sat_id": satellite.sat_id,
        "semi_major_axis": satellite.semi_major_axis,
        "eccentricity": satellite.eccentricity,
        "inclination": satellite.inclination,
        "raan": satellite.raan,
        "argument_of_perigee": satellite.argument_of_perigee,
        "true_anomaly": satellite.true_anomaly,
        "mass": satellite.mass,
        "cross_section": satellite.cross_section,
        "drag_coefficient": satellite.drag_coefficient,
        "plane_index": satellite.plane_index,
        "slot_index": satellite.slot_index,
        "light_state": satellite.light_state,
        "neighbors": [
            {
                "neighbor_id": n.neighbor_id,
                "distance_km": n.distance_km,
                "calculated_at": n.calculated_at.isoformat() if n.calculated_at else None,
            }
            for n in neighbors
        ],
    }


@router.put("/{sat_id}/light")
async def update_light_state(
    sat_id: int,
    light_state: bool,
    session: AsyncSession = Depends(get_session),
):
    """更新卫星灯光状态（同步到 DB）"""
    repo = SatelliteRepository(session)
    success = await repo.update_light_state(sat_id, light_state)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Satellite {sat_id} not found",
        )

    return {
        "sat_id": sat_id,
        "light_state": light_state,
        "message": "Light state updated successfully",
    }


@router.get("/{sat_id}/neighbors")
async def get_satellite_neighbors(
    sat_id: int,
    session: AsyncSession = Depends(get_session),
):
    """获取卫星的邻星关系"""
    neighbor_repo = NeighborRepository(session)
    neighbors = await neighbor_repo.get_neighbors(sat_id)

    return {
        "sat_id": sat_id,
        "neighbors": [
            {
                "neighbor_id": n.neighbor_id,
                "distance_km": n.distance_km,
                "calculated_at": n.calculated_at.isoformat() if n.calculated_at else None,
            }
            for n in neighbors
        ],
    }
