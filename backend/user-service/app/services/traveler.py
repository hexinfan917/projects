"""
出行人服务
"""
import re
from typing import List
from datetime import datetime
from sqlalchemy import select, and_, update
from sqlalchemy.ext.asyncio import AsyncSession
from common.exceptions import NotFoundException, APIException
from common.logger import setup_logger

from app.models.traveler import Traveler
from app.schemas.traveler import TravelerCreate, TravelerUpdate

logger = setup_logger("traveler-service")


def validate_phone(phone: str) -> bool:
    """校验手机号格式"""
    return bool(re.match(r'^1[3-9]\d{9}$', phone))


def validate_id_card(id_card: str) -> bool:
    """校验身份证号格式（含校验码）"""
    if not id_card or len(id_card) != 18:
        return False
    if not re.match(r'^\d{17}[\dXx]$', id_card):
        return False
    weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
    check_codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
    total = sum(int(id_card[i]) * weights[i] for i in range(17))
    return check_codes[total % 11] == id_card[17].upper()


def validate_name(name: str) -> bool:
    """校验姓名格式"""
    if not name or len(name) < 2 or len(name) > 20:
        return False
    return bool(re.match(r'^[\u4e00-\u9fa5a-zA-Z·•]+$', name))


def validate_traveler_data(data: dict, is_create: bool = True):
    """统一校验出行人数据"""
    name = data.get('name')
    if is_create or name is not None:
        if not name:
            raise APIException(message="姓名不能为空", code=400)
        if not validate_name(name):
            raise APIException(message="姓名仅限2-20位中文/英文/·", code=400)

    phone = data.get('phone')
    if is_create or phone is not None:
        if not phone:
            raise APIException(message="手机号不能为空", code=400)
        if not validate_phone(phone):
            raise APIException(message="手机号格式不正确", code=400)

    id_card = data.get('id_card')
    if is_create or id_card is not None:
        if not id_card:
            raise APIException(message="身份证号不能为空", code=400)
        if not validate_id_card(id_card):
            raise APIException(message="身份证号格式不正确", code=400)


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
        
        # 字段格式校验
        validate_traveler_data(data, is_create=True)
        
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
        
        # 字段格式校验（只校验传入的字段）
        validate_traveler_data(update_data, is_create=False)
        
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
