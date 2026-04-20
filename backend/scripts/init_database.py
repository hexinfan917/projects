"""
数据库初始化脚本
创建所有表并插入初始数据
"""
import sys
from pathlib import Path

# 添加后端根目录到路径
backend_root = Path(__file__).parent.parent
sys.path.insert(0, str(backend_root))

import asyncio
from datetime import datetime, date, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from common.database import init_db, AsyncSessionLocal
from common.logger import setup_logger

logger = setup_logger("init_db")


async def init_users_data(session):
    """初始化用户相关数据"""
    # 动态导入模型
    import importlib.util
    user_models_path = backend_root / "user-service" / "app" / "models" / "user.py"
    pet_models_path = backend_root / "user-service" / "app" / "models" / "pet.py"
    
    user_spec = importlib.util.spec_from_file_location("user_models", user_models_path)
    user_module = importlib.util.module_from_spec(user_spec)
    sys.modules["user_models"] = user_module
    user_spec.loader.exec_module(user_module)
    User = user_module.User
    
    pet_spec = importlib.util.spec_from_file_location("pet_models", pet_models_path)
    pet_module = importlib.util.module_from_spec(pet_spec)
    sys.modules["pet_models"] = pet_module
    pet_spec.loader.exec_module(pet_module)
    PetProfile = pet_module.PetProfile
    
    # 检查是否已有数据
    result = await session.execute(select(User).limit(1))
    if result.scalar_one_or_none():
        logger.info("Users already initialized, skipping...")
        return
    
    logger.info("Initializing user data...")
    
    # 创建测试用户
    test_user = User(
        id=1,
        openid="mock_openid_dev",
        nickname="开发测试用户",
        avatar="",
        phone="13800138000",
        gender=1,
        city="杭州",
        member_level=0,
        member_points=100,
        status=1
    )
    session.add(test_user)
    await session.flush()
    
    # 创建测试宠物
    pet = PetProfile(
        user_id=1,
        name="豆豆",
        breed="金毛寻回犬",
        breed_type=2,
        gender=1,
        weight=25.5,
        avatar="https://via.placeholder.com/200/FF8C42/FFFFFF?text=Dog",
        tags=["温顺", "友好", "活泼"],
        is_default=1,
        status=1
    )
    session.add(pet)
    
    await session.commit()
    logger.info("User data initialized successfully")


