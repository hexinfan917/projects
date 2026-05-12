"""
用户模型
对应文档中的 users 表
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Date, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class User(Base):
    """用户表"""
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="用户ID")
    openid: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, comment="微信openid")
    unionid: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, comment="微信unionid")
    nickname: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="昵称")
    avatar: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="头像URL")
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, comment="手机号")
    real_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="真实姓名")
    id_card: Mapped[Optional[str]] = mapped_column(String(18), nullable=True, comment="身份证号")
    gender: Mapped[int] = mapped_column(Integer, default=0, comment="0未知 1男 2女")
    birthday: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True, comment="生日")
    city: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="城市")
    member_level: Mapped[int] = mapped_column(Integer, default=0, comment="0新手上路 1爱好者 2资深 3大使")
    member_points: Mapped[int] = mapped_column(Integer, default=0, comment="积分")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0禁用 1正常")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")
