"""
数据库迁移脚本：为 light_schedules 表添加 duration_seconds 列

运行方式: python -m server.db.migrate_add_duration
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlalchemy import text
from server.db.session import init_engine, get_engine

async def migrate():
    init_engine()
    engine = get_engine()
    
    async with engine.begin() as conn:
        # 检查列是否存在
        result = await conn.execute(text("""
            SELECT COUNT(*) as cnt FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'light_schedules' 
            AND COLUMN_NAME = 'duration_seconds'
        """))
        row = result.fetchone()
        
        if row.cnt == 0:
            await conn.execute(text("""
                ALTER TABLE light_schedules 
                ADD COLUMN duration_seconds INT DEFAULT NULL
            """))
            print("[Migrate] 已添加 duration_seconds 列")
        else:
            print("[Migrate] duration_seconds 列已存在")

if __name__ == "__main__":
    asyncio.run(migrate())