async def init_routes_data(session):
    """初始化路线数据"""
    # 动态导入模型，处理路径问题
    import importlib.util
    route_models_path = backend_root / "route-service" / "app" / "models" / "route.py"
    spec = importlib.util.spec_from_file_location("route_models", route_models_path)
    route_module = importlib.util.module_from_spec(spec)
    sys.modules["route_models"] = route_module
    spec.loader.exec_module(route_module)
    Route = route_module.Route
    RouteSchedule = route_module.RouteSchedule
    
    result = await session.execute(select(Route).limit(1))
    if result.scalar_one_or_none():
        logger.info("Routes already initialized, skipping...")
        return
    
    logger.info("Initializing route data...")
    
    routes_data = [
        {
            "id": 1,
            "route_no": "R2024001",
            "name": "海滨漫步一日游",
            "route_type": 2,
            "title": "带着爱宠一起感受海风与阳光",
            "cover_image": "https://via.placeholder.com/750x420/4ECDC4/FFFFFF?text=Beach",
            "gallery": [
                "https://via.placeholder.com/750x420/4ECDC4/FFFFFF?text=1",
                "https://via.placeholder.com/750x420/45B7D1/FFFFFF?text=2",
                "https://via.placeholder.com/750x420/96C93D/FFFFFF?text=3"
            ],
            "description": "这是一场与爱宠共度的美好海滨之旅。我们将在专业领队的带领下，前往美丽的海滨沙滩，让狗狗们尽情奔跑嬉戏，主人可以享受海风与阳光。",
            "highlights": ["专业领队", "宠物保险", "精美午餐", "摄影跟拍"],
            "duration": "1天",
            "difficulty": 2,
            "min_participants": 4,
            "max_participants": 12,
            "base_price": 199.00,
            "suitable_breeds": ["金毛", "拉布拉多", "柯基", "柴犬"],
            "unsuitable_breeds": ["短鼻犬种"],
            "is_safety_required": 1
        },
        {
            "id": 2,
            "route_no": "R2024002",
            "name": "山居野趣两日游",
            "route_type": 1,
            "title": "深入山林，与爱宠共享自然",
            "cover_image": "https://via.placeholder.com/750x420/96C93D/FFFFFF?text=Mountain",
            "gallery": [
                "https://via.placeholder.com/750x420/96C93D/FFFFFF?text=1",
                "https://via.placeholder.com/750x420/11998E/FFFFFF?text=2"
            ],
            "description": "呼吸新鲜空气，远离城市喧嚣，与爱宠一起深入山林，享受两天一夜的自然之旅。",
            "highlights": ["山间民宿", "篝火晚会", "森林徒步", "星空观赏"],
            "duration": "2天",
            "difficulty": 3,
            "min_participants": 6,
            "max_participants": 10,
            "base_price": 399.00,
            "suitable_breeds": ["金毛", "哈士奇", "阿拉斯加"],
            "unsuitable_breeds": ["小型犬"],
            "is_safety_required": 1
        },
        {
            "id": 3,
            "route_no": "R2024003",
            "name": "星空露营体验",
            "route_type": 3,
            "title": "在星空下与爱宠共度美好夜晚",
            "cover_image": "https://via.placeholder.com/750x420/667EEA/FFFFFF?text=Camping",
            "gallery": [
                "https://via.placeholder.com/750x420/667EEA/FFFFFF?text=1",
                "https://via.placeholder.com/750x420/764BA2/FFFFFF?text=2"
            ],
            "description": "篝火晚会，户外烧烤，在星空下与爱宠共度美好夜晚。",
            "highlights": ["露营体验", "户外烧烤", "篝火晚会", "星空摄影"],
            "duration": "1天",
            "difficulty": 2,
            "min_participants": 4,
            "max_participants": 16,
            "base_price": 299.00,
            "suitable_breeds": ["金毛", "拉布拉多", "边牧", "柯基"],
            "unsuitable_breeds": [],
            "is_safety_required": 1
        },
        {
            "id": 4,
            "route_no": "R2024004",
            "name": "森林徒步探险",
            "route_type": 4,
            "title": "穿越原始森林，探索自然奥秘",
            "cover_image": "https://via.placeholder.com/750x420/11998E/FFFFFF?text=Forest",
            "gallery": [
                "https://via.placeholder.com/750x420/11998E/FFFFFF?text=1",
                "https://via.placeholder.com/750x420/38EF7D/FFFFFF?text=2"
            ],
            "description": "专业领队带领，安全有保障，穿越原始森林探索自然奥秘。",
            "highlights": ["原始森林", "专业领队", "安全装备", "自然科普"],
            "duration": "半日",
            "difficulty": 4,
            "min_participants": 4,
            "max_participants": 12,
            "base_price": 159.00,
            "suitable_breeds": ["边牧", "德牧", "金毛"],
            "unsuitable_breeds": ["短鼻犬种", "小型犬"],
            "is_safety_required": 1
        },
        {
            "id": 5,
            "route_no": "R2024005",
            "name": "城市宠物聚会",
            "route_type": 5,
            "title": "宠物社交派对，结交新朋友",
            "cover_image": "https://via.placeholder.com/750x420/FF8C42/FFFFFF?text=City",
            "gallery": [
                "https://via.placeholder.com/750x420/FF8C42/FFFFFF?text=1",
                "https://via.placeholder.com/750x420/FF6B6B/FFFFFF?text=2"
            ],
            "description": "宠物互动游戏，精美下午茶，城市中的宠物社交派对。",
            "highlights": ["互动游戏", "精美茶歇", "宠物摄影", "社交交友"],
            "duration": "半日",
            "difficulty": 1,
            "min_participants": 8,
            "max_participants": 20,
            "base_price": 99.00,
            "suitable_breeds": ["所有品种"],
            "unsuitable_breeds": [],
            "is_safety_required": 0
        }
    ]
    
    for route_data in routes_data:
        route = Route(**route_data)
        session.add(route)
    
    await session.flush()
    
    # 创建排期（未来30天）
    logger.info("Creating route schedules...")
    base_date = date.today()
    
    for route_id in range(1, 6):
        for i in range(30):
            schedule_date = base_date + timedelta(days=i)
            # 模拟价格和库存
            price_modifiers = [0, 50, -20, 30, 0, 50, -20]
            price = [199, 399, 299, 159, 99][route_id - 1] + price_modifiers[i % 7]
            stock = 12 - (i % 4)
            
            schedule = RouteSchedule(
                route_id=route_id,
                schedule_date=schedule_date,
                start_time="09:00",
                end_time="17:00" if route_id != 2 else "次日17:00",
                price=price,
                stock=max(0, stock),
                sold=12 - stock,
                status=1 if stock > 0 else 2,
                guide_id=1,
                trainer_id=1
            )
            session.add(schedule)
    
    await session.commit()
    logger.info("Route data initialized successfully")


