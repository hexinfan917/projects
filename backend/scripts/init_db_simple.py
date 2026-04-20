"""
简化版数据库初始化脚本
直接执行 SQL 创建表和插入数据
"""
import sys
from pathlib import Path

backend_root = Path(__file__).parent.parent
sys.path.insert(0, str(backend_root))

import asyncio
from datetime import datetime, date, timedelta
from common.database import engine, AsyncSessionLocal
from common.logger import setup_logger

logger = setup_logger("init_db")

# SQL 删除表（重新创建）
DROP_TABLES_SQL = """
DROP TABLE IF EXISTS order_evaluations;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS route_schedules;
DROP TABLE IF EXISTS routes;
DROP TABLE IF EXISTS pet_profiles;
DROP TABLE IF EXISTS users;
"""

# SQL 创建表语句
CREATE_TABLES_SQL = """
-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    openid VARCHAR(64) UNIQUE NOT NULL,
    unionid VARCHAR(64),
    nickname VARCHAR(50),
    avatar VARCHAR(500),
    phone VARCHAR(20),
    gender INT DEFAULT 0,
    birthday DATE,
    city VARCHAR(50),
    member_level INT DEFAULT 0,
    member_points INT DEFAULT 0,
    status INT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 宠物档案表
CREATE TABLE IF NOT EXISTS pet_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    breed VARCHAR(50) NOT NULL,
    breed_type INT,
    birth_date DATE,
    gender INT,
    weight INT,
    avatar VARCHAR(500),
    tags JSON,
    health_notes TEXT,
    is_default INT DEFAULT 0,
    status INT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 路线表
CREATE TABLE IF NOT EXISTS routes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    route_type INT NOT NULL,
    title VARCHAR(200),
    cover_image VARCHAR(500),
    gallery JSON,
    description TEXT,
    highlights JSON,
    suitable_breeds JSON,
    unsuitable_breeds JSON,
    duration VARCHAR(20),
    difficulty INT DEFAULT 3,
    min_participants INT DEFAULT 4,
    max_participants INT DEFAULT 12,
    base_price DECIMAL(10,2),
    safety_video_url VARCHAR(500),
    safety_video_duration INT DEFAULT 180,
    is_safety_required INT DEFAULT 1,
    status INT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 路线排期表
CREATE TABLE IF NOT EXISTS route_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    route_id INT NOT NULL,
    schedule_date DATE NOT NULL,
    start_time VARCHAR(10),
    end_time VARCHAR(10),
    price DECIMAL(10,2),
    stock INT DEFAULT 12,
    sold INT DEFAULT 0,
    status INT DEFAULT 1,
    guide_id INT,
    trainer_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_no VARCHAR(32) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    schedule_id INT NOT NULL,
    route_id INT NOT NULL,
    route_name VARCHAR(100) NOT NULL,
    route_cover VARCHAR(500),
    travel_date DATE NOT NULL,
    participant_count INT DEFAULT 1,
    pet_count INT DEFAULT 0,
    participants JSON,
    contact JSON,
    route_price DECIMAL(10,2),
    insurance_price DECIMAL(10,2) DEFAULT 0,
    equipment_price DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2),
    pay_amount DECIMAL(10,2),
    status INT DEFAULT 10,
    pay_time DATETIME,
    pay_channel VARCHAR(20),
    pay_trade_no VARCHAR(64),
    remark TEXT,
    qrcode VARCHAR(500),
    guide_info JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 订单评价表
CREATE TABLE IF NOT EXISTS order_evaluations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    user_id INT NOT NULL,
    route_id INT NOT NULL,
    rating INT NOT NULL,
    content TEXT NOT NULL,
    tags JSON,
    images JSON,
    is_anonymous INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
"""

