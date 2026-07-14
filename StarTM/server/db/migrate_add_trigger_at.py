"""
迁移脚本：添加 trigger_at 列到 light_schedules 表

支持真实时间（wall-clock）调度模式。
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from sqlalchemy import text
from server.db.session import init_engine, get_engine


async def migrate():
    init_engine()
    engine = get_engine()

    async with engine.begin() as conn:
        # 检查列是否已存在
        result = await conn.execute(text("""
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'light_schedules'
            AND COLUMN_NAME = 'trigger_at'
        """))
        count = result.scalar()

        if count == 0:
            await conn.execute(text("""
                ALTER TABLE light_schedules
                ADD COLUMN trigger_at DATETIME NULL COMMENT '真实触发时间（UTC），用于 wallclock 模式'
            """))
            print("[Migrate] 已添加 trigger_at 列到 light_schedules 表")
        else:
            print("[Migrate] trigger_at 列已存在，跳过")

        # 同时更新 schedule_type 字段长度（如果之前有约束）
        await conn.execute(text("""
            ALTER TABLE light_schedules
            MODIFY COLUMN schedule_type VARCHAR(16) NOT NULL
            COMMENT '调度类型：absolute=仿真绝对时间, relative=相对仿真步, wallclock=真实时间'
        """))
        print("[Migrate] 已更新 schedule_type 字段注释")

    print("[Migrate] 迁移完成")


if __name__ == "__main__":
    asyncio.run(migrate())
