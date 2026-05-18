"""
后台菜单模型
对应 admin_menus 表
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class AdminMenu(Base):
    """后台菜单表"""
    __tablename__ = "admin_menus"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="菜单ID")
    parent_id: Mapped[int] = mapped_column(Integer, default=0, nullable=False, comment="父菜单ID，0为顶级")
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="菜单名称")
    path: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, comment="路由路径")
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="图标")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, comment="排序")
    type: Mapped[int] = mapped_column(Integer, default=2, comment="1目录 2菜单 3按钮")
    permission: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment="权限标识")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0禁用 1启用")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")
