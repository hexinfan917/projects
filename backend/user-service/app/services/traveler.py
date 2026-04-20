"""
出行人服务
"""
from typing import List
from datetime import datetime
from sqlalchemy import select, and_, update
from sqlalchemy.ext.asyncio import AsyncSession
from common.exceptions import NotFoundException
from common.logger import setup_logger

from app.models.traveler import Traveler
from app.schemas.traveler import TravelerCreate, TravelerUpdate

logger = setup_logger("traveler-service")


class TravelerService:
    """出行人服务"""
    
    async def get_user_travelers(self, user_id: int, db: AsyncSession) -> List[Traveler]:
        """获取用户的所有出行人"""
        result = await db.execute(
            select(Traveler).where(
                and_(Traveler.user_id == user_id, Traveler.status == 1)
            ).order_by(Traveler.is_default.desc(), Traveler.created_at.desc())
        )
        return result.scalars().all()
    
    async def get_traveler(self, traveler_id: int, user_id: int, db: AsyncSession) -> Traveler:
        """获取出行人详情"""
        result = await db.execute(
            select(Traveler).where(
                and_(
                    Traveler.id == traveler_id,
                    Traveler.user_id == user_id,
                    Traveler.status == 1
                )
            )
        )
        traveler = result.scalar_one_or_none()
        
        if not traveler:
            raise NotFoundException("出行人不存在")
        
        return traveler
    
    async def create_traveler(
        self,
        user_id: int,
        traveler_data: TravelerCreate,
        db: AsyncSession
    ) -> Traveler:
        """创建出行人"""
        data = traveler_data.model_dump()
        
        # 检查身份证号是否已存在（同一用户下）
        id_card = data.get('id_card')
        if id_card:
            result = await db.execute(
                select(Traveler).where(
                    and_(
                        Traveler.user_id == user_id,
                        Traveler.id_card == id_card,
                        Traveler.status == 1
                    )
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                from common.exceptions import ConflictException
                raise ConflictException("该身份证号已存在，请勿重复添加")
        
        # 处理日期转换
        birthday_str = data.get('birthday')
        if birthday_str and isinstance(birthday_str, str):
            try:
                data['birthday'] = datetime.strptime(birthday_str, '%Y-%m-%d')
            except ValueError:
                data['birthday'] = None
        
        # 如果设置为默认，先将其他出行人设为非默认
        if data.get('is_default') == 1:
            await self._clear_default_travelers(user_id, db)
        
        traveler = Traveler(
            user_id=user_id,
            **data
        )
        
        # 如果是第一个出行人，设为默认
        existing_travelers = await self.get_user_travelers(user_id, db)
        if not existing_travelers:
            traveler.is_default = 1
        
        db.add(traveler)
        await db.commit()
        await db.refresh(traveler)
        
        logger.info(f"创建出行人成功: id={traveler.id}, user={user_id}")
        return traveler
    
    async def update_traveler(
        self,
        traveler_id: int,
        user_id: int,
        traveler_data: TravelerUpdate,
        db: AsyncSession
    ) -> Traveler:
        """更新出行人"""
        traveler = await self.get_traveler(traveler_id, user_id, db)
        
        update_data = traveler_data.model_dump(exclude_unset=True)
        
        # 处理日期转换
        birthday_str = update_data.get('birthday')
        if birthday_str and isinstance(birthday_str, str):
            try:
                update_data['birthday'] = datetime.strptime(birthday_str, '%Y-%m-%d')
            except ValueError:
                update_data['birthday'] = None
        elif birthday_str is None:
            update_data['birthday'] = None
        
        # 如果设置为默认，先将其他出行人设为非默认
        if update_data.get('is_default') == 1 and traveler.is_default != 1:
            await self._clear_default_travelers(user_id, db)
        
        for field, value in update_data.items():
            setattr(traveler, field, value)
        
        await db.commit()
        await db.refresh(traveler)
        
        logger.info(f"更新出行人成功: id={traveler_id}")
        return traveler
    
    async def delete_traveler(self, traveler_id: int, user_id: int, db: AsyncSession):
        """删除出行人（软删除）"""
        traveler = await self.get_traveler(traveler_id, user_id, db)
        traveler.status = 0
        await db.commit()
        logger.info(f"删除出行人成功: id={traveler_id}")
    
    async def _clear_default_travelers(self, user_id: int, db: AsyncSession):
        """将用户的所有出行人设为非默认"""
        await db.execute(
            update(Traveler)
            .where(and_(Traveler.user_id == user_id, Traveler.status == 1))
            .values(is_default=0)
        )
