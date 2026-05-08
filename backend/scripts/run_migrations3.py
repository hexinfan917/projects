import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from sqlalchemy import text
from common.database import AsyncSessionLocal

async def run_migration(file_path: str):
    with open(file_path, 'r', encoding='utf-8') as f:
        sql = f.read()
    print(f'File: {file_path}')
    print(f'SQL length: {len(sql)}')
    statements = [s.strip() for s in sql.split(';') if s.strip()]
    print(f'Statements: {len(statements)}')
    for stmt in statements:
        print(f'  -> {stmt[:80]}...')
    async with AsyncSessionLocal() as session:
        for stmt in statements:
            try:
                result = await session.execute(text(stmt))
                print(f'  OK')
            except Exception as e:
                print(f'  ERROR: {e}')
        await session.commit()

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
