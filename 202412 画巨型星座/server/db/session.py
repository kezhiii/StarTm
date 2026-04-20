"""
数据库会话管理

提供异步 SQLAlchemy 引擎和会话工厂。
"""

from __future__ import annotations
import os
from typing import Optional
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

_engine = None
_session_factory: Optional[async_sessionmaker] = None


def get_database_url() -> str:
    """
    从环境变量获取数据库连接字符串。

    优先级: DATABASE_URL env var > .env 文件 > 默认值

    默认: mysql+aiomysql://root:root@localhost:3306/constellation_db
    """
    url = os.environ.get("DATABASE_URL")
    if url:
        return url

    # 尝试从 .env 文件读取
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_URL="):
                    return line.split("=", 1)[1].strip()

    # 默认值
    return "mysql+aiomysql://root:root@localhost:3306/constellation_db"


def init_engine(database_url: Optional[str] = None) -> None:
    """
    初始化数据库引擎。

    Args:
        database_url: 数据库连接字符串（如为 None 则从环境变量获取）
    """
    global _engine, _session_factory

    url = database_url or get_database_url()
    _engine = create_async_engine(
        url,
        echo=False,
        pool_size=5,
        max_overflow=10,
        pool_recycle=3600,
        pool_pre_ping=True,
    )
    _session_factory = async_sessionmaker(
        bind=_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    # Display database name without URL encoding for readability
    display_url = url.split("@")[-1] if "@" in url else url
    print(f"[DB] 引擎已初始化: {display_url}")


async def create_tables() -> None:
    """创建所有数据库表（开发环境使用，生产环境用 Alembic）"""
    if _engine is None:
        raise RuntimeError("数据库引擎未初始化，请先调用 init_engine()")

    async with _engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    print("[DB] 所有表已创建/确认存在")


async def drop_tables() -> None:
    """删除所有数据库表（仅开发/测试使用）"""
    if _engine is None:
        raise RuntimeError("数据库引擎未初始化")

    async with _engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
    print("[DB] 所有表已删除")


def get_engine():
    """获取数据库引擎"""
    if _engine is None:
        raise RuntimeError("数据库引擎未初始化")
    return _engine


def get_session_factory() -> async_sessionmaker:
    """获取会话工厂"""
    if _session_factory is None:
        raise RuntimeError("会话工厂未初始化")
    return _session_factory


async def get_session() -> AsyncSession:
    """
    获取数据库会话（用于 FastAPI Depends）。

    使用示例:
        @app.get("/items")
        async def get_items(session: AsyncSession = Depends(get_session)):
            ...
    """
    if _session_factory is None:
        raise RuntimeError("会话工厂未初始化")

    async with _session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
