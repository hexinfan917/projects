"""
初始化路线富文本字段
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from common.database import engine


async def init_route_richtext():
    """添加路线富文本字段"""
    async with engine.begin() as conn:
        # 检查字段是否存在
        columns_to_add = [
            ('highlights_detail', 'TEXT', '行程亮点详情(富文本)'),
            ('fee_description', 'TEXT', '费用说明(富文本)'),
            ('fee_include', 'TEXT', '费用包含(富文本)'),
            ('fee_exclude', 'TEXT', '费用不包含(富文本)'),
            ('notice', 'TEXT', '注意事项(富文本)'),
        ]
        
        for col_name, col_type, comment in columns_to_add:
            # 检查字段是否已存在
            result = await conn.execute(text(f"""
                SELECT COUNT(*) FROM information_schema.columns 
                WHERE table_schema = 'quandouxing' 
                AND table_name = 'routes' 
                AND column_name = '{col_name}'
            """))
            exists = result.scalar() > 0
            
            if not exists:
                await conn.execute(text(f"""
                    ALTER TABLE routes 
                    ADD COLUMN {col_name} {col_type} NULL COMMENT '{comment}'
                """))
                print(f"✅ 添加字段 {col_name}")
            else:
                print(f"⏭️ 字段 {col_name} 已存在，跳过")
        
        print("\n✅ 路线富文本字段初始化完成")


if __name__ == "__main__":
    asyncio.run(init_route_richtext())
