"""
用户服务
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from common.exceptions import NotFoundException

from app.models.user import User
from app.schemas.user import UserUpdate


class UserService:
    """用户服务"""
    
    async def get_user_by_id(self, user_id: int, db: AsyncSession) -> User:
        """根据ID获取用户"""
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise NotFoundException("用户不存在")
        
        return user
    
    async def get_user_by_openid(self, openid: str, db: AsyncSession) -> User:
        """根据openid获取用户"""
        result = await db.execute(select(User).where(User.openid == openid))
        return result.scalar_one_or_none()
    
    async def update_user(
        self,
        user_id: int,
        user_data: UserUpdate,
        db: AsyncSession
    ) -> User:
        """更新用户信息"""
        user = await self.get_user_by_id(user_id, db)
        
        # 更新字段
        update_data = user_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)
        
        await db.commit()
        await db.refresh(user)
        return user
    
    async def get_user_public_info(self, user_id: int, db: AsyncSession) -> dict:
        """获取用户公开信息"""
        user = await self.get_user_by_id(user_id, db)
        
        return {
            "id": user.id,
            "nickname": user.nickname,
            "avatar": user.avatar,
            "city": user.city,
            "member_level": user.member_level,
        }
