"""
迁移脚本：为 routes 表添加 is_hot 字段
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

from sqlalchemy import text
from common.database import engine


async def migrate():
    async with engine.begin() as conn:
        # 检查字段是否已存在
        result = await conn.execute(text("""
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'routes'
            AND COLUMN_NAME = 'is_hot'
        """))
        exists = result.scalar() > 0

        if exists:
            print("Column 'is_hot' already exists in routes table. Skipping.")
            return

        await conn.execute(text("""
            ALTER TABLE routes
            ADD COLUMN is_hot TINYINT NOT NULL DEFAULT 0 COMMENT '0非热门 1热门'
            AFTER is_safety_required
        """))
        await conn.execute(text("""
            CREATE INDEX idx_routes_is_hot ON routes(is_hot)
        """))
        print("Migration applied: added 'is_hot' column to routes table.")


if __name__ == "__main__":
    asyncio.run(migrate())
