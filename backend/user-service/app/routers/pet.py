"""
宠物档案路由
"""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from common.database import get_db
from common.response import success
from common.dependencies import get_current_user

from app.schemas.pet import PetCreate, PetUpdate, PetResponse
from app.services.pet import PetService

router = APIRouter()
pet_service = PetService()


@router.get("", response_model=List[PetResponse])
async def get_pets(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取当前用户的宠物列表"""
    pets = await pet_service.get_user_pets(current_user["user_id"], db)
    # 转换为字典列表
    pet_list = []
    for pet in pets:
        pet_list.append({
            "id": pet.id,
            "user_id": pet.user_id,
            "name": pet.name,
            "breed": pet.breed,
            "birth_date": pet.birth_date.isoformat() if pet.birth_date else None,
            "age_str": pet.age_str,
            "gender": pet.gender,
            "weight": float(pet.weight) if pet.weight else None,
            "avatar": pet.avatar,
            "tags": pet.tags or [],
            "health_notes": pet.health_notes,
            "vaccine_date": pet.vaccine_date.isoformat() if pet.vaccine_date else None,
            "vaccine_book": pet.vaccine_book,
            "is_default": pet.is_default,
            "status": pet.status,
            "created_at": pet.created_at.isoformat() if pet.created_at else None,
            "updated_at": pet.updated_at.isoformat() if pet.updated_at else None
        })
    return success(pet_list)


@router.post("", response_model=PetResponse)
async def create_pet(
    pet_data: PetCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """创建宠物档案"""
    pet = await pet_service.create_pet(current_user["user_id"], pet_data, db)
    return success({
        "id": pet.id,
        "user_id": pet.user_id,
        "name": pet.name,
        "breed": pet.breed,
        "birth_date": pet.birth_date.isoformat() if pet.birth_date else None,
        "age_str": pet.age_str,
        "gender": pet.gender,
        "weight": float(pet.weight) if pet.weight else None,
        "avatar": pet.avatar,
        "tags": pet.tags or [],
        "health_notes": pet.health_notes,
        "vaccine_date": pet.vaccine_date.isoformat() if pet.vaccine_date else None,
        "vaccine_book": pet.vaccine_book,
        "is_default": pet.is_default,
        "status": pet.status,
        "created_at": pet.created_at.isoformat() if pet.created_at else None,
        "updated_at": pet.updated_at.isoformat() if pet.updated_at else None
    })


@router.get("/{pet_id}", response_model=PetResponse)
async def get_pet(
    pet_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取宠物详情"""
    pet = await pet_service.get_pet(pet_id, current_user["user_id"], db)
    return success({
        "id": pet.id,
        "user_id": pet.user_id,
        "name": pet.name,
        "breed": pet.breed,
        "birth_date": pet.birth_date.isoformat() if pet.birth_date else None,
        "age_str": pet.age_str,
        "gender": pet.gender,
        "weight": float(pet.weight) if pet.weight else None,
        "avatar": pet.avatar,
        "tags": pet.tags or [],
        "health_notes": pet.health_notes,
        "vaccine_date": pet.vaccine_date.isoformat() if pet.vaccine_date else None,
        "vaccine_book": pet.vaccine_book,
        "is_default": pet.is_default,
        "status": pet.status,
        "created_at": pet.created_at.isoformat() if pet.created_at else None,
        "updated_at": pet.updated_at.isoformat() if pet.updated_at else None
    })


@router.put("/{pet_id}", response_model=PetResponse)
async def update_pet(
    pet_id: int,
    pet_data: PetUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新宠物信息"""
    pet = await pet_service.update_pet(pet_id, current_user["user_id"], pet_data, db)
    return success({
        "id": pet.id,
        "user_id": pet.user_id,
        "name": pet.name,
        "breed": pet.breed,
        "birth_date": pet.birth_date.isoformat() if pet.birth_date else None,
        "age_str": pet.age_str,
        "gender": pet.gender,
        "weight": float(pet.weight) if pet.weight else None,
        "avatar": pet.avatar,
        "tags": pet.tags or [],
        "health_notes": pet.health_notes,
        "vaccine_date": pet.vaccine_date.isoformat() if pet.vaccine_date else None,
        "vaccine_book": pet.vaccine_book,
        "is_default": pet.is_default,
        "status": pet.status,
        "created_at": pet.created_at.isoformat() if pet.created_at else None,
        "updated_at": pet.updated_at.isoformat() if pet.updated_at else None
    })


@router.delete("/{pet_id}")
async def delete_pet(
    pet_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """删除宠物档案"""
    await pet_service.delete_pet(pet_id, current_user["user_id"], db)
    return success(message="删除成功")


@router.get("/simple/list")
async def get_simple_pet_list(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取当前用户宠物列表（犬格检测选择页用，精简字段）"""
    pets = await pet_service.get_user_pets(current_user["user_id"], db)
    
    from sqlalchemy import select, desc
    from app.models.dog_personality import DogPersonalityResult
    
    pet_list = []
    for pet in pets:
        # 查询该宠物最近一次测评
        result = await db.execute(
            select(DogPersonalityResult.id, DogPersonalityResult.type_code)
            .where(DogPersonalityResult.pet_id == pet.id)
            .order_by(desc(DogPersonalityResult.created_at))
            .limit(1)
        )
        last_result = result.first()
        
        pet_list.append({
            "id": pet.id,
            "name": pet.name,
            "breed": pet.breed,
            "breed_type": pet.breed_type,
            "age_str": pet.age_str,
            "gender": pet.gender,
            "avatar": pet.avatar,
            "profile_status": pet.profile_status,
            "last_result_id": last_result[0] if last_result else None,
            "last_type_code": last_result[1] if last_result else None
        })
    
    return success(pet_list)
