"""
首页轮播图模型
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class Banner(Base):
    """轮播图表"""
    __tablename__ = "banners"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, comment="轮播图标题")
    image_url: Mapped[str] = mapped_column(String(500), nullable=False, comment="图片URL")
    link_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="跳转链接")
    
    # 状态 0禁用 1启用
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0禁用 1启用")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, comment="排序，数字越大越靠前")
    
    # 时间
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
