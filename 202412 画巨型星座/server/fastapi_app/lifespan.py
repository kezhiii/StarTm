"""
FastAPI 应用生命周期管理

处理数据库初始化、连接池清理等启动/关闭事件。
"""

from __future__ import annotations
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from ..db.session import init_engine, create_tables, get_engine
from ..db.repositories.satellite_repo import SatelliteRepository
from ..db.repositories.neighbor_repo import NeighborRepository
from ..db.session import get_session_factory


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """
    FastAPI 应用生命周期管理器。
    
    启动时：
    1. 初始化数据库引擎
    2. 创建数据库表（开发环境）
    3. 将星座数据同步到数据库（首次启动时种子化）
    
    关闭时：
    1. 清理数据库连接池
    """
    # 启动事件
    print("[Lifespan] 应用启动中...")
    
    try:
        init_engine()
        print("[Lifespan] 数据库引擎已初始化")
        
        # 开发环境：自动创建表
        # 生产环境应使用 Alembic 迁移
        await create_tables()
        print("[Lifespan] 数据库表已确认")
        
        # 将星座数据同步到数据库
        constellation = getattr(app.state, "constellation", None)
        if constellation:
            await _seed_constellation_to_db(constellation)
        
    except Exception as e:
        print(f"[Lifespan] 数据库初始化失败（将使用文件日志）: {e}")
    
    print("[Lifespan] 应用启动完成")
    
    yield
    
    # 关闭事件
    print("[Lifespan] 应用关闭中...")
    
    try:
        engine = get_engine()
        await engine.dispose()
        print("[Lifespan] 数据库连接池已清理")
    except Exception as e:
        print(f"[Lifespan] 连接池清理错误: {e}")
    
    print("[Lifespan] 应用已关闭")


async def _seed_constellation_to_db(constellation) -> None:
    """
    将星座数据同步到数据库。
    
    如果数据库中已有卫星数据，则跳过（避免重复插入）。
    否则将内存中的星座数据写入数据库。
    """
    try:
        session_factory = get_session_factory()
        async with session_factory() as session:
            sat_repo = SatelliteRepository(session)
            neighbor_repo = NeighborRepository(session)
            
            # 检查是否已有数据
            existing_count = await sat_repo.count()
            if existing_count > 0:
                print(f"[Lifespan] 数据库已有 {existing_count} 颗卫星，跳过种子化")
                return
            
            # 种子化星座数据
            result = await constellation.save_to_db(sat_repo, neighbor_repo)
            await session.commit()
            
            print(f"[Lifespan] 星座已同步到数据库: {result['satellites']} 颗卫星, {result['neighbors']} 条邻星关系")
            
    except Exception as e:
        print(f"[Lifespan] 星座同步到数据库失败: {e}")
