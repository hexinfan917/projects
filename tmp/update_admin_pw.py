import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update
import bcrypt

DATABASE_URL = "mysql+aiomysql://root:Petway123@mysql:3306/petway?charset=utf8mb4"

async def main():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    password = 'admin123'
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    print('New hash:', hashed)
    
    async with async_session() as session:
        from app.models.admin_user import AdminUser
        result = await session.execute(select(AdminUser).where(AdminUser.username == 'admin'))
        admin = result.scalar_one_or_none()
        if admin:
            admin.password = hashed
            await session.commit()
            print('Password updated successfully')
        else:
            print('Admin user not found')
    
    await engine.dispose()

asyncio.run(main())
