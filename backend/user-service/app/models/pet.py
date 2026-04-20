"""
宠物档案模型
对应文档中的 pet_profiles 表
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Integer, Date, DateTime, Text, JSON, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from common.database import Base


class PetProfile(Base):
    """宠物档案表"""
    __tablename__ = "pet_profiles"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="宠物ID")
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, comment="主人ID")
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="宠物名")
    breed: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="品种")
    breed_type: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="体型: 1小型 2中型 3大型 4巨型")
    birth_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True, comment="出生日期")
    gender: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="0母 1公")
    weight: Mapped[Optional[float]] = mapped_column(Integer, nullable=True, comment="体重kg")
    avatar: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="头像URL")
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, comment="性格标签")
    health_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="健康备注")
    vaccine_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True, comment="疫苗注射时间")
    is_default: Mapped[int] = mapped_column(Integer, default=0, comment="是否默认宠物")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0删除 1正常")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")
