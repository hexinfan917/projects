"""
路线类型模型
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class RouteType(Base):
    """路线类型表"""
    __tablename__ = "route_types"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, comment="类型名称")
    icon: Mapped[Optional[str]] = mapped_column(String(50), comment="图标标识")
    color: Mapped[Optional[str]] = mapped_column(String(20), comment="主题色")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, comment="排序")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0禁用 1启用")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
