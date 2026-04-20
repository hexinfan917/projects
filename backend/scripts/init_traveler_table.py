"""
初始化出行人表
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from common.database import engine


async def init_traveler_table():
    """创建出行人表"""
    async with engine.begin() as conn:
        # 检查表是否存在
        result = await conn.execute(text("""
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'quandouxing' AND table_name = 'travelers'
        """))
        exists = result.scalar() > 0
        
        if exists:
            print(" travelers 表已存在，跳过创建")
            return
        
        # 创建出行人表
        await conn.execute(text("""
            CREATE TABLE travelers (
                id INT AUTO_INCREMENT PRIMARY KEY COMMENT '出行人ID',
                user_id INT NOT NULL COMMENT '所属用户ID',
                name VARCHAR(50) NOT NULL COMMENT '姓名',
                phone VARCHAR(20) NULL COMMENT '手机号',
                id_card VARCHAR(18) NULL COMMENT '身份证号',
                gender INT DEFAULT 0 COMMENT '0未知 1男 2女',
                birthday DATE NULL COMMENT '生日',
                emergency_name VARCHAR(50) NULL COMMENT '紧急联系人姓名',
                emergency_phone VARCHAR(20) NULL COMMENT '紧急联系人电话',
                remark TEXT NULL COMMENT '备注',
                is_default INT DEFAULT 0 COMMENT '0否 1是默认出行人',
                status INT DEFAULT 1 COMMENT '0删除 1正常',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                INDEX idx_user_id (user_id),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='出行人表'
        """))
        
        print("✅ travelers 表创建成功")


if __name__ == "__main__":
    asyncio.run(init_traveler_table())
