import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import asyncio
from sqlalchemy import text
from common.database import AsyncSessionLocal

async def test():
    async with AsyncSessionLocal() as session:
        result = await session.execute(text('SHOW TABLES LIKE \"route_addons\"'))
        rows = result.fetchall()
        print('route_addons exists:', len(rows) > 0)
        result2 = await session.execute(text('SHOW COLUMNS FROM orders'))
        rows2 = result2.fetchall()
        for r in rows2:
            print(r[0])

asyncio.run(test())
