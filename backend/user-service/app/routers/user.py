"""
用户路由
"""
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from common.database import get_db
from common.response import success
from common.dependencies import get_current_user, get_optional_user

from app.schemas.user import UserUpdate, UserResponse
from app.services.user import UserService

router = APIRouter()
user_service = UserService()


@router.get("/profile", response_model=UserResponse)
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取当前用户信息"""
    user = await user_service.get_user_by_id(current_user["user_id"], db)
    return success({
        "id": user.id,
        "nickname": user.nickname,
        "avatar": user.avatar,
        "phone": user.phone,
        "real_name": user.real_name,
        "id_card": user.id_card,
        "gender": user.gender,
        "birthday": user.birthday.isoformat() if user.birthday else None,
        "city": user.city,
        "member_level": user.member_level,
        "member_points": user.member_points,
        "status": user.status,
        "created_at": user.created_at.isoformat() if user.created_at else None
    })


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    user_data: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新用户信息"""
    user = await user_service.update_user(current_user["user_id"], user_data, db)
    return success({
        "id": user.id,
        "nickname": user.nickname,
        "avatar": user.avatar,
        "phone": user.phone,
        "real_name": user.real_name,
        "id_card": user.id_card,
        "gender": user.gender,
        "birthday": user.birthday.isoformat() if user.birthday else None,
        "city": user.city,
        "member_level": user.member_level,
        "member_points": user.member_points,
        "status": user.status,
        "created_at": user.created_at.isoformat() if user.created_at else None
    })


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: Optional[dict] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """获取指定用户信息（公开信息）"""
    user = await user_service.get_user_public_info(user_id, db)
    return success(user)
