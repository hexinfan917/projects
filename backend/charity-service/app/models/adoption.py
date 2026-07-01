"""
宠物领养模型
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Text, JSON, DateTime, func, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class AdoptionDog(Base):
    """领养狗狗档案表"""
    __tablename__ = "adoption_dogs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="主键ID")
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="狗狗名字")
    breed: Mapped[Optional[str]] = mapped_column(String(50), comment="品种")
    gender: Mapped[Optional[str]] = mapped_column(String(10), comment="性别")
    age: Mapped[Optional[str]] = mapped_column(String(50), comment="年龄描述")
    weight: Mapped[Optional[str]] = mapped_column(String(20), comment="体重")
    location: Mapped[Optional[str]] = mapped_column(String(200), comment="所在城市/基地")

    cover_image: Mapped[Optional[str]] = mapped_column(String(500), comment="封面图")
    images: Mapped[Optional[list]] = mapped_column(JSON, comment="相册")

    story: Mapped[Optional[str]] = mapped_column(LONGTEXT, comment="救助故事/性格描述")
    health_tags: Mapped[Optional[list]] = mapped_column(JSON, comment="健康标签")
    adoption_requirements: Mapped[Optional[str]] = mapped_column(LONGTEXT, comment="领养要求")

    # 状态: 0未开放 1可申请 2已领养 3已下架
    status: Mapped[int] = mapped_column(Integer, default=1, comment="状态")

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class AdoptionApplication(Base):
    """领养申请表"""
    __tablename__ = "adoption_applications"
    __table_args__ = (
        UniqueConstraint('dog_id', 'openid', name='uk_dog_openid'),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="主键ID")
    dog_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="狗狗ID")
    openid: Mapped[str] = mapped_column(String(100), nullable=False, comment="申请人openid")
    user_id: Mapped[Optional[int]] = mapped_column(Integer, comment="申请人用户ID")

    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="姓名")
    gender: Mapped[Optional[str]] = mapped_column(String(10), comment="性别")
    age: Mapped[Optional[str]] = mapped_column(String(20), comment="年龄")
    phone: Mapped[str] = mapped_column(String(20), nullable=False, comment="电话")
    wechat: Mapped[Optional[str]] = mapped_column(String(50), comment="微信号")
    city: Mapped[Optional[str]] = mapped_column(String(100), comment="所在城市")
    address: Mapped[Optional[str]] = mapped_column(String(300), comment="详细地址")
    housing: Mapped[Optional[str]] = mapped_column(String(50), comment="住房情况")
    experience: Mapped[Optional[str]] = mapped_column(Text, comment="养宠经验")
    reason: Mapped[Optional[str]] = mapped_column(Text, comment="领养理由")

    # 状态: 0待审核 1已通过 2已拒绝 3已完成领养
    status: Mapped[int] = mapped_column(Integer, default=0, comment="状态")
    admin_remark: Mapped[Optional[str]] = mapped_column(Text, comment="管理后台备注")

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
