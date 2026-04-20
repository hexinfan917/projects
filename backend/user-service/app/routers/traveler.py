"""
出行人管理路由
"""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from common.database import get_db
from common.response import success
from common.dependencies import get_current_user

from app.schemas.traveler import TravelerCreate, TravelerUpdate, TravelerResponse
from app.services.traveler import TravelerService

router = APIRouter()
traveler_service = TravelerService()


@router.get("", response_model=List[TravelerResponse])
async def get_travelers(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取当前用户的所有出行人"""
    travelers = await traveler_service.get_user_travelers(current_user["user_id"], db)
    return success([{
        "id": t.id,
        "user_id": t.user_id,
        "name": t.name,
        "phone": t.phone,
        "id_card": t.id_card,
        "gender": t.gender,
        "birthday": t.birthday.strftime('%Y-%m-%d') if t.birthday else None,
        "emergency_name": t.emergency_name,
        "emergency_phone": t.emergency_phone,
        "remark": t.remark,
        "is_default": t.is_default,
        "status": t.status,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None
    } for t in travelers])


@router.post("", response_model=TravelerResponse)
async def create_traveler(
    traveler_data: TravelerCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """创建出行人"""
    traveler = await traveler_service.create_traveler(
        current_user["user_id"], traveler_data, db
    )
    return success({
        "id": traveler.id,
        "user_id": traveler.user_id,
        "name": traveler.name,
        "phone": traveler.phone,
        "id_card": traveler.id_card,
        "gender": traveler.gender,
        "birthday": traveler.birthday.strftime('%Y-%m-%d') if traveler.birthday else None,
        "emergency_name": traveler.emergency_name,
        "emergency_phone": traveler.emergency_phone,
        "remark": traveler.remark,
        "is_default": traveler.is_default,
        "status": traveler.status,
        "created_at": traveler.created_at.isoformat() if traveler.created_at else None,
        "updated_at": traveler.updated_at.isoformat() if traveler.updated_at else None
    })


@router.get("/{traveler_id}", response_model=TravelerResponse)
async def get_traveler(
    traveler_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取出行人详情"""
    traveler = await traveler_service.get_traveler(
        traveler_id, current_user["user_id"], db
    )
    return success({
        "id": traveler.id,
        "user_id": traveler.user_id,
        "name": traveler.name,
        "phone": traveler.phone,
        "id_card": traveler.id_card,
        "gender": traveler.gender,
        "birthday": traveler.birthday.strftime('%Y-%m-%d') if traveler.birthday else None,
        "emergency_name": traveler.emergency_name,
        "emergency_phone": traveler.emergency_phone,
        "remark": traveler.remark,
        "is_default": traveler.is_default,
        "status": traveler.status,
        "created_at": traveler.created_at.isoformat() if traveler.created_at else None,
        "updated_at": traveler.updated_at.isoformat() if traveler.updated_at else None
    })


@router.put("/{traveler_id}", response_model=TravelerResponse)
async def update_traveler(
    traveler_id: int,
    traveler_data: TravelerUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新出行人"""
    traveler = await traveler_service.update_traveler(
        traveler_id, current_user["user_id"], traveler_data, db
    )
    return success({
        "id": traveler.id,
        "user_id": traveler.user_id,
        "name": traveler.name,
        "phone": traveler.phone,
        "id_card": traveler.id_card,
        "gender": traveler.gender,
        "birthday": traveler.birthday.strftime('%Y-%m-%d') if traveler.birthday else None,
        "emergency_name": traveler.emergency_name,
        "emergency_phone": traveler.emergency_phone,
        "remark": traveler.remark,
        "is_default": traveler.is_default,
        "status": traveler.status,
        "created_at": traveler.created_at.isoformat() if traveler.created_at else None,
        "updated_at": traveler.updated_at.isoformat() if traveler.updated_at else None
    })


@router.delete("/{traveler_id}")
async def delete_traveler(
    traveler_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """删除出行人"""
    await traveler_service.delete_traveler(
        traveler_id, current_user["user_id"], db
    )
    return success(message="删除成功")