INSERT_ROUTES_SQL = """
INSERT INTO routes (id, name, route_type, title, cover_image, gallery, description, highlights, duration, difficulty, min_participants, max_participants, base_price, suitable_breeds, unsuitable_breeds, is_safety_required) VALUES
(1, '海滨漫步一日游', 2, '带着爱宠一起感受海风与阳光', 'https://via.placeholder.com/750x420/4ECDC4/FFFFFF?text=Beach', '["https://via.placeholder.com/750x420/4ECDC4/FFFFFF?text=1","https://via.placeholder.com/750x420/45B7D1/FFFFFF?text=2","https://via.placeholder.com/750x420/96C93D/FFFFFF?text=3"]', '这是一场与爱宠共度的美好海滨之旅。我们将在专业领队的带领下，前往美丽的海滨沙滩，让狗狗们尽情奔跑嬉戏，主人可以享受海风与阳光。', '["专业领队","宠物保险","精美午餐","摄影跟拍"]', '1天', 2, 4, 12, 199.00, '["金毛","拉布拉多","柯基","柴犬"]', '["短鼻犬种"]', 1),
(2, '山居野趣两日游', 1, '深入山林，与爱宠共享自然', 'https://via.placeholder.com/750x420/96C93D/FFFFFF?text=Mountain', '["https://via.placeholder.com/750x420/96C93D/FFFFFF?text=1","https://via.placeholder.com/750x420/11998E/FFFFFF?text=2"]', '呼吸新鲜空气，远离城市喧嚣，与爱宠一起深入山林，享受两天一夜的自然之旅。', '["山间民宿","篝火晚会","森林徒步","星空观赏"]', '2天', 3, 6, 10, 399.00, '["金毛","哈士奇","阿拉斯加"]', '["小型犬"]', 1),
(3, '星空露营体验', 3, '在星空下与爱宠共度美好夜晚', 'https://via.placeholder.com/750x420/667EEA/FFFFFF?text=Camping', '["https://via.placeholder.com/750x420/667EEA/FFFFFF?text=1","https://via.placeholder.com/750x420/764BA2/FFFFFF?text=2"]', '篝火晚会，户外烧烤，在星空下与爱宠共度美好夜晚。', '["露营体验","户外烧烤","篝火晚会","星空摄影"]', '1天', 2, 4, 16, 299.00, '["金毛","拉布拉多","边牧","柯基"]', '[]', 1),
(4, '森林徒步探险', 4, '穿越原始森林，探索自然奥秘', 'https://via.placeholder.com/750x420/11998E/FFFFFF?text=Forest', '["https://via.placeholder.com/750x420/11998E/FFFFFF?text=1","https://via.placeholder.com/750x420/38EF7D/FFFFFF?text=2"]', '专业领队带领，安全有保障，穿越原始森林探索自然奥秘。', '["原始森林","专业领队","安全装备","自然科普"]', '半日', 4, 4, 12, 159.00, '["边牧","德牧","金毛"]', '["短鼻犬种","小型犬"]', 1),
(5, '城市宠物聚会', 5, '宠物社交派对，结交新朋友', 'https://via.placeholder.com/750x420/FF8C42/FFFFFF?text=City', '["https://via.placeholder.com/750x420/FF8C42/FFFFFF?text=1","https://via.placeholder.com/750x420/FF6B6B/FFFFFF?text=2"]', '宠物互动游戏，精美下午茶，城市中的宠物社交派对。', '["互动游戏","精美茶歇","宠物摄影","社交交友"]', '半日', 1, 8, 20, 99.00, '["所有品种"]', '[]', 0);
"""

INSERT_USER_SQL = """
INSERT INTO users (id, openid, nickname, phone, gender, city, member_level, member_points, status) VALUES
(1, 'mock_openid_dev', '开发测试用户', '13800138000', 1, '杭州', 0, 100, 1);
"""

INSERT_PET_SQL = """
INSERT INTO pet_profiles (user_id, name, breed, breed_type, gender, weight, avatar, tags, is_default, status) VALUES
(1, '豆豆', '金毛寻回犬', 2, 1, 25, 'https://via.placeholder.com/200/FF8C42/FFFFFF?text=Dog', '["温顺","友好","活泼"]', 1, 1);
"""

