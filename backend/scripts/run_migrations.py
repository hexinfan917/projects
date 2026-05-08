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
                await session.execute(text(stmt))
        await session.commit()
    print(f'Executed: {file_path}')

async def main():
    base = Path(__file__).parent.parent / 'database' / 'migrations'
    files = sorted(base.glob('*.sql'))
    for f in files:
        if f.name >= '015_init_route_addons.sql':
            await run_migration(str(f))
    print('All migrations done.')

asyncio.run(main())
