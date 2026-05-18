"""
后台角色模型
对应 admin_roles 表 和 admin_role_menus 关联表
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Integer, DateTime, Table, Column, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from common.database import Base


# 角色-菜单关联表
admin_role_menus = Table(
    "admin_role_menus",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("admin_roles.id", ondelete="CASCADE"), primary_key=True, comment="角色ID"),
    Column("menu_id", Integer, ForeignKey("admin_menus.id", ondelete="CASCADE"), primary_key=True, comment="菜单ID"),
)


class AdminRole(Base):
    """后台角色表"""
    __tablename__ = "admin_roles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="角色ID")
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="角色名称")
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, comment="角色编码")
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment="描述")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0禁用 1启用")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")

    menus: Mapped[List["AdminMenu"]] = relationship("AdminMenu", secondary=admin_role_menus, lazy="selectin")


# 注意：使用 admin_role_menus Table 对象进行操作，不定义 ORM 类避免表名冲突
