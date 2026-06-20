"""
宠物服务
"""
from typing import List
from datetime import datetime, date
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from common.exceptions import NotFoundException, ForbiddenException
from common.logger import setup_logger

from app.models.pet import PetProfile
from app.schemas.pet import PetCreate, PetUpdate

logger = setup_logger("pet-service")


class PetService:
    """宠物服务"""
    
    async def get_user_pets(self, user_id: int, db: AsyncSession) -> List[PetProfile]:
        """获取用户的所有宠物"""
        result = await db.execute(
            select(PetProfile).where(
                and_(PetProfile.user_id == user_id, PetProfile.status == 1)
            ).order_by(PetProfile.is_default.desc(), PetProfile.created_at.desc())
        )
        return result.scalars().all()
    
    async def get_pet(self, pet_id: int, user_id: int, db: AsyncSession) -> PetProfile:
        """获取宠物详情"""
        result = await db.execute(
            select(PetProfile).where(
                and_(
                    PetProfile.id == pet_id,
                    PetProfile.user_id == user_id,
                    PetProfile.status == 1
                )
            )
        )
        pet = result.scalar_one_or_none()
        
        if not pet:
            raise NotFoundException("宠物不存在")
        
        return pet
    
    async def create_pet(
        self,
        user_id: int,
        pet_data: PetCreate,
        db: AsyncSession
    ) -> PetProfile:
        """创建宠物档案"""
        data = pet_data.model_dump()
        logger.info(f"创建宠物 - 接收数据: {data}")
        
        is_default = data.get('is_default', 0)
        
        # 处理日期转换：如果 age_str 是纯数字/小数，计算 birth_date
        age_str = data.get('age_str')
        birth_date_str = data.get('birth_date')
        if age_str and not birth_date_str:
            import re
            num_match = re.match(r'^\d+(\.\d+)?$', age_str.strip())
            if num_match:
                try:
                    age_val = float(num_match.group())
                    now = datetime.now()
                    year = int(now.year - age_val)
                    month = now.month
                    day = now.day
                    data['birth_date'] = date(year, month, day)
                    logger.info(f"根据 age_str 计算 birth_date 成功: {data['birth_date']}")
                except Exception as e:
                    logger.error(f"根据 age_str 计算 birth_date 失败: {age_str}, 错误: {e}")
                    data['birth_date'] = None
        elif birth_date_str and isinstance(birth_date_str, str):
            try:
                data['birth_date'] = datetime.strptime(birth_date_str, '%Y-%m-%d').date()
                logger.info(f"转换 birth_date 成功: {data['birth_date']}")
            except ValueError as e:
                logger.error(f"转换 birth_date 失败: {birth_date_str}, 错误: {e}")
                data['birth_date'] = None
        
        vaccine_date = data.get('vaccine_date')
        if vaccine_date and isinstance(vaccine_date, str):
            try:
                data['vaccine_date'] = datetime.strptime(vaccine_date, '%Y-%m-%d').date()
            except ValueError:
                data['vaccine_date'] = None
        
        # 删除不需要的字段
        data.pop('breed_type', None)

        # 将 None 的可选字段替换为空字符串，避免数据库 NOT NULL 报错
        for field in ['breed', 'avatar', 'health_notes', 'vaccine_book']:
            if data.get(field) is None:
                data[field] = ''
        
        # 如果设置为默认，先将其他宠物设为非默认
        if is_default == 1:
            await self._clear_default_pets(user_id, db)
        
        logger.info(f"创建宠物 - 最终数据: {data}")
        
        pet = PetProfile(
            user_id=user_id,
            **data
        )
        
        # 如果是第一个宠物，设为默认
        existing_pets = await self.get_user_pets(user_id, db)
        if not existing_pets:
            pet.is_default = 1
        
        db.add(pet)
        await db.commit()
        await db.refresh(pet)
        logger.info(f"创建宠物成功: id={pet.id}, birth_date={pet.birth_date}")
        return pet
    
    async def _clear_default_pets(self, user_id: int, db: AsyncSession):
        """将用户的所有宠物设为非默认"""
        from sqlalchemy import update
        await db.execute(
            update(PetProfile)
            .where(and_(PetProfile.user_id == user_id, PetProfile.status == 1))
            .values(is_default=0)
        )
    
    async def update_pet(
        self,
        pet_id: int,
        user_id: int,
        pet_data: PetUpdate,
        db: AsyncSession
    ) -> PetProfile:
        """更新宠物信息"""
        pet = await self.get_pet(pet_id, user_id, db)
        
        update_data = pet_data.model_dump(exclude_unset=True)
        logger.info(f"更新宠物 - 接收数据: {update_data}")
        
        # 处理日期转换：如果 age_str 是纯数字/小数，计算 birth_date
        age_str = update_data.get('age_str')
        birth_date_str = update_data.get('birth_date')
        if age_str and not birth_date_str:
            import re
            num_match = re.match(r'^\d+(\.\d+)?$', str(age_str).strip())
            if num_match:
                try:
                    age_val = float(num_match.group())
                    now = datetime.now()
                    year = int(now.year - age_val)
                    month = now.month
                    day = now.day
                    update_data['birth_date'] = date(year, month, day)
                    logger.info(f"根据 age_str 计算 birth_date 成功: {update_data['birth_date']}")
                except Exception as e:
                    logger.error(f"根据 age_str 计算 birth_date 失败: {age_str}, 错误: {e}")
                    update_data['birth_date'] = None
        elif birth_date_str and isinstance(birth_date_str, str):
            try:
                update_data['birth_date'] = datetime.strptime(birth_date_str, '%Y-%m-%d').date()
            except ValueError:
                update_data['birth_date'] = None
        elif birth_date_str is None:
            update_data['birth_date'] = None
            
        vaccine_date = update_data.get('vaccine_date')
        if vaccine_date and isinstance(vaccine_date, str):
            try:
                update_data['vaccine_date'] = datetime.strptime(vaccine_date, '%Y-%m-%d').date()
            except ValueError:
                update_data['vaccine_date'] = None
        
        # 删除不需要的字段
        update_data.pop('breed_type', None)

        # 将 None 的可选字段替换为空字符串，避免数据库 NOT NULL 报错
        for field in ['breed', 'avatar', 'health_notes', 'vaccine_book']:
            if update_data.get(field) is None:
                update_data[field] = ''
        
        # 如果设置为默认，先将其他宠物设为非默认
        if update_data.get('is_default') == 1 and pet.is_default != 1:
            await self._clear_default_pets(user_id, db)
        
        for field, value in update_data.items():
            setattr(pet, field, value)
        
        await db.commit()
        await db.refresh(pet)
        logger.info(f"更新宠物成功: id={pet.id}, birth_date={pet.birth_date}")
        return pet
    
    async def delete_pet(self, pet_id: int, user_id: int, db: AsyncSession):
        """删除宠物（软删除）"""
        pet = await self.get_pet(pet_id, user_id, db)
        pet.status = 0
        await db.commit()