INSERT_ORDERS_SQL = """
INSERT INTO orders (id, order_no, user_id, schedule_id, route_id, route_name, route_cover, travel_date, participant_count, pet_count, participants, contact, route_price, insurance_price, total_amount, pay_amount, status, qrcode) VALUES
(1, 'QD20240401001', 1, 1, 1, '海滨漫步一日游', 'https://via.placeholder.com/400x300/4ECDC4/FFFFFF?text=Beach', DATE_ADD(CURDATE(), INTERVAL 5 DAY), 2, 1, '[{"name":"张三","id_card":"330102********1234","pets":[{"name":"豆豆","breed":"金毛"}]}]', '{"name":"张三","phone":"13800138000"}', 199.00, 30.00, 428.00, 428.00, 10, 'https://via.placeholder.com/200x200/FF8C42/FFFFFF?text=QR'),
(2, 'QD20240401002', 1, 2, 2, '山居野趣两日游', 'https://via.placeholder.com/400x300/96C93D/FFFFFF?text=Mountain', DATE_ADD(CURDATE(), INTERVAL 10 DAY), 1, 0, '[{"name":"李四","id_card":"330103********5678","pets":[]}]', '{"name":"李四","phone":"13800138001"}', 399.00, 10.00, 409.00, 409.00, 20, 'https://via.placeholder.com/200x200/FF8C42/FFFFFF?text=QR'),
(3, 'QD20240401003', 1, 5, 3, '星空露营体验', 'https://via.placeholder.com/400x300/667EEA/FFFFFF?text=Camping', DATE_SUB(CURDATE(), INTERVAL 5 DAY), 2, 2, '[{"name":"王五","id_card":"330104********9012","pets":[{"name":"旺财","breed":"柯基"}]}]', '{"name":"王五","phone":"13800138002"}', 299.00, 45.00, 643.00, 643.00, 60, NULL);
"""


async def create_tables():
    """创建所有表"""
    from sqlalchemy import text
    async with engine.begin() as conn:
        # 先删除旧表
        for sql in DROP_TABLES_SQL.split(';'):
            sql = sql.strip()
            if sql:
                await conn.execute(text(sql))
        logger.info("Old tables dropped")
        
        # 创建新表
        for sql in CREATE_TABLES_SQL.split(';'):
            sql = sql.strip()
            if sql:
                await conn.execute(text(sql))
    logger.info("Tables created successfully")


async def insert_data():
    """插入初始数据"""
    from sqlalchemy import text
    async with AsyncSessionLocal() as session:
        try:
            # 检查是否已有数据
            result = await session.execute(text("SELECT COUNT(*) FROM routes"))
            count = result.scalar()
            if count > 0:
                logger.info("Data already exists, skipping...")
                return
            
            # 插入路线
            for sql in INSERT_ROUTES_SQL.split(';'):
                sql = sql.strip()
                if sql:
                    await session.execute(text(sql))
            logger.info("Routes inserted")
            
            # 插入排期（未来30天）
            base_date = date.today()
            schedules_sql = []
            for route_id in range(1, 6):
                prices = [199, 399, 299, 159, 99]
                for i in range(30):
                    schedule_date = base_date + timedelta(days=i)
                    price_modifiers = [0, 50, -20, 30, 0, 50, -20]
                    price = prices[route_id - 1] + price_modifiers[i % 7]
                    stock = max(0, 12 - (i % 4))
                    status = 1 if stock > 0 else 2
                    schedules_sql.append(
                        f"INSERT INTO route_schedules (route_id, schedule_date, start_time, end_time, price, stock, sold, status) VALUES ({route_id}, '{schedule_date}', '09:00', '17:00', {price}, {stock}, {12-stock}, {status})"
                    )
            
            for sql in schedules_sql:
                await session.execute(text(sql))
            logger.info("Schedules inserted")
            
            # 插入用户
            await session.execute(text(INSERT_USER_SQL))
            logger.info("User inserted")
            
            # 插入宠物
            await session.execute(text(INSERT_PET_SQL))
            logger.info("Pet inserted")
            
            # 插入订单
            for sql in INSERT_ORDERS_SQL.split(';'):
                sql = sql.strip()
                if sql:
                    await session.execute(text(sql))
            logger.info("Orders inserted")
            
            await session.commit()
            logger.info("Data inserted successfully")
        except Exception as e:
            await session.rollback()
            raise


async def main():
    """主函数"""
    logger.info("Starting database initialization...")
    
    # 创建表
    await create_tables()
    
    # 插入数据
    await insert_data()
    
    logger.info("Database initialization completed!")


if __name__ == "__main__":
    asyncio.run(main())
