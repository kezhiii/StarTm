"""
FastAPI 应用生命周期管理

处理数据库初始化、连接池清理等启动/关闭事件。
"""

from __future__ import annotations
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from ..db.session import init_engine, create_tables, get_engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """
    FastAPI 应用生命周期管理器。
    
    启动时：
    1. 初始化数据库引擎
    2. 创建数据库表（开发环境）
    
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
