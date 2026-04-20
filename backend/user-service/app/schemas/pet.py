"""
宠物档案相关Schema
"""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field


class PetBase(BaseModel):
    """宠物基础信息"""
    name: str = Field(..., max_length=50, description="宠物名")
    breed: Optional[str] = Field(None, max_length=50, description="品种")
    birth_date: Optional[str] = Field(None, description="出生日期")
    gender: Optional[int] = Field(None, ge=0, le=1, description="0母 1公")
    weight: Optional[float] = Field(None, ge=0, le=200, description="体重kg")
    avatar: Optional[str] = Field(None, max_length=500, description="头像URL")
    tags: Optional[List[str]] = Field(None, description="性格标签")
    health_notes: Optional[str] = Field(None, description="健康备注")
    vaccine_date: Optional[date] = Field(None, description="疫苗注射时间")
    is_default: int = Field(default=0, description="是否默认宠物")


class PetCreate(PetBase):
    """创建宠物"""
    pass


class PetUpdate(BaseModel):
    """更新宠物"""
    name: Optional[str] = Field(None, max_length=50, description="宠物名")
    breed: Optional[str] = Field(None, max_length=50, description="品种")
    birth_date: Optional[str] = Field(None, description="出生日期")
    gender: Optional[int] = Field(None, ge=0, le=1, description="性别")
    weight: Optional[float] = Field(None, ge=0, le=200, description="体重kg")
    avatar: Optional[str] = Field(None, max_length=500, description="头像URL")
    tags: Optional[List[str]] = Field(None, description="性格标签")
    health_notes: Optional[str] = Field(None, description="健康备注")
    vaccine_date: Optional[date] = Field(None, description="疫苗注射时间")
    is_default: Optional[int] = Field(None, description="是否默认宠物")


class PetResponse(PetBase):
    """宠物响应"""
    id: int = Field(..., description="宠物ID")
    user_id: int = Field(..., description="主人ID")
    status: int = Field(default=1, description="状态")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    class Config:
        from_attributes = True
