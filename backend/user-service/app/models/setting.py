"""
系统设置模型
"""
from datetime import datetime
from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class SystemSetting(Base):
    """系统设置表"""
    __tablename__ = "system_settings"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, comment="配置键")
    value: Mapped[str] = mapped_column(Text, nullable=True, comment="配置值")
    description: Mapped[str] = mapped_column(String(500), nullable=True, comment="配置说明")
    group: Mapped[str] = mapped_column(String(50), default="general", comment="配置分组")
    is_public: Mapped[int] = mapped_column(default=0, comment="0私有 1公开")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