async def init_orders_data(session):
    """初始化订单数据"""
    sys.path.insert(0, str(backend_root / "order-service"))
    from app.models.order import Order, OrderEvaluation
    
    result = await session.execute(select(Order).limit(1))
    if result.scalar_one_or_none():
        logger.info("Orders already initialized, skipping...")
        return
    
    logger.info("Initializing order data...")
    
    # 创建测试订单
    orders_data = [
        {
            "id": 1,
            "order_no": "QD20240401001",
            "user_id": 1,
            "schedule_id": 1,
            "route_id": 1,
            "route_name": "海滨漫步一日游",
            "route_cover": "https://via.placeholder.com/400x300/4ECDC4/FFFFFF?text=Beach",
            "travel_date": date.today() + timedelta(days=5),
            "participant_count": 2,
            "pet_count": 1,
            "participants": [
                {"name": "张三", "id_card": "330102********1234", "pets": [{"name": "豆豆", "breed": "金毛"}]}
            ],
            "contact": {"name": "张三", "phone": "13800138000"},
            "route_price": 199.00,
            "insurance_price": 30.00,
            "total_amount": 428.00,
            "pay_amount": 428.00,
            "status": 10,  # 待支付
            "qrcode": "https://via.placeholder.com/200x200/FF8C42/FFFFFF?text=QR"
        },
        {
            "id": 2,
            "order_no": "QD20240401002",
            "user_id": 1,
            "schedule_id": 2,
            "route_id": 2,
            "route_name": "山居野趣两日游",
            "route_cover": "https://via.placeholder.com/400x300/96C93D/FFFFFF?text=Mountain",
            "travel_date": date.today() + timedelta(days=10),
            "participant_count": 1,
            "pet_count": 0,
            "participants": [{"name": "李四", "id_card": "330103********5678", "pets": []}],
            "contact": {"name": "李四", "phone": "13800138001"},
            "route_price": 399.00,
            "insurance_price": 10.00,
            "total_amount": 409.00,
            "pay_amount": 409.00,
            "status": 20,  # 待出行
            "pay_time": datetime.now(),
            "pay_channel": "wechat",
            "qrcode": "https://via.placeholder.com/200x200/FF8C42/FFFFFF?text=QR",
            "guide_info": {"name": "王领队", "phone": "13900139000", "avatar": "https://via.placeholder.com/100"}
        },
        {
            "id": 3,
            "order_no": "QD20240401003",
            "user_id": 1,
            "schedule_id": 5,
            "route_id": 3,
            "route_name": "星空露营体验",
            "route_cover": "https://via.placeholder.com/400x300/667EEA/FFFFFF?text=Camping",
            "travel_date": date.today() - timedelta(days=5),
            "participant_count": 2,
            "pet_count": 2,
            "participants": [
                {"name": "王五", "id_card": "330104********9012", "pets": [{"name": "旺财", "breed": "柯基"}]}
            ],
            "contact": {"name": "王五", "phone": "13800138002"},
            "route_price": 299.00,
            "insurance_price": 45.00,
            "total_amount": 643.00,
            "pay_amount": 643.00,
            "status": 60,  # 已完成
            "pay_time": datetime.now() - timedelta(days=6),
            "pay_channel": "wechat"
        }
    ]
    
    for order_data in orders_data:
        order = Order(**order_data)
        session.add(order)
    
    await session.flush()
    
    # 创建评价
    evaluation = OrderEvaluation(
        order_id=3,
        user_id=1,
        route_id=3,
        rating=5,
        content="非常棒的体验！领队很专业，狗狗玩得很开心，下次还会参加！",
        tags=["路线很棒", "领队专业", "宠物友好"],
        images=["https://via.placeholder.com/400x300/667EEA/FFFFFF?text=Review1"],
        is_anonymous=0
    )
    session.add(evaluation)
    
    await session.commit()
    logger.info("Order data initialized successfully")


async def main():
    """主函数"""
    logger.info("Starting database initialization...")
    
    # 创建所有表
    logger.info("Creating tables...")
    await init_db()
    logger.info("Tables created successfully")
    
    # 初始化数据
    async with AsyncSessionLocal() as session:
        try:
            await init_users_data(session)
            await init_routes_data(session)
            await init_orders_data(session)
            logger.info("Database initialization completed successfully!")
        except Exception as e:
            await session.rollback()
            logger.error(f"Error initializing database: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(main())
