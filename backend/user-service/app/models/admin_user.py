"""
后台管理员模型
对应 admin_users 表
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from common.database import Base


class AdminUser(Base):
    """后台管理员表"""
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="管理员ID")
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, comment="用户名")
    password: Mapped[str] = mapped_column(String(255), nullable=False, comment="密码哈希")
    real_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="真实姓名")
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, comment="手机号")
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment="邮箱")
    avatar: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="头像URL")
    role_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("admin_roles.id", ondelete="SET NULL"), nullable=True, comment="角色ID")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0禁用 1正常")
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="最后登录时间")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")

    role: Mapped[Optional["AdminRole"]] = relationship("AdminRole", lazy="selectin", foreign_keys="[AdminUser.role_id]")
