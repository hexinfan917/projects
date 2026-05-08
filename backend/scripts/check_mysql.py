import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import asyncio
from sqlalchemy import text
from common.database import AsyncSessionLocal

async def test():
    async with AsyncSessionLocal() as session:
        result = await session.execute(text('SELECT VERSION()'))
        version = result.scalar()
        print('MySQL version:', version)

asyncio.run(test())
