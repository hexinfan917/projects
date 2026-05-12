"""
弹窗配置模型
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Text, JSON, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class PopupConfig(Base):
    """弹窗配置表"""
    __tablename__ = "popup_configs"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False, comment="弹窗类型")
    title: Mapped[str] = mapped_column(String(100), nullable=False, comment="弹窗标题")
    subtitle: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, comment="副标题")
    image: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="弹窗主图URL")
    content: Mapped[Optional[dict]] = mapped_column(JSON, comment="内容配置")
    primary_btn_text: Mapped[str] = mapped_column(String(20), default="立即开通", comment="主按钮文案")
    primary_btn_color: Mapped[str] = mapped_column(String(20), default="#FF6B35", comment="主按钮颜色")
    close_btn_text: Mapped[str] = mapped_column(String(20), default="暂不开通", comment="关闭按钮文案")
    trigger_type: Mapped[int] = mapped_column(Integer, default=1, comment="1首次进入 2每次进入")
    show_duration_seconds: Mapped[int] = mapped_column(Integer, default=0, comment="自动关闭时间")
    target_plan_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="跳转套餐ID")
    target_page: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, comment="跳转页面路径")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0停用 1启用")
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class UserPopupLog(Base):
    """用户弹窗记录表"""
    __tablename__ = "user_popup_logs"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    popup_id: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[int] = mapped_column(Integer, nullable=False, comment="1展示 2点击主按钮 3点击关闭 4点击外部蒙层")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
