import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def test():
    engine = create_async_engine('mysql+aiomysql://root:Petway123@mysql:3306/petway')
    async with engine.connect() as conn:
        result = await conn.execute(text('SELECT id, name FROM member_plans LIMIT 3'))
        for row in result:
            print('member_plans:', row[0], repr(row[1]))
        
        result = await conn.execute(text('SELECT id, name FROM admin_menus LIMIT 3'))
        for row in result:
            print('admin_menus:', row[0], repr(row[1]))
            
        result = await conn.execute(text('SELECT id, title FROM articles LIMIT 3'))
        for row in result:
            print('articles:', row[0], repr(row[1]))
    await engine.dispose()

asyncio.run(test())
