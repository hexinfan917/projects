import sys
sys.path.insert(0, 'D:/projects/backend')

import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from common.database import AsyncEngine, get_async_session
from user_service.models import User

async def test_async_db():
    async for session in get_async_session():
        result = await session.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if user:
            print(f"找到用户: {user.nickname}")
        else:
            print("数据库中没有用户")

if __name__ == "__main__":
    from sqlalchemy import select
    asyncio.run(test_async_db())
