"""
协议/文档管理模型
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class Agreement(Base):
    """协议/文档表"""
    __tablename__ = "agreements"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="协议标题")
    type: Mapped[str] = mapped_column(String(50), nullable=False, comment="协议类型：risk_confirm|travel_notice|pet_medical|other")
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="协议内容（支持HTML）")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, comment="排序，越小越靠前")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0禁用 1启用")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
