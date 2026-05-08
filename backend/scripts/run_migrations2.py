import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from sqlalchemy import text
from common.database import AsyncSessionLocal

async def run_migration(file_path: str):
    with open(file_path, 'r', encoding='utf-8') as f:
        sql = f.read()
    async with AsyncSessionLocal() as session:
        for stmt in sql.split(';'):
            stmt = stmt.strip()
            if stmt:
                try:
                    await session.execute(text(stmt))
                    print(f'OK: {stmt[:60]}...')
                except Exception as e:
                    print(f'ERROR: {stmt[:60]}... -> {e}')
        await session.commit()
    print(f'Finished: {file_path}')

async def main():
    files = [
        Path(__file__).parent.parent / 'database' / 'migrations' / '015_init_route_addons.sql',
        Path(__file__).parent.parent / 'database' / 'migrations' / '016_add_order_addons.sql',
    ]
    for f in files:
        if f.exists():
            await run_migration(str(f))
    print('Done.')

asyncio.run(main())
