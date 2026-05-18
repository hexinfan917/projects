import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text
import bcrypt

DATABASE_URL = "mysql+aiomysql://root:Petway123@mysql:3306/petway?charset=utf8mb4"

async def main():
    engine = create_async_engine(DATABASE_URL, connect_args={"charset": "utf8mb4"})
    
    async with engine.connect() as conn:
        # Truncate tables
        await conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        await conn.execute(text("TRUNCATE TABLE admin_role_menus"))
        await conn.execute(text("TRUNCATE TABLE admin_menus"))
        await conn.execute(text("TRUNCATE TABLE admin_users"))
        await conn.execute(text("TRUNCATE TABLE admin_roles"))
        await conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        await conn.commit()
        print('Tables truncated')
    
    # Insert data using SQLAlchemy ORM
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        from app.models.admin_role import AdminRole
        from app.models.admin_user import AdminUser
        from app.models.admin_menu import AdminMenu
        from app.models.admin_role import admin_role_menus
        
        # Insert super admin role
        role = AdminRole(id=1, name="超级管理员", code="super_admin", description="拥有所有权限", status=1)
        session.add(role)
        await session.flush()
        
        # Insert admin user
        hashed = bcrypt.hashpw("admin123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        admin = AdminUser(id=1, username="admin", password=hashed, real_name="系统管理员", role_id=1, status=1)
        session.add(admin)
        await session.flush()
        
        # Insert menus
        menus_data = [
            (1, 0, "首页", "/home", "HomeOutlined", 1, 2, "home", 1),
            (2, 0, "用户管理", "/users", "UserOutlined", 10, 2, "users", 1),
            (3, 0, "路线管理", "/routes", "EnvironmentOutlined", 20, 2, "routes", 1),
            (4, 0, "订单管理", "/orders", "ShoppingCartOutlined", 30, 2, "orders", 1),
            (5, 0, "排期管理", "/schedules", "CalendarOutlined", 40, 2, "schedules", 1),
            (6, 0, "评价管理", "/evaluations", "StarOutlined", 50, 2, "evaluations", 1),
            (7, 0, "宠物档案", "/pets", "HeartOutlined", 60, 2, "pets", 1),
            (8, 0, "出行人管理", "/travelers", "TeamOutlined", 70, 2, "travelers", 1),
            (9, 0, "财务管理", "/finance", "DollarOutlined", 80, 2, "finance", 1),
            (10, 0, "系统设置", "/settings", "SettingOutlined", 90, 2, "settings", 1),
            (11, 0, "操作日志", "/logs", "FileTextOutlined", 100, 2, "logs", 1),
            (12, 0, "内容管理", "/articles", "FileOutlined", 110, 2, "articles", 1),
            (13, 0, "首页轮播", "/banners", "PictureOutlined", 120, 2, "banners", 1),
            (14, 0, "公益管理", "/charities", "GiftOutlined", 130, 2, "charities", 1),
            (15, 0, "行程选配", "/addons", "AppstoreOutlined", 140, 2, "addons", 1),
            (16, 0, "会员管理", "/member", "CrownOutlined", 150, 1, "member", 1),
            (17, 16, "会员套餐", "/member/plans", "", 1, 2, "member:plans", 1),
            (18, 16, "弹窗配置", "/member/popups", "", 2, 2, "member:popups", 1),
            (19, 0, "优惠券管理", "/coupons", "TagOutlined", 160, 2, "coupons", 1),
            (20, 0, "系统管理", "/system", "SafetyOutlined", 200, 1, "system", 1),
            (21, 20, "账号管理", "/system/admins", "", 1, 2, "system:admins", 1),
            (22, 20, "角色管理", "/system/roles", "", 2, 2, "system:roles", 1),
            (23, 20, "菜单管理", "/system/menus", "", 3, 2, "system:menus", 1),
        ]
        
        for m in menus_data:
            menu = AdminMenu(id=m[0], parent_id=m[1], name=m[2], path=m[3], icon=m[4], sort_order=m[5], type=m[6], permission=m[7], status=m[8])
            session.add(menu)
        
        await session.flush()
        
        # Insert role-menu mappings
        for menu_id in range(1, 24):
            await session.execute(admin_role_menus.insert().values(role_id=1, menu_id=menu_id))
        
        await session.commit()
        print('Data inserted successfully')
    
    await engine.dispose()

asyncio.run(main())
