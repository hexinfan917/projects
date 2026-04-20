"""
修复 pet_profiles 表 breed 字段允许为空
"""
import asyncio
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from sqlalchemy import text
from common.database import engine

async def main():
    async with engine.begin() as conn:
        # MySQL
        try:
            await conn.execute(text("ALTER TABLE pet_profiles MODIFY breed VARCHAR(50) NULL"))
            print("✅ 已修改 pet_profiles.breed 为 nullable (MySQL)")
        except Exception as e:
            print(f"⚠️ MySQL 修改失败或不需要修改: {e}")
        # SQLite fallback
        try:
            await conn.execute(text("CREATE TABLE IF NOT EXISTS pet_profiles_new AS SELECT * FROM pet_profiles"))
            # SQLite 不支持直接 ALTER COLUMN，需要重建表，这里简单提示
            print("⚠️ SQLite 用户请手动重建表或删除旧数据库后重新初始化")
        except Exception:
            pass

if __name__ == '__main__':
    asyncio.run(main())
